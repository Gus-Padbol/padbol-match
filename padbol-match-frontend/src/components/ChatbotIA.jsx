import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  isChatbotIAVisiblePathname,
  isJugadorHubShellPathname,
  isSedeProfilePathname,
} from '../constants/hubLayout';

const MAX_USER_MESSAGES = 6;
const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

/** yyyy-LL-dd en America/Argentina/Buenos_Aires (referencia cruzada con el servidor en /api/chat-ia). */
function ymdBuenosAires(d = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const mo = parts.find((p) => p.type === 'month')?.value;
    const da = parts.find((p) => p.type === 'day')?.value;
    if (y && mo && da) return `${y}-${mo}-${da}`;
  } catch (_) {
    /* ignore */
  }
  return '';
}

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isSpeechRecognitionAvailable() {
  return getSpeechRecognitionCtor() != null;
}

function isSpeechSynthesisAvailable() {
  if (typeof window === 'undefined') return false;
  const s = window.speechSynthesis;
  return !!(s && typeof s.speak === 'function');
}

/** Breve pausa tras cerrar el mic antes de enviar el texto (UX “Procesando…”). */
const VOICE_POST_TRANSCRIPT_MS = 420;
/** Sin transcripción con contenido en este tiempo → cancelar y avisar. */
const VOICE_SILENCE_MS = 8000;

function normalizeUiLocale(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .slice(0, 24);
  if (!s) return 'es';
  if (s.startsWith('es')) return 'es';
  if (s.startsWith('pt')) return 'pt';
  if (s.startsWith('en')) return 'en';
  return 'es';
}

/** es|en|pt según el texto escrito por el usuario (heurística alineada con el backend). */
function inferWritingLocaleCodeFromText(textRaw) {
  const text = String(textRaw || '').trim();
  if (!text) return 'es';
  const fold = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const pad = ` ${fold.replace(/\s+/g, ' ')} `;

  let pt = 0;
  let es = 0;
  let en = 0;

  if (/[ãõ]|\b(nao|nao)\b/i.test(text) || /não/i.test(text)) pt += 4;
  if (/ñ|¿|¡/.test(text)) es += 4;
  if (/\b(nao|nao|voce|voces|torneio|obrigado|obrigada|quadras|disponivel|tambem|amanha)\b/.test(pad)) pt += 3;
  if (/\b(manana|hoy|cuando|donde|cancha|turno|disponibilidad|quiero|gracias|sedes?|horarios)\b/.test(pad)) es += 3;
  if (/\b(tomorrow|today|when|where|booking|available|slot|courts|tournament|thanks|please|what\s+time|how\s+do)\b/.test(pad)) en += 3;
  if (/\b(voce|voces)\b/.test(pad)) pt += 2;
  if (/\b(the|and|with|for)\b/.test(pad)) en += 1;
  if (/\b(el|la|los|las|una|por|para)\b/.test(pad)) es += 1;

  if (pt > es && pt > en) return 'pt';
  if (en > es && en > pt) return 'en';
  return 'es';
}

/**
 * BCP-47 para SpeechSynthesis según el texto de la respuesta del asistente (no dispositivo ni mensaje del usuario).
 */
function bcp47LangForAssistantTts(textRaw) {
  const text = String(textRaw || '').trim();
  if (!text) return 'es-AR';

  // Scripts (orden: no latinos primero)
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) return 'ar-SA';
  if (/[\u0590-\u05FF]/.test(text)) return 'he-IL';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru-RU';
  if (/[\u0370-\u03FF]/.test(text)) return 'el-GR';
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th-TH';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja-JP';
  if (/[\uAC00-\uD7A3]/.test(text)) return 'ko-KR';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';

  // Rumano (diacríticos típicos o palabras sin diacríticos comunes)
  if (/[\u0103\u0102\u00E2\u00C2\u00EE\u00CE\u0219\u0218\u021b\u021B]/.test(text)) return 'ro-RO';
  if (/\b(multumesc|mulțumesc|bun[ăa]\s+ziua|pe\s+m[aâ]ine|ast[ăa]zi|v[aă]\s+rog|sigur)\b/i.test(text)) return 'ro-RO';

  // Turco / alemán / francés (latinos con señales fuertes)
  if (/[ğüşöçıİĞÜŞÖÇ]/.test(text)) return 'tr-TR';
  if (/[äöüÄÖÜß]/.test(text)) return 'de-DE';
  if (
    /[àâçéèêëïîôùûüÿœæ]/.test(text) &&
    /\b(merci|bonjour|bonsoir|monsieur|madame|au\s+revoir|vous|nous|avec|pour)\b/i.test(text) &&
    !/\b(hola|gracias|cancha|mañana|dónde)\b/i.test(text)
  ) {
    return 'fr-FR';
  }

  const code = inferWritingLocaleCodeFromText(text);
  if (code === 'pt') return 'pt-BR';
  if (code === 'en') return 'en-US';
  return 'es-AR';
}

function navigatorLanguageToChatCode(nav) {
  const n = String(nav || 'es').toLowerCase();
  if (n.startsWith('pt')) return 'pt';
  if (n.startsWith('en')) return 'en';
  return 'es';
}

function chatUiStrings(loc) {
  const l = normalizeUiLocale(loc);
  if (l === 'en') {
    return {
      escribiendo: 'Writing…',
      procesando: 'Processing…',
      enviar: 'Send',
      placeholder: 'E.g. I want to play tomorrow at 7pm',
      waEscalada: 'Contact the club on WhatsApp',
      waClub: 'Message your usual club',
      fabOpen: 'Open Padbol Match assistant',
      titulo: 'Padbol Match Assistant',
      cargando: 'Loading…',
      escuchando: 'Listening…',
      sinVoz: 'No voice detected. Try again.',
      noReconocer: 'Could not recognize speech. Try again.',
      limiteSesion: 'You have reached the limit for this session.',
      verSedePrimario: (nombre) => (nombre ? `See ${nombre}` : 'See club'),
      limiteCtaJugar: 'Play',
      limiteCtaVerSede: 'See club',
      nuevaConsultaSesion: 'New chat',
      cerrar: 'Close',
      micRecordingAria: 'Recording — tap again to cancel',
      micProcessingAria: 'Processing dictation',
      micDictateAria: 'Voice input',
      reservaLink: 'Go to booking',
      reservaLinkTitle: 'Open the booking form with the details shown',
      leerVozAlta: 'Read replies aloud',
      escucharUltimaIos: 'Play last reply (iOS / Safari)',
      hintIosSafari: 'On iPhone or iPad, audio may need an extra tap after the reply loads.',
      errMicDenied: 'Microphone permission denied. Enable it in the browser and try again.',
      errVoiceStart: 'Could not start speech recognition.',
      slotsDisponiblesTitulo: 'Free slots (tap to book):',
      welcomeAssistant: (firstName) => {
        const n = String(firstName || '').trim();
        const lead = n ? `Hi ${n} 👋` : 'Hi 👋';
        return `${lead} I'm your assistant. I can help you book a court, find a game nearby, or check tournaments. What do you need?`;
      },
      quickSuggestions: [
        { label: "See today's court times ⚽" },
        { label: 'Find a game nearby 🔍' },
        { label: 'Available tournaments 🏆' },
        { label: 'Book a court 📅' },
      ],
    };
  }
  if (l === 'pt') {
    return {
      escribiendo: 'Escrevendo…',
      procesando: 'Processando…',
      enviar: 'Enviar',
      placeholder: 'Ex.: quero jogar amanhã às 19h',
      waEscalada: 'Falar com o clube no WhatsApp',
      waClub: 'Escrever ao clube habitual',
      fabOpen: 'Abrir assistente Padbol Match',
      titulo: 'Assistente Padbol Match',
      cargando: 'Carregando…',
      escuchando: 'Ouvindo…',
      sinVoz: 'Nenhuma voz detectada. Tente de novo.',
      noReconocer: 'Não foi possível reconhecer. Tente de novo.',
      limiteSesion: 'Você chegou ao limite desta sessão.',
      verSedePrimario: (nombre) => (nombre ? `Ver ${nombre}` : 'Ver clube'),
      limiteCtaJugar: 'Jogar',
      limiteCtaVerSede: 'Ver clube',
      nuevaConsultaSesion: 'Nova conversa',
      cerrar: 'Fechar',
      micRecordingAria: 'Gravando — toque de novo para cancelar',
      micProcessingAria: 'Processando ditado',
      micDictateAria: 'Ditar por voz',
      reservaLink: 'Ir para reservar',
      reservaLinkTitle: 'Abrir o formulário de reserva com os dados indicados',
      leerVozAlta: 'Ler respostas em voz alta',
      escucharUltimaIos: 'Ouvir última resposta (iOS / Safari)',
      hintIosSafari: 'No iPhone ou iPad, o áudio pode exigir um toque extra após carregar a resposta.',
      errMicDenied: 'Permissão do microfone negada. Ative no navegador e tente de novo.',
      errVoiceStart: 'Não foi possível iniciar o reconhecimento de voz.',
      slotsDisponiblesTitulo: 'Horários livres (toque para reservar):',
      welcomeAssistant: (firstName) => {
        const n = String(firstName || '').trim();
        const lead = n ? `Olá ${n} 👋` : 'Olá 👋';
        return `${lead} Sou seu assistente. Posso ajudar a reservar quadra, buscar partida perto ou consultar torneios. O que você precisa?`;
      },
      quickSuggestions: [
        { label: 'Ver horários hoje ⚽' },
        { label: 'Buscar partida perto 🔍' },
        { label: 'Torneios disponíveis 🏆' },
        { label: 'Reservar quadra 📅' },
      ],
    };
  }
  return {
    escribiendo: 'Escribiendo…',
    procesando: 'Procesando…',
    enviar: 'Enviar',
    placeholder: 'Ej: quiero jugar mañana a las 19hs',
    waEscalada: 'Contactar al club por WhatsApp',
    waClub: 'Escribir al club habitual',
    fabOpen: 'Abrir asistente Padbol Match',
    titulo: 'Asistente Padbol Match',
    cargando: 'Cargando…',
    escuchando: 'Escuchando…',
    sinVoz: 'No se detectó voz. Intenta de nuevo.',
    noReconocer: 'No se pudo reconocer. Intenta de nuevo.',
    limiteSesion: 'Llegaste al límite de esta sesión.',
    verSedePrimario: (nombre) => (nombre ? `Ver ${nombre}` : 'Ver sede'),
    limiteCtaJugar: 'Jugar',
    limiteCtaVerSede: 'Ver sede',
    nuevaConsultaSesion: 'Nueva consulta',
    cerrar: 'Cerrar',
    micRecordingAria: 'Grabando: pulsa de nuevo para cancelar',
    micProcessingAria: 'Procesando dictado',
    micDictateAria: 'Dictar por voz',
    reservaLink: 'Ir a reservar',
    reservaLinkTitle: 'Abrir formulario de reserva con los datos indicados',
    leerVozAlta: 'Leer respuestas en voz alta',
    escucharUltimaIos: 'Escuchar última respuesta (iOS / Safari)',
    hintIosSafari: 'En iPhone o iPad el audio puede requerir un toque explícito después de cargar la respuesta.',
    errMicDenied: 'Permiso de micrófono denegado. Activa el permiso en el navegador e intenta de nuevo.',
    errVoiceStart: 'No se pudo iniciar el reconocimiento de voz.',
    slotsDisponiblesTitulo: 'Turnos libres (toca para reservar):',
    welcomeAssistant: (firstName) => {
      const n = String(firstName || '').trim();
      const lead = n ? `Hola ${n} 👋` : 'Hola 👋';
      return `${lead} Soy tu asistente. Puedo ayudarte a reservar cancha, buscar partido o consultar torneos. ¿Qué necesitás?`;
    },
    quickSuggestions: [
      { label: 'Ver horarios hoy ⚽' },
      { label: 'Buscar partido cerca 🔍' },
      { label: 'Torneos disponibles 🏆' },
      { label: 'Reservar cancha 📅' },
    ],
  };
}

function QuickSuggestionBar({ items, disabled, onPick }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div
      style={{
        alignSelf: 'stretch',
        maxWidth: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        gap: 8,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        paddingBottom: 2,
        boxSizing: 'border-box',
      }}
    >
      {list.map((q, idx) => (
        <button
          key={`qs-row-${idx}`}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q.label)}
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxHeight: 32,
            padding: '6px 12px',
            boxSizing: 'border-box',
            borderRadius: 9999,
            border: '1px solid #d1d5f8',
            background: 'transparent',
            color: '#64748b',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.25,
            whiteSpace: 'nowrap',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            boxShadow: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}

export default function ChatbotIA() {
  const location = useLocation();
  const { session, userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionEnded, setSessionEnded] = useState(false);
  /** idle: sin dictado; listening: grabando; processing: entre fin de voz y envío al API */
  const [voicePhase, setVoicePhase] = useState('idle');
  const [voiceFinal, setVoiceFinal] = useState('');
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('');
  const [readAloud, setReadAloud] = useState(false);
  const [lastReserve, setLastReserve] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [sedeContextoTurno, setSedeContextoTurno] = useState(null);
  const [whatsappEscalada, setWhatsappEscalada] = useState(null);
  const recRef = useRef(null);
  const listEndRef = useRef(null);
  const readAloudRef = useRef(readAloud);
  const uiRef = useRef(null);
  const voiceSendTimerRef = useRef(null);
  const voiceSilenceTimerRef = useRef(null);
  const voiceDictationBackupRef = useRef('');
  const voiceLatestTranscriptRef = useRef('');
  const voiceHeardNonEmptyRef = useRef(false);
  const voiceTimedOutRef = useRef(false);
  const voiceUserCancelledRef = useRef(false);

  const micSupported = useMemo(() => isSpeechRecognitionAvailable(), []);
  const ttsSupported = useMemo(() => isSpeechSynthesisAvailable(), []);
  const isLikelyIOSWebKit = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  const deviceLocale = useMemo(
    () => (typeof navigator !== 'undefined' ? navigator.language || 'es' : 'es'),
    [],
  );
  const ui = useMemo(() => chatUiStrings(deviceLocale), [deviceLocale]);

  const chatWelcomeFirstName = useMemo(() => {
    const ns = userProfile?.nombre_saludo != null ? String(userProfile.nombre_saludo).trim() : '';
    if (ns) return ns;
    const nom = userProfile?.nombre != null ? String(userProfile.nombre).trim() : '';
    if (nom) {
      const first = nom.split(/\s+/).filter(Boolean)[0];
      return first || nom;
    }
    const meta = session?.user?.user_metadata || {};
    const full = String(meta.full_name || meta.name || '').trim();
    if (full) return full.split(/\s+/).filter(Boolean)[0] || full;
    return '';
  }, [userProfile, session?.user]);

  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') return i;
    }
    return -1;
  }, [messages]);

  const lastMessageIsAssistant =
    messages.length > 0 && messages[messages.length - 1]?.role === 'assistant';

  const showQuickSuggestionBar =
    !loading && !sessionEnded && (messages.length === 0 || lastMessageIsAssistant);

  useEffect(() => {
    readAloudRef.current = readAloud;
  }, [readAloud]);

  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);
  const writingLocaleForVoice = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user' && String(messages[i].content || '').trim()) {
        return inferWritingLocaleCodeFromText(messages[i].content);
      }
    }
    return navigatorLanguageToChatCode(typeof navigator !== 'undefined' ? navigator.language : 'es');
  }, [messages]);

  const speechRecLang = useMemo(() => {
    const c = writingLocaleForVoice;
    if (c === 'en') return 'en-US';
    if (c === 'pt') return 'pt-BR';
    return 'es-AR';
  }, [writingLocaleForVoice]);

  const visible = useMemo(() => isChatbotIAVisiblePathname(location.pathname), [location.pathname]);

  const hubShell = useMemo(() => {
    const p = location.pathname.split('?')[0] || '/';
    return isJugadorHubShellPathname(p) || isSedeProfilePathname(p) || p === '/' || p === '/hub' || p === '/inicio' || p === '/home';
  }, [location.pathname]);

  const fabBottom = useMemo(() => {
    if (hubShell) {
      return `calc(${HUB_CONTENT_PADDING_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px) + 8px)`;
    }
    return `calc(16px + env(safe-area-inset-bottom, 0px))`;
  }, [hubShell]);

  useEffect(() => {
    if (!open) return;
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages, loading, error, showQuickSuggestionBar]);

  useEffect(() => {
    if (!open) return;
    let canceled = false;
    (async () => {
      try {
        const headers = {};
        const { data: sess } = await supabase.auth.getSession();
        const tok = sess?.session?.access_token;
        if (tok) headers.Authorization = `Bearer ${tok}`;
        const loc = (() => {
          for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i]?.role === 'user' && String(messages[i].content || '').trim()) {
              return inferWritingLocaleCodeFromText(messages[i].content);
            }
          }
          return navigatorLanguageToChatCode(typeof navigator !== 'undefined' ? navigator.language : 'es');
        })();
        const res = await fetch(`${API_BASE}/api/chat-ia/bootstrap?locale=${encodeURIComponent(loc)}`, {
          headers,
        });
        const data = await res.json().catch(() => ({}));
        if (!canceled && res.ok) setBootstrap(data);
      } catch {
        if (!canceled) setBootstrap(null);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [open, session?.user?.id, messages]);

  const userMessageCount = useMemo(() => messages.filter((m) => m.role === 'user').length, [messages]);

  const limiteSesionCta = useMemo(() => {
    const fromTurno = sedeContextoTurno?.id;
    const fromHab = bootstrap?.sede_habitual_id;
    const sid =
      fromTurno != null && Number.isFinite(Number(fromTurno)) && Number(fromTurno) > 0
        ? Number(fromTurno)
        : fromHab != null && Number.isFinite(Number(fromHab)) && Number(fromHab) > 0
          ? Number(fromHab)
          : null;
    if (sid != null) {
      const nombre =
        (sedeContextoTurno && Number(sedeContextoTurno.id) === sid && String(sedeContextoTurno.nombre || '').trim()) ||
        (bootstrap?.sede_habitual_id != null && Number(bootstrap.sede_habitual_id) === sid
          ? String(bootstrap.sede_habitual_nombre || '').trim()
          : '') ||
        '';
      return { href: `/sede/${encodeURIComponent(String(sid))}`, nombre };
    }
    return { href: '/jugar', nombre: '' };
  }, [sedeContextoTurno, bootstrap?.sede_habitual_id, bootstrap?.sede_habitual_nombre]);

  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') return String(messages[i].content || '').trim();
    }
    return '';
  }, [messages]);

  const clearVoiceSilenceTimer = useCallback(() => {
    if (voiceSilenceTimerRef.current != null) {
      window.clearTimeout(voiceSilenceTimerRef.current);
      voiceSilenceTimerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(
    (opts) => {
      clearVoiceSilenceTimer();
      if (voiceSendTimerRef.current != null) {
        window.clearTimeout(voiceSendTimerRef.current);
        voiceSendTimerRef.current = null;
      }
      const rec = recRef.current;
      if (opts?.userCancelled) voiceUserCancelledRef.current = true;
      if (opts?.hard) {
        voiceUserCancelledRef.current = true;
        try {
          if (rec && typeof rec.abort === 'function') rec.abort();
          else rec?.stop?.();
        } catch {
          /* ignore */
        }
        recRef.current = null;
        setVoicePhase('idle');
        setVoiceFinal('');
        setVoiceInterim('');
        return;
      }
      if (!rec) {
        setVoicePhase('idle');
        setVoiceFinal('');
        setVoiceInterim('');
        return;
      }
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    [clearVoiceSilenceTimer],
  );

  useEffect(() => () => stopRecognition({ hard: true }), [stopRecognition]);

  const speakAssistantReply = useCallback((text) => {
    if (!ttsSupported || typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!readAloudRef.current) return;
    const t = String(text || '').trim();
    if (!t) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(t);
      utter.lang = bcp47LangForAssistantTts(t);
      utter.rate = 0.92;
      window.speechSynthesis.speak(utter);
    } catch {
      /* ignore */
    }
  }, [ttsSupported]);

  /** Llamar desde handlers de gesto del usuario (enviar, dictado, activar checkbox). */
  const primeSpeechSynthesisFromUserGesture = useCallback(() => {
    if (!ttsSupported || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }
  }, [ttsSupported]);

  const scheduleAssistantSpeak = useCallback(
    (reply) => {
      if (!ttsSupported) return;
      const run = () => {
        if (!readAloudRef.current) return;
        speakAssistantReply(reply);
      };
      run();
      window.setTimeout(() => {
        if (!readAloudRef.current) return;
        try {
          const s = window.speechSynthesis;
          if (s && !s.speaking && !s.pending) run();
        } catch {
          run();
        }
      }, isLikelyIOSWebKit ? 650 : 300);
    },
    [isLikelyIOSWebKit, speakAssistantReply, ttsSupported]
  );

  const sendMessage = useCallback(
    async (textRaw) => {
      const text = String(textRaw || '').trim();
      if (!text || loading || sessionEnded) return;
      if (userMessageCount >= MAX_USER_MESSAGES) {
        setSessionEnded(true);
        return;
      }

      primeSpeechSynthesisFromUserGesture();
      setError('');
      const historial = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setInput('');
      setVoicePhase('idle');
      setVoiceFinal('');
      setVoiceInterim('');
      setVoiceNotice('');
      setLoading(true);
      setLastReserve(null);
      setSedeContextoTurno(null);
      setWhatsappEscalada(null);

      try {
        const headers = { 'Content-Type': 'application/json' };
        const { data: sess } = await supabase.auth.getSession();
        const tok = sess?.session?.access_token;
        if (tok) headers.Authorization = `Bearer ${tok}`;

        const res = await fetch(`${API_BASE}/api/chat-ia`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            mensaje: text,
            historial,
            user_id: session?.user?.id || null,
            locale: inferWritingLocaleCodeFromText(text),
            client_calendario_art: ymdBuenosAires(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.limit_reached) {
            setSessionEnded(true);
            const sc = data.sede_contexto;
            if (sc && sc.id != null && Number.isFinite(Number(sc.id)) && Number(sc.id) > 0) {
              setSedeContextoTurno({ id: Number(sc.id), nombre: String(sc.nombre || '').trim() });
            }
            setError('');
            setLoading(false);
            return;
          }
          setMessages((prev) => prev.slice(0, -1));
          setError(data?.error || res.statusText || 'Error');
          return;
        }
        const reply = String(data.respuesta || '').trim() || 'Sin respuesta.';
        const disp =
          data.disponibilidad &&
          data.disponibilidad.sede_id != null &&
          data.disponibilidad.fecha &&
          Array.isArray(data.disponibilidad.slots) &&
          data.disponibilidad.slots.length
            ? {
                sede_id: Number(data.disponibilidad.sede_id),
                sede_nombre: String(data.disponibilidad.sede_nombre || '').trim(),
                fecha: String(data.disponibilidad.fecha).slice(0, 10),
                duracion_minutos: data.disponibilidad.duracion_minutos,
                deporte_filtro:
                  data.disponibilidad.deporte_filtro != null && String(data.disponibilidad.deporte_filtro).trim()
                    ? String(data.disponibilidad.deporte_filtro).trim()
                    : null,
                slots: data.disponibilidad.slots,
              }
            : null;
        setMessages((prev) => [...prev, { role: 'assistant', content: reply, disponibilidad: disp }]);
        if (data.reserve?.href) setLastReserve(data.reserve);
        const sc = data.sede_contexto;
        if (sc && sc.id != null && Number.isFinite(Number(sc.id)) && Number(sc.id) > 0) {
          setSedeContextoTurno({ id: Number(sc.id), nombre: String(sc.nombre || '').trim() });
        } else {
          setSedeContextoTurno(null);
        }
        if (data.whatsapp_escalada?.href) setWhatsappEscalada(data.whatsapp_escalada);
        const used = Number(data.user_messages_used);
        if (Number.isFinite(used) && used >= MAX_USER_MESSAGES) setSessionEnded(true);
        scheduleAssistantSpeak(reply);
      } catch (e) {
        setMessages((prev) => prev.slice(0, -1));
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [
      loading,
      sessionEnded,
      messages,
      userMessageCount,
      session?.user?.id,
      primeSpeechSynthesisFromUserGesture,
      scheduleAssistantSpeak,
    ]
  );

  const startVoice = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !micSupported) return;
    if (voicePhase === 'processing' || loading || sessionEnded) return;
    if (voicePhase === 'listening') {
      stopRecognition({ userCancelled: true });
      return;
    }
    setVoiceNotice('');
    setError('');
    voiceUserCancelledRef.current = false;
    voiceTimedOutRef.current = false;
    voiceHeardNonEmptyRef.current = false;
    voiceDictationBackupRef.current = input;
    voiceLatestTranscriptRef.current = '';
    setVoiceFinal('');
    setVoiceInterim('');
    primeSpeechSynthesisFromUserGesture();

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = speechRecLang;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      let finalP = '';
      let interP = '';
      const results = ev.results;
      if (results && results.length) {
        for (let i = 0; i < results.length; i += 1) {
          const piece = results[i][0]?.transcript ?? '';
          if (results[i].isFinal) finalP += piece;
          else interP += piece;
        }
      }
      const combined = (finalP + interP).trim();
      voiceLatestTranscriptRef.current = finalP + interP;
      setVoiceFinal(finalP);
      setVoiceInterim(interP);
      if (combined.length > 0) {
        clearVoiceSilenceTimer();
        voiceHeardNonEmptyRef.current = true;
      }
    };

    rec.onerror = (ev) => {
      clearVoiceSilenceTimer();
      const code = ev?.error || '';
      if (code === 'aborted') return;
      if (code === 'not-allowed') {
        const u = uiRef.current;
        setError(u?.errMicDenied || 'Permiso de micrófono denegado.');
        recRef.current = null;
        setVoicePhase('idle');
        setVoiceFinal('');
        setVoiceInterim('');
        setInput(voiceDictationBackupRef.current);
        return;
      }
      const u = uiRef.current;
      if (code === 'no-speech' || code === 'audio-capture') {
        setVoiceNotice(u?.sinVoz || 'No se detectó voz. Intenta de nuevo.');
      } else {
        setVoiceNotice(u?.noReconocer || 'No se pudo reconocer. Intenta de nuevo.');
      }
      recRef.current = null;
      setVoicePhase('idle');
      setVoiceFinal('');
      setVoiceInterim('');
      setInput(voiceDictationBackupRef.current);
    };

    rec.onend = () => {
      clearVoiceSilenceTimer();
      recRef.current = null;
      const t = String(voiceLatestTranscriptRef.current || '').trim();
      const backup = String(voiceDictationBackupRef.current ?? '');
      const cancelled = voiceUserCancelledRef.current;
      const timedOut = voiceTimedOutRef.current;
      voiceUserCancelledRef.current = false;
      voiceTimedOutRef.current = false;

      if (t) {
        setVoiceFinal('');
        setVoiceInterim('');
        setInput(t);
        setVoicePhase('processing');
        voiceSendTimerRef.current = window.setTimeout(() => {
          voiceSendTimerRef.current = null;
          void sendMessage(t);
        }, VOICE_POST_TRANSCRIPT_MS);
        return;
      }

      setVoicePhase('idle');
      setVoiceFinal('');
      setVoiceInterim('');
      setInput(backup);
      if (timedOut && !cancelled) {
        const u = uiRef.current;
        setVoiceNotice(u?.sinVoz || 'No se detectó voz. Intenta de nuevo.');
      }
    };

    recRef.current = rec;
    setVoicePhase('listening');
    voiceSilenceTimerRef.current = window.setTimeout(() => {
      voiceSilenceTimerRef.current = null;
      if (!voiceHeardNonEmptyRef.current) {
        voiceTimedOutRef.current = true;
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
    }, VOICE_SILENCE_MS);

    try {
      rec.start();
    } catch {
      clearVoiceSilenceTimer();
      setVoicePhase('idle');
      const u = uiRef.current;
      setError(u?.errVoiceStart || 'Error de voz.');
    }
  }, [
    voicePhase,
    loading,
    sessionEnded,
    input,
    sendMessage,
    micSupported,
    primeSpeechSynthesisFromUserGesture,
    stopRecognition,
    speechRecLang,
    clearVoiceSilenceTimer,
  ]);

  const nuevaConsulta = useCallback(() => {
    stopRecognition({ hard: true });
    try {
      window.speechSynthesis?.cancel?.();
    } catch {
      /* ignore */
    }
    setMessages([]);
    setInput('');
    setError('');
    setSessionEnded(false);
    setLastReserve(null);
    setSedeContextoTurno(null);
    setWhatsappEscalada(null);
    setVoiceFinal('');
    setVoiceInterim('');
    setVoiceNotice('');
  }, [stopRecognition]);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        aria-label={ui.fabOpen}
        onClick={() => {
          setOpen(true);
          setError('');
          setVoiceNotice('');
        }}
        style={{
          position: 'fixed',
          right: 'max(12px, env(safe-area-inset-right, 0px))',
          bottom: fabBottom,
          zIndex: 10050,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
          color: '#fff',
          boxShadow: '0 10px 28px rgba(15,23,42,0.35)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          padding: 0,
        }}
      >
        <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>
          ✨
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1,
            letterSpacing: '0.04em',
          }}
        >
          IA
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ui.titulo}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10060,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '12px 12px max(12px, env(safe-area-inset-bottom))',
            boxSizing: 'border-box',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              stopRecognition({ hard: true });
              setOpen(false);
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: 'min(88vh, 640px)',
              background: '#fff',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>
              {`
                @keyframes chatbotia-mic-pulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
                  50% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
                }
                .chatbotia-mic-recording {
                  background: #ef4444 !important;
                  border-color: #fecaca !important;
                  color: #fff !important;
                  animation: chatbotia-mic-pulse 1.15s ease-in-out infinite;
                }
                @keyframes chatbotia-voice-bar {
                  0%, 100% { transform: scaleY(0.35); opacity: 0.65; }
                  50% { transform: scaleY(1); opacity: 1; }
                }
                .chatbotia-voice-bars {
                  display: flex;
                  align-items: flex-end;
                  justify-content: center;
                  gap: 3px;
                  height: 22px;
                  margin-bottom: 6px;
                }
                .chatbotia-voice-bars span {
                  display: block;
                  width: 4px;
                  height: 18px;
                  border-radius: 2px;
                  background: #6366f1;
                  transform-origin: bottom center;
                  animation: chatbotia-voice-bar 0.55s ease-in-out infinite;
                }
                .chatbotia-voice-bars span:nth-child(1) { animation-delay: 0ms; }
                .chatbotia-voice-bars span:nth-child(2) { animation-delay: 90ms; }
                .chatbotia-voice-bars span:nth-child(3) { animation-delay: 180ms; }
                .chatbotia-voice-bars span:nth-child(4) { animation-delay: 120ms; }
                .chatbotia-voice-bars span:nth-child(5) { animation-delay: 60ms; }
              `}
            </style>
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                background: 'linear-gradient(135deg,#eef2ff,#fff)',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>{ui.titulo}</div>
              <button
                type="button"
                onClick={() => {
                  stopRecognition({ hard: true });
                  setOpen(false);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: 4,
                }}
                aria-label={ui.cerrar}
              >
                ×
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 200,
              }}
            >
              {messages.length === 0 ? (
                <div style={{ alignSelf: 'flex-start', maxWidth: '92%', width: '100%' }}>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: '#f1f5f9',
                      color: '#0f172a',
                      fontSize: 14,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {ui.welcomeAssistant(chatWelcomeFirstName)}
                  </div>
                </div>
              ) : null}
              {showQuickSuggestionBar && messages.length === 0 ? (
                <QuickSuggestionBar
                  items={ui.quickSuggestions}
                  disabled={loading || sessionEnded}
                  onPick={(label) => void sendMessage(label)}
                />
              ) : null}
              {messages.map((m, i) => (
                <React.Fragment key={`${i}-${m.role}`}>
                  <div
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '92%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: m.role === 'user' ? '#4f46e5' : '#f1f5f9',
                      color: m.role === 'user' ? '#fff' : '#0f172a',
                      fontSize: 14,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' && m.disponibilidad?.slots?.length ? (
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        maxWidth: '92%',
                        marginTop: -2,
                        marginBottom: 2,
                        padding: '0 2px 8px',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                        {ui.slotsDisponiblesTitulo}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {m.disponibilidad.slots.slice(0, 14).map((s, j) => {
                          const sid = m.disponibilidad.sede_id;
                          const fe = m.disponibilidad.fecha;
                          const det = Array.isArray(s.canchas_detalle) ? s.canchas_detalle : [];
                          const names = det.map((d) => String(d?.nombre || '').trim()).filter(Boolean);
                          let courtLabel = '';
                          if (names.length === 1) courtLabel = names[0];
                          else if (names.length === 2) courtLabel = `${names[0]}, ${names[1]}`;
                          else if (names.length > 2) courtLabel = `${names[0]}, ${names[1]} +${names.length - 2}`;
                          else {
                            const fb = String(s.canchas_nombres || '').trim();
                            courtLabel = fb || '';
                          }
                          const chipText = courtLabel ? `${s.hora_inicio} · ${courtLabel}` : String(s.hora_inicio || '').trim();
                          let href = `/reservar?sedeId=${encodeURIComponent(String(sid))}&fecha=${encodeURIComponent(fe)}&hora=${encodeURIComponent(s.hora_inicio)}`;
                          if (det.length === 1 && det[0]?.numero != null && String(det[0].numero).trim() !== '') {
                            href += `&canchaId=${encodeURIComponent(String(det[0].numero).trim())}`;
                          }
                          return (
                            <Link
                              key={`${i}-slot-${j}`}
                              to={href}
                              onClick={() => setOpen(false)}
                              style={{
                                display: 'inline-block',
                                padding: '6px 10px',
                                borderRadius: 8,
                                background: '#e0e7ff',
                                color: '#312e81',
                                fontWeight: 700,
                                fontSize: 13,
                                textDecoration: 'none',
                                border: '1px solid #c7d2fe',
                                maxWidth: '100%',
                                wordBreak: 'break-word',
                              }}
                            >
                              {chipText}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {m.role === 'assistant' && showQuickSuggestionBar && i === lastAssistantIndex ? (
                    <QuickSuggestionBar
                      items={ui.quickSuggestions}
                      disabled={loading || sessionEnded}
                      onPick={(label) => void sendMessage(label)}
                    />
                  ) : null}
                </React.Fragment>
              ))}
              {loading ? (
                <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{ui.escribiendo}</div>
              ) : null}
              {error ? (
                <div style={{ color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>{error}</div>
              ) : null}
              {sessionEnded ? (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    color: '#78350f',
                    fontSize: 14,
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ marginBottom: 12, lineHeight: 1.45 }}>{ui.limiteSesion}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Link
                      to={limiteSesionCta.href}
                      onClick={() => setOpen(false)}
                      style={{
                        display: 'block',
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: '#16a34a',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 15,
                        textDecoration: 'none',
                        textAlign: 'center',
                      }}
                    >
                      {limiteSesionCta.href === '/jugar'
                        ? ui.limiteCtaJugar
                        : limiteSesionCta.nombre
                          ? ui.verSedePrimario(limiteSesionCta.nombre)
                          : ui.limiteCtaVerSede}
                    </Link>
                    <button
                      type="button"
                      onClick={nuevaConsulta}
                      style={{
                        border: '1px solid #ca8a04',
                        borderRadius: 10,
                        padding: '10px 16px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        background: '#fffbeb',
                        color: '#92400e',
                        fontSize: 14,
                      }}
                    >
                      {ui.nuevaConsultaSesion}
                    </button>
                  </div>
                </div>
              ) : null}
              {!sessionEnded && lastReserve?.href ? (
                <Link
                  to={lastReserve.href}
                  onClick={() => setOpen(false)}
                  title={lastReserve.fecha || lastReserve.hora ? [lastReserve.fecha, lastReserve.hora].filter(Boolean).join(' · ') : ui.reservaLinkTitle}
                  style={{
                    alignSelf: 'center',
                    marginTop: 4,
                    padding: '10px 16px',
                    borderRadius: 10,
                    background: '#16a34a',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 14,
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  {ui.reservaLink}
                  {lastReserve.hora
                    ? ` · ${lastReserve.hora}${lastReserve.fecha ? ` (${lastReserve.fecha})` : ''}`
                    : lastReserve.fecha
                      ? ` · ${lastReserve.fecha}`
                      : ''}
                </Link>
              ) : null}
              {!sessionEnded && whatsappEscalada?.href ? (
                <a
                  href={whatsappEscalada.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    alignSelf: 'center',
                    marginTop: 4,
                    padding: '10px 16px',
                    borderRadius: 10,
                    background: '#128C7E',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 14,
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  {ui.waEscalada}
                  {whatsappEscalada.sede_nombre ? ` · ${whatsappEscalada.sede_nombre}` : ''}
                </a>
              ) : null}
              <div ref={listEndRef} />
            </div>

            <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #e2e8f0' }}>
              {ttsSupported ? (
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: '#64748b' }}
                >
                  <input
                    type="checkbox"
                    checked={readAloud}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setReadAloud(v);
                      if (v) primeSpeechSynthesisFromUserGesture();
                      if (!v) {
                        try {
                          window.speechSynthesis?.cancel?.();
                        } catch {
                          /* ignore */
                        }
                      }
                    }}
                  />
                  {ui.leerVozAlta}
                </label>
              ) : null}
              {ttsSupported && isLikelyIOSWebKit && readAloud && lastAssistantText ? (
                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      primeSpeechSynthesisFromUserGesture();
                      speakAssistantReply(lastAssistantText);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#0f172a',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {ui.escucharUltimaIos}
                  </button>
                  <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8', lineHeight: 1.35 }}>
                    {ui.hintIosSafari}
                  </div>
                </div>
              ) : null}
              {voicePhase === 'listening' ? (
                <div className="chatbotia-voice-bars" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  gap: 8,
                  alignItems: 'stretch',
                }}
              >
                {voicePhase === 'listening' ? (
                  <div
                    role="status"
                    aria-live="polite"
                    aria-relevant="additions text"
                    style={{
                      flex: '1 1 0',
                      minWidth: 0,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      fontSize: 15,
                      minHeight: 44,
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      background: '#fafafa',
                    }}
                  >
                    <span style={{ color: '#0f172a', whiteSpace: 'pre-wrap' }}>{voiceFinal}</span>
                    <span style={{ color: '#94a3b8', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                      {voiceInterim}
                    </span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage(input);
                      }
                    }}
                    disabled={loading || sessionEnded || voicePhase === 'processing'}
                    placeholder={sessionEnded ? '—' : ui.placeholder}
                    style={{
                      flex: '1 1 0',
                      minWidth: 0,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      fontSize: 15,
                    }}
                  />
                )}
                {micSupported ? (
                  <button
                    type="button"
                    aria-label={
                      voicePhase === 'listening'
                        ? ui.micRecordingAria
                        : voicePhase === 'processing'
                          ? ui.micProcessingAria
                          : ui.micDictateAria
                    }
                    aria-pressed={voicePhase === 'listening'}
                    disabled={loading || sessionEnded || voicePhase === 'processing'}
                    onClick={() => startVoice()}
                    className={voicePhase === 'listening' ? 'chatbotia-mic-recording' : ''}
                    style={{
                      width: 44,
                      minWidth: 44,
                      maxWidth: 44,
                      flexShrink: 0,
                      boxSizing: 'border-box',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      fontSize: 22,
                      cursor:
                        loading || sessionEnded || voicePhase === 'processing' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    🎤
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={
                    loading ||
                    sessionEnded ||
                    voicePhase === 'listening' ||
                    voicePhase === 'processing' ||
                    !input.trim()
                  }
                  onClick={() => void sendMessage(input)}
                  style={{
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    padding: '0 14px',
                    borderRadius: 10,
                    border: 'none',
                    background:
                      loading ||
                      sessionEnded ||
                      voicePhase === 'listening' ||
                      voicePhase === 'processing' ||
                      !input.trim()
                        ? '#94a3b8'
                        : '#4f46e5',
                    color: '#fff',
                    fontWeight: 800,
                    cursor:
                      loading ||
                      sessionEnded ||
                      voicePhase === 'listening' ||
                      voicePhase === 'processing' ||
                      !input.trim()
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {ui.enviar}
                </button>
              </div>
              {(voicePhase === 'listening' || voicePhase === 'processing') && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#b45309' }}
                >
                  {voicePhase === 'listening' ? ui.escuchando : ui.procesando}
                </div>
              )}
              {voiceNotice ? (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: '#c2410c' }}>{voiceNotice}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

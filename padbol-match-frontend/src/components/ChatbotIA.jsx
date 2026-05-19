import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_BOTTOM_NAV_CONTENT_GAP_PX,
  HUB_NAV_HEIGHT_PX,
  isChatbotIAVisiblePathname,
  isHubNavBarHiddenPathname,
  isJugadorHubShellPathname,
  isSedeProfilePathname,
} from '../constants/hubLayout';
import { hasDeportesPreferidosCargados } from '../constants/deportesPreferidos';
import { useTheme } from '../context/ThemeContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

/** Ícono estilo Tabler `ti-microphone` (outline), `currentColor` para heredar color del botón. */
function TablerMicrophoneIcon({ size = 22 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </svg>
  );
}

const MAX_USER_MESSAGES = 6;
/** Por encima de este número de turnos se agrupa por franja (si aplica más de una franja con datos). */
const DISPO_SLOTS_FRANJA_THRESHOLD = 8;
const CHAT_IA_GEO_DENIED_STORAGE_KEY = 'padbol_match_chat_ia_geo_denied';
/** Si el usuario ya abrió el chat desde el FAB: mostrar solo el botón colapsado (logo + etiqueta). */
const CHATBOT_SEEN_STORAGE_KEY = 'chatbot_seen';
const CHATBOT_FAB_EXPAND_MS = 4000;

function readChatbotFabInitiallyCollapsed() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CHATBOT_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

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

/** Minutos desde medianoche a partir de `hora_inicio` (ej. "09:30" o "09:30:00"). */
function horaInicioSlotToMinutes(horaInicio) {
  const str = String(horaInicio || '').trim();
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

/**
 * Franjas según especificación: 🌅 08:00–12:59, ☀️ 13:00–17:59, 🌙 18:00–23:59.
 * Horas fuera de 08–24 se asignan a la franja más cercana para no perder chips.
 */
function slotFranjaKey(horaInicio) {
  const min = horaInicioSlotToMinutes(horaInicio);
  if (min == null) return 'manana';
  if (min < 8 * 60) return 'manana';
  if (min <= 12 * 60 + 59) return 'manana';
  if (min <= 17 * 60 + 59) return 'tarde';
  return 'noche';
}

function groupDisponibilidadSlotsByFranja(slots) {
  const out = { manana: [], tarde: [], noche: [] };
  if (!Array.isArray(slots)) return out;
  for (const s of slots) {
    const k = slotFranjaKey(s?.hora_inicio);
    out[k].push(s);
  }
  return out;
}

const FRANJA_KEYS = ['manana', 'tarde', 'noche'];

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

/** Etiqueta corta para chips de elección de deporte (slug canónico del backend). */
function deporteSlugDisplayLabel(slug, loc) {
  const s = String(slug || '').trim().toLowerCase();
  const l = normalizeUiLocale(loc);
  const maps = {
    es: {
      padbol: 'Padbol',
      padel: 'Pádel',
      tenis: 'Tenis',
      pickleball: 'Pickleball',
      squash: 'Squash',
      futbol_5: 'Fútbol 5',
      futbol_7: 'Fútbol 7',
    },
    en: {
      padbol: 'Padbol',
      padel: 'Padel',
      tenis: 'Tennis',
      pickleball: 'Pickleball',
      squash: 'Squash',
      futbol_5: 'Football 5',
      futbol_7: 'Football 7',
    },
    pt: {
      padbol: 'Padbol',
      padel: 'Padel',
      tenis: 'Tênis',
      pickleball: 'Pickleball',
      squash: 'Squash',
      futbol_5: 'Futebol 5',
      futbol_7: 'Futebol 7',
    },
  };
  const m = maps[l] || maps.es;
  return m[s] || s.replace(/_/g, ' ');
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
      fabLine1: 'Any questions?',
      fabLine2: 'Chat with Padbol Match',
      titulo: 'Padbol Match IA',
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
      ttsDetener: '⏹ Stop',
      errMicDenied: 'Microphone permission denied. Enable it in the browser and try again.',
      errVoiceStart: 'Could not start speech recognition.',
      slotsDisponiblesTitulo: 'Free slots (tap to book):',
      deportesElegirTitulo: 'Sports at this club (tap one):',
      deporteElegirLabel: (slug) => deporteSlugDisplayLabel(slug, l),
      franjaManana: '🌅 Morning',
      franjaTarde: '☀️ Afternoon',
      franjaNoche: '🌙 Evening',
      welcomeAssistant: (firstName) => {
        const n = String(firstName || '').trim();
        const lead = n ? `Hi ${n} 👋` : 'Hi 👋';
        return `${lead} I'm your assistant. I can help you book a court, find a game nearby, or check tournaments. What do you need?`;
      },
      welcomeDeportesHint:
        'By the way, if you tell me which sports you play I can help you better 🎯',
      quickSuggestions: [
        { label: "See today's court times ⚽" },
        { label: 'Find a game nearby 🔍', to: '/jugar/buscar' },
        { label: 'Available tournaments 🏆', to: '/competir' },
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
      fabLine1: 'Tem dúvidas?',
      fabLine2: 'Fale com o Padbol Match',
      titulo: 'Padbol Match IA',
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
      ttsDetener: '⏹ Parar',
      errMicDenied: 'Permissão do microfone negada. Ative no navegador e tente de novo.',
      errVoiceStart: 'Não foi possível iniciar o reconhecimento de voz.',
      slotsDisponiblesTitulo: 'Horários livres (toque para reservar):',
      deportesElegirTitulo: 'Esportes neste clube (toque em um):',
      deporteElegirLabel: (slug) => deporteSlugDisplayLabel(slug, l),
      franjaManana: '🌅 Manhã',
      franjaTarde: '☀️ Tarde',
      franjaNoche: '🌙 Noite',
      welcomeAssistant: (firstName) => {
        const n = String(firstName || '').trim();
        const lead = n ? `Olá ${n} 👋` : 'Olá 👋';
        return `${lead} Sou seu assistente. Posso ajudar a reservar quadra, buscar partida perto ou consultar torneios. O que você precisa?`;
      },
      welcomeDeportesHint:
        'Ah, e se você me disser quais esportes pratica posso ajudar melhor 🎯',
      quickSuggestions: [
        { label: 'Ver horários hoje ⚽' },
        { label: 'Buscar partida perto 🔍', to: '/jugar/buscar' },
        { label: 'Torneios disponíveis 🏆', to: '/competir' },
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
    fabLine1: '¿Tenés dudas?',
    fabLine2: 'Hablá con Padbol Match',
    titulo: 'Padbol Match IA',
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
    ttsDetener: '⏹ Detener',
    errMicDenied: 'Permiso de micrófono denegado. Activa el permiso en el navegador e intenta de nuevo.',
    errVoiceStart: 'No se pudo iniciar el reconocimiento de voz.',
    slotsDisponiblesTitulo: 'Turnos libres (toca para reservar):',
    deportesElegirTitulo: 'Deportes en esta sede (toca uno):',
    deporteElegirLabel: (slug) => deporteSlugDisplayLabel(slug, l),
    franjaManana: '🌅 Mañana',
    franjaTarde: '☀️ Tarde',
    franjaNoche: '🌙 Noche',
    welcomeAssistant: (firstName) => {
      const n = String(firstName || '').trim();
      const lead = n ? `Hola ${n} 👋` : 'Hola 👋';
      return `${lead} Soy tu asistente. Puedo ayudarte a reservar cancha, buscar partido o consultar torneos. ¿Qué necesitas?`;
    },
    welcomeDeportesHint:
      'Por cierto, si me cuentas qué deportes practicas te puedo ayudar mejor 🎯',
    quickSuggestions: [
      { label: 'Ver horarios hoy ⚽' },
      { label: 'Buscar partido cerca 🔍', to: '/jugar/buscar' },
      { label: 'Torneos disponibles 🏆', to: '/competir' },
      { label: 'Reservar cancha 📅' },
    ],
  };
}

/** Paleta del modal del asistente (inline styles; alineado a gray-900/800/700 en oscuro). */
function getChatbotModalTheme(isDark) {
  if (isDark) {
    return {
      panelBg: '#111827',
      borderHairline: '#374151',
      headerBg: 'linear-gradient(135deg,#1f2937,#111827)',
      titleColor: '#ffffff',
      closeColor: '#9ca3af',
      scrollBg: '#111827',
      welcomeBg: '#1f2937',
      welcomeColor: '#ffffff',
      assistantBg: '#1f2937',
      assistantColor: '#ffffff',
      userBg: '#E11B22',
      userColor: '#ffffff',
      secondaryLabel: '#9ca3af',
      chipBg: '#1f2937',
      chipBorder: '#4b5563',
      chipColor: '#ffffff',
      franjaInactiveBg: '#1f2937',
      franjaActiveBg: '#374151',
      franjaBorderActive: '#E11B22',
      franjaBorderInactive: '#4b5563',
      franjaCount: '#9ca3af',
      franjaText: '#ffffff',
      slotBg: 'rgba(229, 57, 53, 0.125)',
      slotColor: '#e53935',
      slotBorder: '#e53935',
      loadingColor: '#9ca3af',
      errorColor: '#fca5a5',
      footerTopBorder: '#374151',
      readAloudColor: '#9ca3af',
      inputBg: '#1f2937',
      inputColor: '#ffffff',
      inputBorder: '#4b5563',
      micBg: '#1f2937',
      micBorder: '#4b5563',
      dictationBg: '#1f2937',
      dictationBorder: '#4b5563',
      dictationSolid: '#ffffff',
      dictationInterim: '#9ca3af',
      iosTapBg: '#1f2937',
      iosTapColor: '#ffffff',
      iosTapBorder: '#4b5563',
      hintIos: '#9ca3af',
      voiceStatus: '#fbbf24',
      voiceNotice: '#fdba74',
      reservaCtaBg: '#E11B22',
      limitePrimaryCta: '#E11B22',
      sessionBoxBg: '#422006',
      sessionBoxBorder: '#b45309',
      sessionBoxText: '#fcd34d',
      nuevaConsultaBg: 'transparent',
      nuevaConsultaBorder: '#ca8a04',
      nuevaConsultaText: '#fcd34d',
      stopTtsBg: '#450a0a',
      stopTtsBorder: '#991b1b',
      stopTtsColor: '#fecaca',
      waEscalada: '#128C7E',
    };
  }
  return {
    panelBg: '#fff',
    borderHairline: '#e2e8f0',
    headerBg: 'linear-gradient(135deg,#eef2ff,#fff)',
    titleColor: '#1e293b',
    closeColor: '#64748b',
    scrollBg: 'transparent',
    welcomeBg: '#f1f5f9',
    welcomeColor: '#0f172a',
    assistantBg: '#f1f5f9',
    assistantColor: '#0f172a',
    userBg: '#E11B22',
    userColor: '#fff',
    secondaryLabel: '#475569',
    chipBg: '#fff',
    chipBorder: '#cbd5e1',
    chipColor: '#0f172a',
    franjaInactiveBg: '#fff',
    franjaActiveBg: '#eef2ff',
    franjaBorderActive: '#E11B22',
    franjaBorderInactive: '#cbd5e1',
    franjaCount: '#64748b',
    franjaText: '#0f172a',
    slotBg: 'rgba(229, 57, 53, 0.125)',
    slotColor: '#e53935',
    slotBorder: '#e53935',
    loadingColor: '#64748b',
    errorColor: '#b91c1c',
    footerTopBorder: '#e2e8f0',
    readAloudColor: '#64748b',
    inputBg: '#ffffff',
    inputColor: '#0f172a',
    inputBorder: '#cbd5e1',
    micBg: '#fff',
    micBorder: '#cbd5e1',
    dictationBg: '#fafafa',
    dictationBorder: '#cbd5e1',
    dictationSolid: '#0f172a',
    dictationInterim: '#94a3b8',
    iosTapBg: '#f8fafc',
    iosTapColor: '#0f172a',
    iosTapBorder: '#cbd5e1',
    hintIos: '#94a3b8',
    voiceStatus: '#b45309',
    voiceNotice: '#c2410c',
    reservaCtaBg: '#E11B22',
    limitePrimaryCta: '#E11B22',
    sessionBoxBg: '#fef3c7',
    sessionBoxBorder: '#fcd34d',
    sessionBoxText: '#78350f',
    nuevaConsultaBg: '#fffbeb',
    nuevaConsultaBorder: '#ca8a04',
    nuevaConsultaText: '#92400e',
    stopTtsBg: '#fef2f2',
    stopTtsBorder: '#fecaca',
    stopTtsColor: '#991b1b',
    waEscalada: '#128C7E',
  };
}

function QuickSuggestionBar({ items, disabled, onPick, isDark }) {
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
          onClick={() => onPick(q)}
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxHeight: 32,
            padding: '6px 12px',
            boxSizing: 'border-box',
            borderRadius: 9999,
            border: isDark ? '1px solid #4b5563' : '1px solid #d1d5f8',
            background: isDark ? '#374151' : 'transparent',
            color: isDark ? '#ffffff' : '#64748b',
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
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { navDock } = useHubNavLayout();
  const { session, userProfile, refreshSession } = useAuth();
  const { theme } = useTheme();
  const c = useMemo(() => getChatbotModalTheme(theme === 'dark'), [theme]);
  const [open, setOpen] = useState(false);
  const [fabCollapsed, setFabCollapsed] = useState(readChatbotFabInitiallyCollapsed);
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
  /** True mientras `speechSynthesis` está reproduciendo la última respuesta del asistente. */
  const [ttsPlaying, setTtsPlaying] = useState(false);
  /** Despliegue por franja de turnos (índice del mensaje + franja) cuando hay >8 slots y varias franjas. */
  const [dispSlotsFranja, setDispSlotsFranja] = useState(null);
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
  const clientGeoRef = useRef(null);

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

  const clientPaginaSedeId = useMemo(() => {
    const path = (location.pathname || '').split('?')[0] || '';
    const mSede = path.match(/^\/sede\/(\d+)\/?$/i);
    if (mSede) {
      const id = parseInt(mSede[1], 10);
      if (Number.isFinite(id) && id > 0) return id;
    }
    if (path === '/reservar') {
      const sp = new URLSearchParams(location.search || '');
      const q = sp.get('sedeId');
      const id = q != null && String(q).trim() !== '' ? parseInt(String(q).trim(), 10) : NaN;
      if (Number.isFinite(id) && id > 0) return id;
    }
    return null;
  }, [location.pathname, location.search]);

  const hubShell = useMemo(() => {
    const p = location.pathname.split('?')[0] || '/';
    return isJugadorHubShellPathname(p) || isSedeProfilePathname(p) || p === '/' || p === '/hub' || p === '/inicio' || p === '/home';
  }, [location.pathname]);

  const fabBottom = useMemo(() => {
    const pathOnly = (location.pathname || '').split('?')[0] || '/';
    const bottomNavShown = !isHubNavBarHiddenPathname(pathOnly);
    const liftForBottomNav =
      bottomNavShown && navDock === 'bottom'
        ? `(${HUB_NAV_HEIGHT_PX}px + ${HUB_BOTTOM_NAV_CONTENT_GAP_PX}px + env(safe-area-inset-bottom, 0px))`
        : 'env(safe-area-inset-bottom, 0px)';
    if (hubShell) {
      return `calc(${liftForBottomNav} + ${HUB_CONTENT_PADDING_BOTTOM_PX}px + 8px)`;
    }
    return `calc(16px + ${liftForBottomNav})`;
  }, [hubShell, location.pathname, navDock]);

  useEffect(() => {
    if (!visible) return undefined;
    if (fabCollapsed) return undefined;
    const tid = window.setTimeout(() => setFabCollapsed(true), CHATBOT_FAB_EXPAND_MS);
    return () => window.clearTimeout(tid);
  }, [visible, fabCollapsed]);

  const openChatFromFab = useCallback(() => {
    try {
      window.localStorage.setItem(CHATBOT_SEEN_STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setFabCollapsed(true);
    setOpen(true);
    setError('');
    setVoiceNotice('');
  }, []);

  useEffect(() => {
    if (!open) return;
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages, loading, error, showQuickSuggestionBar]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    try {
      if (window.localStorage.getItem(CHAT_IA_GEO_DENIED_STORAGE_KEY) === '1') return;
    } catch {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
        clientGeoRef.current = {
          latitud: la,
          longitud: lo,
          precision_m:
            pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy)
              ? Math.round(pos.coords.accuracy)
              : null,
        };
      },
      () => {
        try {
          window.localStorage.setItem(CHAT_IA_GEO_DENIED_STORAGE_KEY, '1');
        } catch {
          /* ignore */
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }, [open]);

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

  useEffect(
    () => () => {
      try {
        window.speechSynthesis?.cancel?.();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const speakAssistantReply = useCallback((text) => {
    if (!ttsSupported || typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!readAloudRef.current) return;
    const t = String(text || '').trim();
    if (!t) return;
    try {
      window.speechSynthesis.cancel();
      setTtsPlaying(false);
      const utter = new SpeechSynthesisUtterance(t);
      utter.onend = () => setTtsPlaying(false);
      utter.onerror = () => setTtsPlaying(false);
      utter.lang = bcp47LangForAssistantTts(t);
      utter.rate = 0.92;
      setTtsPlaying(true);
      window.speechSynthesis.speak(utter);
    } catch {
      setTtsPlaying(false);
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
            ...(clientPaginaSedeId != null ? { client_pagina_sede_id: clientPaginaSedeId } : {}),
            ...(clientGeoRef.current &&
            Number.isFinite(Number(clientGeoRef.current.latitud)) &&
            Number.isFinite(Number(clientGeoRef.current.longitud))
              ? { client_geolocalizacion: clientGeoRef.current }
              : {}),
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
        const dispRaw = data.disponibilidad;
        let disp = null;
        if (dispRaw && dispRaw.sede_id != null && dispRaw.fecha) {
          const slots = Array.isArray(dispRaw.slots) ? dispRaw.slots : [];
          const depEl = Array.isArray(dispRaw.deportes_eleccion)
            ? dispRaw.deportes_eleccion
                .map((d) => String(d || '').trim().toLowerCase())
                .filter(Boolean)
            : [];
          if (slots.length > 0 || depEl.length > 0) {
            disp = {
              sede_id: Number(dispRaw.sede_id),
              sede_nombre: String(dispRaw.sede_nombre || '').trim(),
              fecha: String(dispRaw.fecha).slice(0, 10),
              duracion_minutos: dispRaw.duracion_minutos,
              deporte_filtro:
                dispRaw.deporte_filtro != null && String(dispRaw.deporte_filtro).trim()
                  ? String(dispRaw.deporte_filtro).trim()
                  : null,
              slots,
              deportes_eleccion: depEl.length ? depEl : null,
            };
          }
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: reply, disponibilidad: disp }]);
        if (data.reserve?.href) setLastReserve(data.reserve);
        const sc = data.sede_contexto;
        if (sc && sc.id != null && Number.isFinite(Number(sc.id)) && Number(sc.id) > 0) {
          setSedeContextoTurno({ id: Number(sc.id), nombre: String(sc.nombre || '').trim() });
        } else {
          setSedeContextoTurno(null);
        }
        if (data.whatsapp_escalada?.href) setWhatsappEscalada(data.whatsapp_escalada);
        if (data.deporte_aprendido) {
          void refreshSession();
        }
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
      clientPaginaSedeId,
      primeSpeechSynthesisFromUserGesture,
      scheduleAssistantSpeak,
      refreshSession,
    ]
  );

  const handleQuickSuggestion = useCallback(
    (item) => {
      const to = item && typeof item.to === 'string' ? item.to.trim() : '';
      if (to) {
        setOpen(false);
        navigate(to);
        return;
      }
      const label = item && item.label != null ? String(item.label).trim() : '';
      if (label) void sendMessage(label);
    },
    [navigate, sendMessage],
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
    setTtsPlaying(false);
    setDispSlotsFranja(null);
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
      <div
        className="chatbot-fab-anchor"
        style={{
          bottom: fabBottom,
        }}
      >
        <button
          type="button"
          aria-label={ui.fabOpen}
          onClick={openChatFromFab}
          style={
            fabCollapsed
              ? {
                  pointerEvents: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: 0,
                  margin: 0,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease',
                }
              : {
                  pointerEvents: 'auto',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--accent)',
                  color: '#fff',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease',
                  borderRadius: 28,
                  width: 280,
                  height: 'auto',
                  minHeight: 48,
                  padding: '10px 16px 10px 10px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  overflow: 'hidden',
                }
          }
        >
          {fabCollapsed ? (
            <>
              <span
                aria-hidden
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  flexShrink: 0,
                }}
              >
                <img
                  src="/logo-padbol-match.png"
                  alt=""
                  width={32}
                  height={32}
                  style={{ display: 'block', width: 32, height: 32, objectFit: 'contain' }}
                />
              </span>
              <span
                style={{
                  color: '#fff',
                  background: 'var(--accent)',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '3px 10px',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                ¿Consultas?
              </span>
            </>
          ) : (
            <>
              <span
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#fff',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src="/logo-padbol-match.png"
                  alt=""
                  width={26}
                  height={26}
                  style={{ display: 'block', width: 26, height: 26, objectFit: 'contain' }}
                  aria-hidden
                />
              </span>
              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{ui.fabLine1}</span>
                <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, lineHeight: 1.25, marginTop: 2, whiteSpace: 'nowrap' }}>
                  {ui.fabLine2}
                </span>
              </span>
            </>
          )}
        </button>
      </div>

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
            className={theme === 'dark' ? 'chatbotia-modal--dark' : undefined}
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: 'min(88vh, 640px)',
              background: c.panelBg,
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
                  background: #e11b22;
                  transform-origin: bottom center;
                  animation: chatbotia-voice-bar 0.55s ease-in-out infinite;
                }
                .chatbotia-voice-bars span:nth-child(1) { animation-delay: 0ms; }
                .chatbotia-voice-bars span:nth-child(2) { animation-delay: 90ms; }
                .chatbotia-voice-bars span:nth-child(3) { animation-delay: 180ms; }
                .chatbotia-voice-bars span:nth-child(4) { animation-delay: 120ms; }
                .chatbotia-voice-bars span:nth-child(5) { animation-delay: 60ms; }
                .chatbotia-modal--dark input::placeholder {
                  color: #9ca3af;
                  opacity: 1;
                }
                .chatbotia-modal--dark input {
                  caret-color: #ffffff;
                }
              `}
            </style>
            <div
              style={{
                padding: '12px 14px',
                borderBottom: `1px solid ${c.borderHairline}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                background: c.headerBg,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <div
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#e53935',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 12,
                    letterSpacing: '-0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  PM
                </div>
                <span
                  style={{
                    fontWeight: 500,
                    fontSize: 16,
                    color: c.titleColor,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Padbol Match IA
                </span>
                <span
                  aria-hidden
                  title="En línea"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#4caf50',
                    flexShrink: 0,
                    marginLeft: 2,
                  }}
                />
              </div>
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
                  color: c.closeColor,
                  padding: 4,
                  flexShrink: 0,
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
                background: c.scrollBg,
              }}
            >
              {messages.length === 0 ? (
                <div style={{ alignSelf: 'flex-start', maxWidth: '92%', width: '100%' }}>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: c.welcomeBg,
                      color: c.welcomeColor,
                      fontSize: 14,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {(() => {
                      const base = ui.welcomeAssistant(chatWelcomeFirstName);
                      const hasPrefs = hasDeportesPreferidosCargados(userProfile?.deportes_preferidos);
                      const hint =
                        session?.user && !hasPrefs && ui.welcomeDeportesHint
                          ? `\n\n${ui.welcomeDeportesHint}`
                          : '';
                      return base + hint;
                    })()}
                  </div>
                </div>
              ) : null}
              {showQuickSuggestionBar && messages.length === 0 ? (
                <QuickSuggestionBar
                  items={ui.quickSuggestions}
                  disabled={loading || sessionEnded}
                  onPick={handleQuickSuggestion}
                  isDark={theme === 'dark'}
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
                      background: m.role === 'user' ? c.userBg : c.assistantBg,
                      color: m.role === 'user' ? c.userColor : c.assistantColor,
                      fontSize: 14,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' &&
                  Array.isArray(m.disponibilidad?.deportes_eleccion) &&
                  m.disponibilidad.deportes_eleccion.length ? (
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        maxWidth: '92%',
                        marginTop: -2,
                        marginBottom: 2,
                        padding: '0 2px 8px',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: c.secondaryLabel, marginBottom: 6 }}>
                        {ui.deportesElegirTitulo}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {m.disponibilidad.deportes_eleccion.map((slug) => (
                          <button
                            key={`${i}-dep-${slug}`}
                            type="button"
                            disabled={loading || sessionEnded}
                            onClick={() => void sendMessage(slug)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: `1px solid ${c.chipBorder}`,
                              background: c.chipBg,
                              color: c.chipColor,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: loading || sessionEnded ? 'not-allowed' : 'pointer',
                              opacity: loading || sessionEnded ? 0.55 : 1,
                              WebkitTapHighlightColor: 'transparent',
                            }}
                          >
                            {ui.deporteElegirLabel(slug)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {m.role === 'assistant' && m.disponibilidad?.slots?.length ? (() => {
                    const disp = m.disponibilidad;
                    const slots = disp.slots;
                    const n = slots.length;
                    const groups = groupDisponibilidadSlotsByFranja(slots);
                    const keysWithSlots = FRANJA_KEYS.filter((k) => groups[k].length > 0);
                    const useFranjaNav =
                      n > DISPO_SLOTS_FRANJA_THRESHOLD && keysWithSlots.length > 1;
                    const franjaAbierta =
                      dispSlotsFranja?.messageIndex === i ? dispSlotsFranja.franja : null;
                    const listado = useFranjaNav
                      ? franjaAbierta
                        ? groups[franjaAbierta]
                        : []
                      : slots;

                    return (
                      <div
                        style={{
                          alignSelf: 'flex-start',
                          maxWidth: '92%',
                          marginTop: -2,
                          marginBottom: 2,
                          padding: '0 2px 8px',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: c.secondaryLabel, marginBottom: 6 }}>
                          {ui.slotsDisponiblesTitulo}
                        </div>
                        {useFranjaNav ? (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 6,
                              marginBottom: listado.length ? 6 : 0,
                            }}
                          >
                            {keysWithSlots.map((k) => {
                              const active = franjaAbierta === k;
                              const label =
                                k === 'manana' ? ui.franjaManana : k === 'tarde' ? ui.franjaTarde : ui.franjaNoche;
                              return (
                                <button
                                  key={`${i}-franja-${k}`}
                                  type="button"
                                  onClick={() =>
                                    setDispSlotsFranja((prev) =>
                                      prev?.messageIndex === i && prev?.franja === k
                                        ? null
                                        : { messageIndex: i, franja: k },
                                    )
                                  }
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: active ? `2px solid ${c.franjaBorderActive}` : `1px solid ${c.franjaBorderInactive}`,
                                    background: active ? c.franjaActiveBg : c.franjaInactiveBg,
                                    color: c.franjaText,
                                    fontWeight: 700,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    WebkitTapHighlightColor: 'transparent',
                                  }}
                                >
                                  {label}{' '}
                                  <span style={{ color: c.franjaCount, fontWeight: 700 }}>({groups[k].length})</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {listado.map((s, j) => {
                            const sid = disp.sede_id;
                            const fe = disp.fecha;
                            const det = Array.isArray(s.canchas_detalle) ? s.canchas_detalle : [];
                            const nLibresRaw = Number(s.canchas_libres);
                            const nLibres =
                              Number.isFinite(nLibresRaw) && nLibresRaw > 0
                                ? nLibresRaw
                                : Math.max(1, det.length);
                            const hora = String(s.hora_inicio || '').trim();
                            const chipText = hora ? `${hora} · ${nLibres}` : String(nLibres);
                            const href = `/reservar?sedeId=${encodeURIComponent(String(sid))}&fecha=${encodeURIComponent(fe)}&hora=${encodeURIComponent(s.hora_inicio)}`;
                            return (
                              <Link
                                key={`${i}-slot-${String(s.hora_inicio || '')}-${j}`}
                                to={href}
                                onClick={() => setOpen(false)}
                                style={{
                                  display: 'inline-block',
                                  padding: '5px 9px',
                                  borderRadius: 8,
                                  background: c.slotBg,
                                  color: c.slotColor,
                                  fontWeight: 700,
                                  fontSize: 12,
                                  textDecoration: 'none',
                                  border: `0.5px solid ${c.slotBorder}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {chipText}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })() : null}
                  {m.role === 'assistant' && showQuickSuggestionBar && i === lastAssistantIndex ? (
                    <QuickSuggestionBar
                      items={ui.quickSuggestions}
                      disabled={loading || sessionEnded}
                      onPick={handleQuickSuggestion}
                      isDark={theme === 'dark'}
                    />
                  ) : null}
                </React.Fragment>
              ))}
              {loading ? (
                <div style={{ color: c.loadingColor, fontSize: 13, fontWeight: 600 }}>{ui.escribiendo}</div>
              ) : null}
              {error ? (
                <div style={{ color: c.errorColor, fontSize: 13, fontWeight: 600 }}>{error}</div>
              ) : null}
              {sessionEnded ? (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: c.sessionBoxBg,
                    border: `1px solid ${c.sessionBoxBorder}`,
                    color: c.sessionBoxText,
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
                        background: c.limitePrimaryCta,
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
                        border: `1px solid ${c.nuevaConsultaBorder}`,
                        borderRadius: 10,
                        padding: '10px 16px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        background: c.nuevaConsultaBg,
                        color: c.nuevaConsultaText,
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
                    background: c.reservaCtaBg,
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
                    background: c.waEscalada,
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

            <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${c.footerTopBorder}`, background: c.panelBg }}>
              {ttsSupported ? (
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: c.readAloudColor }}
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
                        setTtsPlaying(false);
                      }
                    }}
                  />
                  {ui.leerVozAlta}
                </label>
              ) : null}
              {ttsSupported && ttsPlaying ? (
                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        window.speechSynthesis?.cancel?.();
                      } catch {
                        /* ignore */
                      }
                      setTtsPlaying(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${c.stopTtsBorder}`,
                      background: c.stopTtsBg,
                      color: c.stopTtsColor,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {ui.ttsDetener}
                  </button>
                </div>
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
                      border: `1px solid ${c.iosTapBorder}`,
                      background: c.iosTapBg,
                      color: c.iosTapColor,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {ui.escucharUltimaIos}
                  </button>
                  <div style={{ marginTop: 4, fontSize: 11, color: c.hintIos, lineHeight: 1.35 }}>
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
                  display: 'grid',
                  width: '100%',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  gap: 8,
                  alignItems: 'center',
                  gridTemplateColumns: (() => {
                    if (voicePhase === 'listening') {
                      return micSupported ? 'minmax(0, 1fr) 44px' : 'minmax(0, 1fr)';
                    }
                    return micSupported ? 'minmax(0, 1fr) 44px auto' : 'minmax(0, 1fr) auto';
                  })(),
                }}
              >
                {voicePhase === 'listening' ? (
                  <div
                    role="status"
                    aria-live="polite"
                    aria-relevant="additions text"
                    style={{
                      minWidth: 0,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${c.dictationBorder}`,
                      fontSize: 16,
                      minHeight: 44,
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      background: c.dictationBg,
                    }}
                  >
                    <span style={{ color: c.dictationSolid, whiteSpace: 'pre-wrap' }}>{voiceFinal}</span>
                    <span style={{ color: c.dictationInterim, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
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
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      padding: '10px 16px',
                      borderRadius: 99,
                      border: `1px solid ${c.inputBorder}`,
                      fontSize: 16,
                      lineHeight: 1.25,
                      minHeight: 44,
                      WebkitTapHighlightColor: 'transparent',
                      background: c.inputBg,
                      color: c.inputColor,
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      startVoice();
                    }}
                    className={voicePhase === 'listening' ? 'chatbotia-mic-recording' : ''}
                    style={{
                      width: 44,
                      height: 44,
                      minWidth: 44,
                      maxWidth: 44,
                      minHeight: 44,
                      maxHeight: 44,
                      padding: 0,
                      margin: 0,
                      justifySelf: 'center',
                      boxSizing: 'border-box',
                      borderRadius: 10,
                      border: `1px solid ${c.micBorder}`,
                      background: c.micBg,
                      color: c.inputColor,
                      fontSize: 22,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor:
                        loading || sessionEnded || voicePhase === 'processing' ? 'not-allowed' : 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                  >
                    <TablerMicrophoneIcon size={22} />
                  </button>
                ) : null}
                {voicePhase !== 'listening' ? (
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
                      justifySelf: 'end',
                      whiteSpace: 'nowrap',
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: 'none',
                      fontSize: 15,
                      background:
                        loading ||
                        sessionEnded ||
                        voicePhase === 'listening' ||
                        voicePhase === 'processing' ||
                        !input.trim()
                          ? '#94a3b8'
                          : '#E11B22',
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
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                  >
                    {ui.enviar}
                  </button>
                ) : null}
              </div>
              {(voicePhase === 'listening' || voicePhase === 'processing') && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: c.voiceStatus }}
                >
                  {voicePhase === 'listening' ? ui.escuchando : ui.procesando}
                </div>
              )}
              {voiceNotice ? (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: c.voiceNotice }}>{voiceNotice}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

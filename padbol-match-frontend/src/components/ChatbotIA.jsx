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

function chatUiStrings(loc) {
  const l = normalizeUiLocale(loc);
  if (l === 'en') {
    return {
      escribiendo: 'Writing…',
      procesando: 'Processing…',
      enviar: 'Send',
      placeholder: 'Ask something…',
      waEscalada: 'Contact the club on WhatsApp',
      waClub: 'Message your usual club',
      fabOpen: 'Open Padbol Match assistant',
      titulo: 'Assistant',
      cargando: 'Loading…',
    };
  }
  if (l === 'pt') {
    return {
      escribiendo: 'Escrevendo…',
      procesando: 'Processando…',
      enviar: 'Enviar',
      placeholder: 'Escreva sua pergunta…',
      waEscalada: 'Falar com o clube no WhatsApp',
      waClub: 'Escrever ao clube habitual',
      fabOpen: 'Abrir assistente Padbol Match',
      titulo: 'Assistente',
      cargando: 'Carregando…',
    };
  }
  return {
    escribiendo: 'Escribiendo…',
    procesando: 'Procesando…',
    enviar: 'Enviar',
    placeholder: 'Escribe tu pregunta…',
    waEscalada: 'Contactar al club por WhatsApp',
    waClub: 'Escribir al club habitual',
    fabOpen: 'Abrir asistente Padbol Match',
    titulo: 'Asistente Padbol',
    cargando: 'Cargando…',
  };
}

export default function ChatbotIA() {
  const location = useLocation();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionEnded, setSessionEnded] = useState(false);
  /** idle: sin dictado; listening: grabando; processing: entre fin de voz y envío al API */
  const [voicePhase, setVoicePhase] = useState('idle');
  const [readAloud, setReadAloud] = useState(false);
  const [lastReserve, setLastReserve] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [whatsappEscalada, setWhatsappEscalada] = useState(null);
  const recRef = useRef(null);
  const listEndRef = useRef(null);
  const readAloudRef = useRef(readAloud);
  const voiceSendTimerRef = useRef(null);

  const micSupported = useMemo(() => isSpeechRecognitionAvailable(), []);
  const ttsSupported = useMemo(() => isSpeechSynthesisAvailable(), []);
  const isLikelyIOSWebKit = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  useEffect(() => {
    readAloudRef.current = readAloud;
  }, [readAloud]);

  const deviceLocale = useMemo(
    () => (typeof navigator !== 'undefined' ? navigator.language || 'es' : 'es'),
    [],
  );
  const ui = useMemo(() => chatUiStrings(deviceLocale), [deviceLocale]);
  const speechRecLang = useMemo(() => {
    const l = String(deviceLocale || 'es').toLowerCase();
    if (l.startsWith('en')) return 'en-US';
    if (l.startsWith('pt')) return 'pt-BR';
    if (l.startsWith('fr')) return 'fr-FR';
    if (l.startsWith('de')) return 'de-DE';
    if (l.startsWith('it')) return 'it-IT';
    return 'es-AR';
  }, [deviceLocale]);
  const ttsUtterLang = useMemo(() => {
    const l = String(deviceLocale || 'es').trim();
    return l.length >= 2 ? l : 'es-AR';
  }, [deviceLocale]);

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
  }, [open, messages, loading, error]);

  useEffect(() => {
    if (!open) return;
    let canceled = false;
    (async () => {
      try {
        const headers = {};
        const { data: sess } = await supabase.auth.getSession();
        const tok = sess?.session?.access_token;
        if (tok) headers.Authorization = `Bearer ${tok}`;
        const loc = typeof navigator !== 'undefined' ? navigator.language || 'es' : 'es';
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
  }, [open, session?.user?.id]);

  const userMessageCount = useMemo(() => messages.filter((m) => m.role === 'user').length, [messages]);

  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') return String(messages[i].content || '').trim();
    }
    return '';
  }, [messages]);

  const stopRecognition = useCallback(() => {
    if (voiceSendTimerRef.current != null) {
      window.clearTimeout(voiceSendTimerRef.current);
      voiceSendTimerRef.current = null;
    }
    try {
      recRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setVoicePhase('idle');
  }, []);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  const speakAssistantReply = useCallback((text) => {
    if (!ttsSupported || typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!readAloudRef.current) return;
    const t = String(text || '').trim();
    if (!t) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(t);
      utter.lang = ttsUtterLang;
      utter.rate = 0.92;
      window.speechSynthesis.speak(utter);
    } catch {
      /* ignore */
    }
  }, [ttsSupported, ttsUtterLang]);
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
      setLoading(true);
      setLastReserve(null);
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
            locale: deviceLocale,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.limit_reached) setSessionEnded(true);
          throw new Error(data.error || res.statusText || 'Error');
        }
        const reply = String(data.respuesta || '').trim() || 'Sin respuesta.';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        if (data.reserve?.href) setLastReserve(data.reserve);
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
      deviceLocale,
    ]
  );

  const startVoice = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !micSupported) return;
    if (voicePhase === 'processing' || loading || sessionEnded) return;
    if (voicePhase === 'listening') {
      stopRecognition();
      return;
    }
    setError('');
    primeSpeechSynthesisFromUserGesture();
    const rec = new Ctor();
    rec.lang = speechRecLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      if (voiceSendTimerRef.current != null) {
        window.clearTimeout(voiceSendTimerRef.current);
        voiceSendTimerRef.current = null;
      }
      const transcript = Array.from(ev.results || [])
        .map((r) => r[0]?.transcript)
        .filter(Boolean)
        .join(' ')
        .trim();
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      if (recRef.current === rec) recRef.current = null;
      if (!transcript) {
        setVoicePhase('idle');
        return;
      }
      setVoicePhase('processing');
      voiceSendTimerRef.current = window.setTimeout(() => {
        voiceSendTimerRef.current = null;
        void sendMessage(transcript);
      }, VOICE_POST_TRANSCRIPT_MS);
    };
    rec.onerror = () => {
      if (voiceSendTimerRef.current != null) {
        window.clearTimeout(voiceSendTimerRef.current);
        voiceSendTimerRef.current = null;
      }
      setError('No se pudo usar el micrófono. Revisa permisos o intenta de nuevo.');
      setVoicePhase('idle');
      if (recRef.current === rec) recRef.current = null;
    };
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      setVoicePhase((prev) => (prev === 'listening' ? 'idle' : prev));
    };
    recRef.current = rec;
    setVoicePhase('listening');
    try {
      rec.start();
    } catch {
      setVoicePhase('idle');
      setError('No se pudo iniciar el reconocimiento de voz.');
    }
  }, [
    voicePhase,
    loading,
    sessionEnded,
    sendMessage,
    micSupported,
    primeSpeechSynthesisFromUserGesture,
    stopRecognition,
    speechRecLang,
  ]);

  const nuevaConsulta = useCallback(() => {
    stopRecognition();
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
    setWhatsappEscalada(null);
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
          fontSize: 26,
          boxShadow: '0 10px 28px rgba(15,23,42,0.35)',
          display: 'grid',
          placeItems: 'center',
          padding: 0,
        }}
      >
        💬
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Asistente Padbol Match"
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
            if (e.target === e.currentTarget) setOpen(false);
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
                onClick={() => setOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: 4,
                }}
                aria-label="Cerrar"
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
                bootstrap ? (
                  <div style={{ color: '#334155', fontSize: 14, lineHeight: 1.55 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 8 }}>
                      {bootstrap.saludo_titulo || ui.titulo}
                    </div>
                    {(bootstrap.saludo_lineas || []).map((line, idx) => (
                      <p
                        key={idx}
                        style={{ margin: idx === 0 ? '0 0 8px' : '0 0 6px', color: idx === 0 ? '#64748b' : '#475569' }}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>{ui.cargando}</p>
                )
              ) : null}
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
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
              ))}
              {loading ? (
                <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{ui.escribiendo}</div>
              ) : null}
              {voicePhase === 'processing' && !loading ? (
                <div role="status" aria-live="polite" style={{ color: '#b45309', fontSize: 13, fontWeight: 700 }}>
                  {ui.procesando}
                </div>
              ) : null}
              {error ? (
                <div style={{ color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>{error}</div>
              ) : null}
              {sessionEnded ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    color: '#92400e',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  Inicia una nueva consulta
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={nuevaConsulta}
                      style={{
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        background: '#ea580c',
                        color: '#fff',
                      }}
                    >
                      Nueva consulta
                    </button>
                  </div>
                </div>
              ) : null}
              {lastReserve?.href ? (
                <Link
                  to={lastReserve.href}
                  onClick={() => setOpen(false)}
                  title={
                    [lastReserve.fecha, lastReserve.hora].filter(Boolean).join(' · ') ||
                    'Abrir formulario de reserva con los datos indicados'
                  }
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
                  Ir a reservar
                  {lastReserve.hora
                    ? ` · ${lastReserve.hora}${lastReserve.fecha ? ` (${lastReserve.fecha})` : ''}`
                    : lastReserve.fecha
                      ? ` · ${lastReserve.fecha}`
                      : ''}
                </Link>
              ) : null}
              {whatsappEscalada?.href ? (
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
              {!whatsappEscalada?.href && bootstrap?.whatsapp_club?.href ? (
                <a
                  href={bootstrap.whatsapp_club.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    alignSelf: 'center',
                    marginTop: 2,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #86efac',
                    background: '#f0fdf4',
                    color: '#166534',
                    fontWeight: 700,
                    fontSize: 12,
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  {ui.waClub}
                  {bootstrap.whatsapp_club.sede_nombre ? ` · ${bootstrap.whatsapp_club.sede_nombre}` : ''}
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
                  Leer respuestas en voz alta
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
                    Escuchar última respuesta (iOS / Safari)
                  </button>
                  <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8', lineHeight: 1.35 }}>
                    En iPhone o iPad el audio puede requerir un toque explícito después de cargar la respuesta.
                  </div>
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
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
                  disabled={loading || sessionEnded}
                  placeholder={sessionEnded ? '—' : ui.placeholder}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 15,
                  }}
                />
                {micSupported ? (
                  <button
                    type="button"
                    aria-label={
                      voicePhase === 'listening'
                        ? 'Grabando, pulsa de nuevo para cancelar'
                        : voicePhase === 'processing'
                          ? 'Procesando dictado'
                          : 'Dictar por voz'
                    }
                    aria-pressed={voicePhase === 'listening'}
                    disabled={loading || sessionEnded || voicePhase === 'processing'}
                    onClick={() => startVoice()}
                    className={voicePhase === 'listening' ? 'chatbotia-mic-recording' : ''}
                    style={{
                      width: 48,
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
                  disabled={loading || sessionEnded || !input.trim()}
                  onClick={() => void sendMessage(input)}
                  style={{
                    padding: '0 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: loading || sessionEnded || !input.trim() ? '#94a3b8' : '#4f46e5',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: loading || sessionEnded || !input.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {ui.enviar}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

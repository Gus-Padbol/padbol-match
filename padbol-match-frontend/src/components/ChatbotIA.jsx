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

export default function ChatbotIA() {
  const location = useLocation();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [listening, setListening] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [lastReserve, setLastReserve] = useState(null);
  const recRef = useRef(null);
  const listEndRef = useRef(null);

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

  const userMessageCount = useMemo(() => messages.filter((m) => m.role === 'user').length, [messages]);

  const stopRecognition = useCallback(() => {
    try {
      recRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  const speakText = useCallback((text) => {
    if (!readAloud || typeof window === 'undefined' || !window.speechSynthesis) return;
    const t = String(text || '').trim();
    if (!t) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'es-419';
      u.rate = 1;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }, [readAloud]);

  const sendMessage = useCallback(
    async (textRaw) => {
      const text = String(textRaw || '').trim();
      if (!text || loading || sessionEnded) return;
      if (userMessageCount >= MAX_USER_MESSAGES) {
        setSessionEnded(true);
        return;
      }

      setError('');
      const historial = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setInput('');
      setLoading(true);
      setLastReserve(null);

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
        const used = Number(data.user_messages_used);
        if (Number.isFinite(used) && used >= MAX_USER_MESSAGES) setSessionEnded(true);
        speakText(reply);
      } catch (e) {
        setMessages((prev) => prev.slice(0, -1));
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [loading, sessionEnded, messages, userMessageCount, session?.user?.id, speakText]
  );

  const startVoice = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('Tu navegador no permite dictado por voz en esta página.');
      return;
    }
    if (listening || loading || sessionEnded) return;
    setError('');
    const rec = new Ctor();
    rec.lang = 'es-AR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const transcript = Array.from(ev.results || [])
        .map((r) => r[0]?.transcript)
        .filter(Boolean)
        .join(' ')
        .trim();
      if (transcript) void sendMessage(transcript);
    };
    rec.onerror = () => {
      setError('No se pudo usar el micrófono. Revisa permisos o intenta de nuevo.');
      setListening(false);
      recRef.current = null;
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setError('No se pudo iniciar el reconocimiento de voz.');
    }
  }, [listening, loading, sessionEnded, sendMessage]);

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
  }, [stopRecognition]);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Abrir asistente Padbol Match"
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
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>Asistente Padbol</div>
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
                <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
                  Pregunta por sedes, precios, torneos o cómo reservar. Máximo {MAX_USER_MESSAGES} mensajes por
                  consulta.
                </p>
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
                <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>Escribiendo…</div>
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
                </Link>
              ) : null}
              <div ref={listEndRef} />
            </div>

            <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #e2e8f0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: '#64748b' }}>
                <input
                  type="checkbox"
                  checked={readAloud}
                  onChange={(e) => setReadAloud(e.target.checked)}
                />
                Leer respuestas en voz alta
              </label>
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
                  placeholder={sessionEnded ? 'Límite alcanzado' : 'Escribe tu pregunta…'}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 15,
                  }}
                />
                <button
                  type="button"
                  aria-label="Dictar por voz"
                  disabled={loading || sessionEnded || listening}
                  onClick={() => startVoice()}
                  style={{
                    width: 48,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: listening ? '#e0e7ff' : '#fff',
                    fontSize: 22,
                    cursor: loading || sessionEnded ? 'not-allowed' : 'pointer',
                  }}
                >
                  🎤
                </button>
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
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

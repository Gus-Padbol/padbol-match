import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { AppScreenHeaderBar } from '../components/AppUnifiedHeader';

function formatHorario(apertura, cierre) {
  if (!apertura && !cierre) return null;
  if (apertura && cierre) return `${apertura} – ${cierre}`;
  return apertura || cierre;
}

/* ─── Photo Carousel ──────────────────────────────────────────────────── */
function Carousel({ fotos }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setIdx(p => (p + 1) % fotos.length), 4000);
  };

  useEffect(() => {
    if (fotos.length > 1) startTimer();
    return () => clearInterval(timerRef.current);
  }, [fotos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNav = (delta) => {
    setIdx(p => (p + delta + fotos.length) % fotos.length);
    startTimer();
  };

  if (!fotos.length) return null;
  const showTwo = fotos.length >= 2;
  const visible = showTwo ? [fotos[idx], fotos[(idx + 1) % fotos.length]] : [fotos[idx]];

  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', background: '#0f172a', marginBottom: '8px' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: showTwo ? 'repeat(2, 1fr)' : '1fr', gap: '3px' }}>
          {visible.map((url, i) => (
            <div key={`${url}-${i}`} style={{ aspectRatio: '4/3', overflow: 'hidden', maxHeight: '280px' }}>
              <img src={url} alt={`Cancha ${idx + i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
        {fotos.length > 1 && <>
          <button onClick={() => handleNav(-1)} aria-label="Anterior" style={{
            position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
            width: '36px', height: '36px', borderRadius: '50%', zIndex: 2,
            background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>‹</button>
          <button onClick={() => handleNav(1)} aria-label="Siguiente" style={{
            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
            width: '36px', height: '36px', borderRadius: '50%', zIndex: 2,
            background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>›</button>
        </>}
      </div>
      {/* Dots — outside overflow:hidden strip */}
      {fotos.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '10px 0', background: '#0f172a' }}>
          {fotos.map((_, i) => (
            <button key={i} onClick={() => { setIdx(i); startTimer(); }} aria-label={`Foto ${i + 1}`}
              style={{
                width: i === idx ? '22px' : '8px', height: '8px', borderRadius: '4px',
                border: 'none', cursor: 'pointer', padding: 0,
                background: i === idx ? 'white' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.25s',
              }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Info row ────────────────────────────────────────────────────────── */
function InfoRow({ icon, text, highlight }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      {/* Icon in red circle */}
      <div style={{
        flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
        background: highlight ? '#dc2626' : '#fee2e2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', marginTop: '2px',
      }}>
        {icon}
      </div>
      <span style={{
        lineHeight: 1.6, fontSize: highlight ? '16px' : '14px',
        fontWeight: highlight ? 800 : 400,
        color: highlight ? '#dc2626' : '#374151',
        paddingTop: '6px',
      }}>{text}</span>
    </div>
  );
}

/* ─── Google Maps embed ───────────────────────────────────────────────── */
function MapEmbed({ direccion, ciudad, pais }) {
  const parts = [direccion, ciudad, pais].filter(Boolean);
  if (!parts.length) return null;
  const q = encodeURIComponent(parts.join(', '));
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#1e1b4b', fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>📍 Cómo llegar</h3>
      <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.1)' }}>
        <iframe
          title="Ubicación de la sede"
          width="100%"
          height="250"
          style={{ border: 0, display: 'block' }}
          loading="lazy"
          src={`https://maps.google.com/maps?q=${q}&output=embed`}
        />
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────── */
export default function SedePublica() {
  const { sedeId } = useParams();
  const navigate = useNavigate();
  const [sede, setSede] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('[SedePublica] useEffect fired, sedeId:', sedeId);
    if (!sedeId) { setError('No se recibió un ID de sede.'); setLoading(false); return; }
    setLoading(true); setError('');
    supabase
      .from('sedes')
      .select('*')
      .eq('id', parseInt(sedeId, 10))
      .maybeSingle()
      .then(({ data, error: err }) => {
        console.log('[SedePublica] query result — data:', data, 'error:', err);
        if (err) setError(`Error al cargar sede: ${err.message}`);
        else if (!data) setError(`Sede con id ${sedeId} no encontrada.`);
        else setSede(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('[SedePublica] catch:', err);
        setError('Error inesperado: ' + (err?.message || String(err)));
        setLoading(false);
      });
  }, [sedeId]);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

      <div style={{ position: 'relative', zIndex: 20, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
        <AppScreenHeaderBar backTo="/sedes" title={sede?.nombre || 'Sede'} />
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'white', fontSize: '18px', fontWeight: 600 }}>Cargando sede...</p>
        </div>
      )}

      {/* Error */}
      {!loading && (error || !sede) && (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px' }}>
          <p style={{ color: 'white', fontSize: '16px', fontWeight: 600, textAlign: 'center' }}>{error || 'Sede no encontrada.'}</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>sedeId: {sedeId ?? '(undefined)'}</p>
        </div>
      )}

      {/* Sede loaded */}
      {!loading && !error && sede && (() => {
        console.log('[SedePublica] rendering sede:', sede);
        const licenciaActiva = sede.licencia_activa === true && sede.numero_licencia;
        const fotos = Array.isArray(sede.fotos_urls) ? sede.fotos_urls : [];
        const horario = formatHorario(sede.horario_apertura, sede.horario_cierre);
        const hasAddress = sede.direccion || sede.ciudad || sede.pais;

        return (
          <>
            {/* ── HERO ── */}
            <div style={{
              position: 'relative', minHeight: '320px',
              background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end',
              paddingBottom: '36px', paddingTop: '28px', overflow: 'hidden',
            }}>
              {/* Glow blob */}
              <div style={{
                position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
                width: '320px', height: '320px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(102,126,234,0.25) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />

              {sede.logo_url && (
                <div style={{ position: 'relative', zIndex: 2, marginBottom: '18px' }}>
                  <img src={sede.logo_url} alt={`Logo ${sede.nombre}`}
                    style={{ width: '100px', height: '100px', objectFit: 'contain', borderRadius: '22px', background: 'white', padding: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }} />
                </div>
              )}

              <h1 style={{
                position: 'relative', zIndex: 2, color: 'white',
                fontSize: 'clamp(1.3rem, 6vw, 2.2rem)', fontWeight: 900,
                margin: '0 0 10px', textAlign: 'center',
                textShadow: '0 2px 16px rgba(0,0,0,0.6)',
                padding: '0 24px', lineHeight: 1.15, wordBreak: 'break-word',
              }}>
                {sede.nombre || '(sin nombre)'}
              </h1>

              {sede.descripcion && (
                <p style={{
                  position: 'relative', zIndex: 2,
                  color: 'white', opacity: 0.85,
                  fontSize: '1rem', fontStyle: 'italic',
                  textAlign: 'center', maxWidth: '400px',
                  margin: '0 24px 16px',
                  lineHeight: 1.6,
                  textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                }}>
                  {sede.descripcion}
                </p>
              )}

              {/* Premium license badge */}
              <div style={{ position: 'relative', zIndex: 2 }}>
                {licenciaActiva ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    padding: '7px 16px 7px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 800,
                    background: 'linear-gradient(135deg, rgba(254,243,199,0.97) 0%, rgba(253,230,138,0.97) 100%)',
                    color: '#92400e', border: '1.5px solid #d97706',
                    boxShadow: '0 2px 12px rgba(217,119,6,0.4), inset 0 1px 0 rgba(255,255,255,0.6)',
                  }}>
                    <span style={{ fontSize: '15px' }}>⭐</span>
                    <span style={{ fontSize: '13px', fontWeight: 900, letterSpacing: '0.5px' }}>Licencia PADBOL Activa</span>
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    padding: '7px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700,
                    background: 'rgba(254,226,226,0.93)', color: '#dc2626',
                    border: '1px solid rgba(220,38,38,0.35)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}>
                    ⛔ No habilitado
                  </span>
                )}
              </div>
            </div>

            {/* ── BODY ── */}
            <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px 80px' }}>

              {/* ── Top reservar button ── */}
              <button
                type="button"
                onClick={() => navigate(`/reservar?sedeId=${sedeId}`)}
                style={{
                  width: '100%', padding: '18px 24px', marginBottom: '20px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white', border: 'none', borderRadius: '14px',
                  cursor: 'pointer', fontWeight: 800, fontSize: '17px',
                  boxShadow: '0 4px 18px rgba(185,28,28,0.45)',
                  letterSpacing: '0.2px',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(185,28,28,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 18px rgba(185,28,28,0.45)'; }}
              >
                Reservar cancha
              </button>

              {/* ── Info card — redesigned ── */}
              <div style={{
                background: '#f8fafc', borderRadius: '18px',
                borderLeft: '4px solid #dc2626',
                padding: '24px 28px',
                boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
                marginBottom: '20px',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {hasAddress && (
                    <InfoRow icon="📍" text={[sede.direccion, sede.ciudad, sede.pais].filter(Boolean).join(', ')} />
                  )}
                  {horario && <InfoRow icon="⏰" text={`Abierto ${horario}`} />}
                  {sede.telefono && (() => {
                    const digits = sede.telefono.replace(/\D/g, '');
                    const waNumber = digits.startsWith('0') ? '54' + digits.slice(1) : digits;
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', marginTop: '2px' }}>💬</div>
                        <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer"
                          style={{ paddingTop: '6px', fontSize: '14px', color: '#16a34a', fontWeight: 600, textDecoration: 'none', lineHeight: 1.6 }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                          Escríbenos por WhatsApp
                        </a>
                      </div>
                    );
                  })()}
                  {sede.email_contacto && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginTop: '2px' }}>✉️</div>
                      <a href={`mailto:${sede.email_contacto}`} style={{ paddingTop: '6px', fontSize: '14px', color: '#374151', textDecoration: 'none', lineHeight: 1.6 }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                        {sede.email_contacto}
                      </a>
                    </div>
                  )}
                  {!hasAddress && !sede.telefono && !sede.email_contacto && (
                    <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>Sin información de contacto cargada.</p>
                  )}
                </div>
              </div>

              {/* ── Social media links ── */}
              {(() => {
                const redes = [
                  { key: 'instagram', label: 'Instagram', bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: 'white', icon: '📸' },
                  { key: 'facebook',  label: 'Facebook',  bg: '#1877f2', color: 'white', icon: '👍' },
                  { key: 'tiktok',    label: 'TikTok',    bg: '#010101', color: 'white', icon: '🎵' },
                  { key: 'twitter',   label: 'X / Twitter', bg: '#000', color: 'white', icon: '✖' },
                  { key: 'youtube',   label: 'YouTube',   bg: '#ff0000', color: 'white', icon: '▶' },
                  { key: 'website',   label: 'Sitio web', bg: '#374151', color: 'white', icon: '🌐' },
                ].filter(r => sede[r.key]);
                if (!redes.length) return null;
                return (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ color: '#1e1b4b', fontSize: '15px', fontWeight: 700, marginBottom: '12px', paddingLeft: '2px' }}>🔗 Seguinos</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {redes.map(r => (
                        <a
                          key={r.key}
                          href={sede[r.key]}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '7px',
                            padding: '9px 16px', borderRadius: '10px', textDecoration: 'none',
                            background: r.bg, color: r.color,
                            fontSize: '13px', fontWeight: 700,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            transition: 'transform 0.1s, box-shadow 0.1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 5px 14px rgba(0,0,0,0.25)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                        >
                          <span>{r.icon}</span>
                          <span>{r.label}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── Google Maps ── */}
              {hasAddress && (
                <MapEmbed
                  direccion={sede.direccion}
                  ciudad={sede.ciudad}
                  pais={sede.pais}
                />
              )}

              {/* ── Photo carousel ── */}
              {fotos.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ color: '#1e1b4b', fontSize: '15px', fontWeight: 700, marginBottom: '12px', paddingLeft: '2px' }}>📸 Las canchas</h3>
                  <Carousel fotos={fotos} />
                </div>
              )}

              {/* ── Reserve button ── */}
              <button
                type="button"
                onClick={() => navigate(`/reservar?sedeId=${sedeId}`)}
                style={{
                  width: '100%', padding: '18px 24px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white', border: 'none', borderRadius: '14px',
                  cursor: 'pointer', fontWeight: 800, fontSize: '17px',
                  boxShadow: '0 4px 18px rgba(185,28,28,0.45)',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                  letterSpacing: '0.2px',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(185,28,28,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 18px rgba(185,28,28,0.45)'; }}
              >
                Reservar cancha
              </button>

            </div>
          </>
        );
      })()}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { supabase } from '../supabaseClient';

function formatHorario(apertura, cierre) {
  if (!apertura && !cierre) return null;
  if (apertura && cierre) return `${apertura} – ${cierre}`;
  return apertura || cierre;
}

function mapsLinkForSede(sede) {
  if (!sede) return null;
  const lat = sede.latitud != null ? Number(sede.latitud) : NaN;
  const lon = sede.longitud != null ? Number(sede.longitud) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://www.google.com/maps?q=${lat},${lon}`;
  }
  const parts = [sede.direccion, sede.ciudad, sede.pais].filter(Boolean);
  if (!parts.length) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

function collectFotosSede(sede, max = 4) {
  if (!sede) return [];
  const out = [];
  if (Array.isArray(sede.fotos_urls)) {
    for (const u of sede.fotos_urls) {
      if (u && String(u).trim()) out.push(String(u).trim());
      if (out.length >= max) return out;
    }
  }
  const keys = ['foto_1', 'foto_2', 'foto_3', 'foto_4', 'foto1', 'foto2', 'foto3', 'foto4'];
  for (const k of keys) {
    const v = sede[k];
    if (v && String(v).trim()) out.push(String(v).trim());
    if (out.length >= max) return out;
  }
  return out.slice(0, max);
}

function GaleriaFotos({ urls }) {
  if (!urls.length) return null;
  const show = urls.slice(0, 4);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '20px',
      }}
    >
      {show.map((url, i) => (
        <div
          key={`${url}-${i}`}
          style={{
            aspectRatio: '1',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#e2e8f0',
          }}
        >
          <img
            src={url}
            alt={`Sede ${i + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      ))}
    </div>
  );
}

export default function SedePublica() {
  const { sedeId } = useParams();
  const navigate = useNavigate();
  const [sede, setSede] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sedeId) {
      setError('No se recibió un ID de sede.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    supabase
      .from('sedes')
      .select('*')
      .eq('id', parseInt(sedeId, 10))
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(`Error al cargar sede: ${err.message}`);
        else if (!data) setError(`Sede con id ${sedeId} no encontrada.`);
        else setSede(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Error inesperado: ' + (err?.message || String(err)));
        setLoading(false);
      });
  }, [sedeId]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          paddingTop: '64px',
          paddingBottom: '80px',
        }}
      >
        <AppHeader title="Sede" />
        <p style={{ color: 'white', fontSize: '18px', fontWeight: 600, textAlign: 'center', padding: '48px 20px' }}>
          Cargando sede…
        </p>
        <BottomNav />
      </div>
    );
  }

  if (error || !sede) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          paddingTop: '64px',
          paddingBottom: '80px',
        }}
      >
        <AppHeader title="Sede" />
        <p style={{ color: 'white', fontSize: '16px', fontWeight: 600, textAlign: 'center', padding: '32px 20px' }}>
          {error || 'Sede no encontrada.'}
        </p>
        <BottomNav />
      </div>
    );
  }

  const licenciaActiva = sede.licencia_activa === true && sede.numero_licencia;
  const fotos = collectFotosSede(sede, 4);
  const horario = formatHorario(sede.horario_apertura, sede.horario_cierre);
  const lineaDireccion = [sede.direccion, sede.ciudad, sede.pais].filter(Boolean).join(', ');
  const mapsHref = mapsLinkForSede(sede);
  const descripcion = String(sede.descripcion || '').trim();

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', paddingTop: '64px', paddingBottom: '88px' }}>
      <AppHeader title={sede.nombre ? String(sede.nombre) : 'Sede'} />

      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)',
          padding: '28px 20px 32px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(102,126,234,0.22) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {sede.logo_url ? (
            <img
              src={sede.logo_url}
              alt={sede.nombre ? `Logo ${sede.nombre}` : 'Logo de la sede'}
              style={{
                width: 'min(140px, 42vw)',
                height: 'min(140px, 42vw)',
                objectFit: 'contain',
                borderRadius: '24px',
                background: 'white',
                padding: '14px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                marginBottom: '20px',
              }}
            />
          ) : (
            <div
              style={{
                width: 'min(120px, 38vw)',
                height: 'min(120px, 38vw)',
                margin: '0 auto 20px',
                borderRadius: '24px',
                background: 'rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '52px',
              }}
            >
              🏟️
            </div>
          )}

          <h1
            style={{
              color: 'white',
              fontSize: 'clamp(1.35rem, 5.5vw, 2rem)',
              fontWeight: 900,
              margin: '0 0 12px',
              lineHeight: 1.15,
              textShadow: '0 2px 16px rgba(0,0,0,0.55)',
              wordBreak: 'break-word',
            }}
          >
            {sede.nombre || 'Sede'}
          </h1>

          {licenciaActiva ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, rgba(254,243,199,0.97) 0%, rgba(253,230,138,0.97) 100%)',
                color: '#92400e',
                border: '1px solid #d97706',
              }}
            >
              ⭐ Licencia PADBOL activa
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                background: 'rgba(254,226,226,0.9)',
                color: '#b91c1c',
              }}
            >
              ⛔ Sede no habilitada
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '22px 16px 0' }}>
        {lineaDireccion ? (
          <div style={{ marginBottom: '18px' }}>
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#1d4ed8',
                  textDecoration: 'none',
                  lineHeight: 1.45,
                }}
              >
                <span style={{ fontSize: '20px', flexShrink: 0 }} aria-hidden>
                  📍
                </span>
                <span style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}>{lineaDireccion}</span>
              </a>
            ) : (
              <div style={{ display: 'flex', gap: '10px', fontSize: '15px', fontWeight: 600, color: '#334155' }}>
                <span aria-hidden>📍</span>
                <span>{lineaDireccion}</span>
              </div>
            )}
          </div>
        ) : null}

        {fotos.length > 0 ? (
          <div style={{ marginBottom: '8px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 10px', letterSpacing: '0.04em' }}>
              GALERÍA
            </h2>
            <GaleriaFotos urls={fotos} />
          </div>
        ) : null}

        {descripcion ? (
          <div
            style={{
              marginBottom: '22px',
              padding: '16px 18px',
              borderRadius: '14px',
              background: 'white',
              border: '1px solid #e2e8f0',
              fontSize: '15px',
              lineHeight: 1.55,
              color: '#334155',
            }}
          >
            {descripcion}
          </div>
        ) : null}

        {(horario || sede.telefono || sede.email_contacto) && (
          <div
            style={{
              marginBottom: '22px',
              padding: '16px 18px',
              borderRadius: '14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              color: '#475569',
              lineHeight: 1.6,
            }}
          >
            {horario ? <div style={{ marginBottom: sede.telefono || sede.email_contacto ? '10px' : 0 }}>⏰ {horario}</div> : null}
            {sede.telefono ? (
              <div style={{ marginBottom: sede.email_contacto ? '8px' : 0 }}>
                💬{' '}
                <a
                  href={(() => {
                    const digits = String(sede.telefono).replace(/\D/g, '');
                    const waNumber = digits.startsWith('0') ? `54${digits.slice(1)}` : digits;
                    return `https://wa.me/${waNumber}`;
                  })()}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#15803d', fontWeight: 700 }}
                >
                  WhatsApp
                </a>
              </div>
            ) : null}
            {sede.email_contacto ? (
              <div>
                ✉️{' '}
                <a href={`mailto:${sede.email_contacto}`} style={{ color: '#1d4ed8', fontWeight: 600 }}>
                  {sede.email_contacto}
                </a>
              </div>
            ) : null}
          </div>
        )}

        {(() => {
          const redes = [
            { key: 'instagram', label: 'Instagram', bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743)', color: 'white', icon: '📸' },
            { key: 'facebook', label: 'Facebook', bg: '#1877f2', color: 'white', icon: '👍' },
            { key: 'tiktok', label: 'TikTok', bg: '#010101', color: 'white', icon: '🎵' },
            { key: 'twitter', label: 'X', bg: '#000', color: 'white', icon: '✖' },
            { key: 'youtube', label: 'YouTube', bg: '#ff0000', color: 'white', icon: '▶' },
            { key: 'website', label: 'Web', bg: '#374151', color: 'white', icon: '🌐' },
          ].filter((r) => sede[r.key]);
          if (!redes.length) return null;
          return (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#64748b', marginBottom: '10px' }}>SEGUINOS</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {redes.map((r) => (
                  <a
                    key={r.key}
                    href={sede[r.key]}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      background: r.bg,
                      color: r.color,
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    <span>{r.icon}</span>
                    {r.label}
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => navigate(`/reservar?sedeId=${sedeId}`)}
            style={{
              width: '100%',
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              cursor: 'pointer',
              fontWeight: 900,
              fontSize: '16px',
              boxShadow: '0 6px 22px rgba(22,163,74,0.4)',
            }}
          >
            Reservar cancha
          </button>
          <button
            type="button"
            onClick={() => navigate(`/torneos?sedeId=${encodeURIComponent(String(sedeId))}`)}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: 'white',
              color: '#334155',
              border: '2px solid #cbd5e1',
              borderRadius: '14px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '15px',
            }}
          >
            Ver torneos
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

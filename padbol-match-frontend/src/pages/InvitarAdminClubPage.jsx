import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NuevaSedeSuperBottomSheet from '../components/NuevaSedeSuperBottomSheet';

const DEFAULT_API = (() => {
  const raw =
    (typeof process !== 'undefined' &&
      (process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || '')) ||
    '';
  const s = String(raw).trim().replace(/\/$/, '');
  return s || 'https://padbol-backend.onrender.com';
})();

export default function InvitarAdminClubPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const apiBaseUrl = DEFAULT_API;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [flow, setFlow] = useState('club');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nombreAdminGeo, setNombreAdminGeo] = useState('');
  const [geoSubmitting, setGeoSubmitting] = useState(false);
  const [geoErr, setGeoErr] = useState('');

  const tok = useMemo(() => String(token || '').trim(), [token]);

  const load = useCallback(async () => {
    if (!tok) {
      setError('Enlace inválido.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/invitacion/${encodeURIComponent(tok)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error || 'Esta invitación no está disponible.');
        setMeta(null);
        setSheetOpen(false);
        setFlow('club');
        return;
      }
      const nextFlow = j.flow === 'geo' ? 'geo' : 'club';
      setFlow(nextFlow);
      setMeta({
        email: j.email,
        pais: j.pais,
        nombre_club: j.nombre_club || '',
        expires_at: j.expires_at,
        provincia: j.provincia || '',
        ciudad: j.ciudad || '',
        invited_alcance: j.invited_alcance || '',
      });
      setSheetOpen(nextFlow === 'club');
      setNombreAdminGeo('');
      setGeoErr('');
    } catch (e) {
      setError(e?.message || 'No se pudo validar la invitación.');
      setMeta(null);
      setSheetOpen(false);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, tok]);

  useEffect(() => {
    void load();
  }, [load]);

  const completarGeo = useCallback(async () => {
    if (!tok || !meta?.email) return;
    setGeoSubmitting(true);
    setGeoErr('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/invitacion/${encodeURIComponent(tok)}/completar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_contacto: String(meta.email || '').trim().toLowerCase(),
          nombre_admin: String(nombreAdminGeo || '').trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGeoErr(j?.error || 'No se pudo aceptar la invitación.');
        return;
      }
      navigate('/auth?login=1');
    } catch (e) {
      setGeoErr(e?.message || 'Error de red');
    } finally {
      setGeoSubmitting(false);
    }
  }, [apiBaseUrl, meta, navigate, nombreAdminGeo, tok]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'linear-gradient(180deg, #0b1020 0%, #151832 100%)',
          color: 'rgba(248, 250, 252, 0.92)',
          fontWeight: 600,
          fontSize: 16,
          boxSizing: 'border-box',
        }}
      >
        Validando invitación…
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: 24,
          textAlign: 'center',
          background: 'linear-gradient(180deg, #0b1020 0%, #151832 100%)',
          color: 'rgba(248, 250, 252, 0.95)',
          boxSizing: 'border-box',
        }}
      >
        <p style={{ margin: 0, fontSize: 17, fontWeight: 600, maxWidth: 400 }}>{error || 'Invitación no disponible.'}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            padding: '12px 20px',
            borderRadius: 12,
            border: 'none',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            background: '#fff',
            color: '#1e293b',
          }}
        >
          Ir al inicio
        </button>
      </div>
    );
  }

  if (flow === 'geo') {
    const alc = String(meta.invited_alcance || '').toLowerCase();
    const scopeBits = [meta.pais, meta.provincia, meta.ciudad].filter(Boolean);
    return (
      <div
        style={{
          minHeight: '100vh',
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #0b1020 0%, #151832 100%)',
          color: 'rgba(248, 250, 252, 0.95)',
          padding: '24px 16px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{ maxWidth: 440, width: '100%' }}>
          <h1 style={{ fontSize: '20px', margin: '0 0 10px', textAlign: 'center' }}>Invitación de administrador</h1>
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'rgba(226,232,240,0.9)', margin: '0 0 16px', textAlign: 'center' }}>
            {alc === 'pais'
              ? 'Te invitaron como administrador nacional. Al aceptar se activa tu acceso para todo el país indicado (no se crea una sede).'
              : 'Te invitaron como administrador de ciudad o región. Al aceptar se activa tu acceso con el alcance indicado (no se crea una sede).'}
          </p>
          <div
            style={{
              background: 'rgba(15,23,42,0.55)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 16,
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            <div>
              <strong>Email:</strong> {meta.email}
            </div>
            {scopeBits.length ? (
              <div style={{ marginTop: 8 }}>
                <strong>Alcance:</strong> {scopeBits.join(' · ')}
              </div>
            ) : null}
          </div>
          <label style={{ display: 'grid', gap: 8, marginBottom: 14, fontSize: '13px', fontWeight: 600 }}>
            Tu nombre (opcional)
            <input
              type="text"
              value={nombreAdminGeo}
              onChange={(e) => setNombreAdminGeo(e.target.value)}
              placeholder="Nombre para el panel"
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.4)',
                fontSize: 15,
                background: 'rgba(15,23,42,0.5)',
                color: '#f8fafc',
              }}
            />
          </label>
          {geoErr ? (
            <p style={{ color: '#fca5a5', fontSize: 13, margin: '0 0 12px' }}>{geoErr}</p>
          ) : null}
          <button
            type="button"
            disabled={geoSubmitting}
            onClick={() => void completarGeo()}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              border: 'none',
              fontWeight: 800,
              fontSize: 16,
              cursor: geoSubmitting ? 'not-allowed' : 'pointer',
              background: geoSubmitting ? '#64748b' : '#E11B22',
              color: '#fff',
              marginBottom: 12,
            }}
          >
            {geoSubmitting ? 'Procesando…' : 'Aceptar invitación y activar acceso'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'transparent',
              color: 'rgba(248,250,252,0.85)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          padding: '16px 16px 8px',
          background: 'linear-gradient(180deg, #0b1020 0%, #151832 100%)',
          color: 'rgba(248, 250, 252, 0.95)',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 600,
          boxSizing: 'border-box',
        }}
      >
        Completa los datos de tu club para activar tu panel de administración.
      </div>
      <NuevaSedeSuperBottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          navigate('/');
        }}
        apiBaseUrl={apiBaseUrl}
        accessToken={null}
        inviteToken={tok}
        invitePrefill={meta}
        onSuccess={() => {
          setSheetOpen(false);
          navigate('/auth?login=1');
        }}
      />
    </>
  );
}

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
  const [sheetOpen, setSheetOpen] = useState(false);

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
        return;
      }
      setMeta({
        email: j.email,
        pais: j.pais,
        nombre_club: j.nombre_club || '',
        expires_at: j.expires_at,
      });
      setSheetOpen(true);
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
        Completá los datos de tu club para activar tu panel de administración.
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

import React, { useEffect, useState } from 'react';
import AdminClasesClubSection from './AdminClasesClubSection';
import AdminProfesoresClubSection from './AdminProfesoresClubSection';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

export default function AdminModuloClasesSection({
  apiBaseUrl,
  accessToken,
  sedeId,
  canchas = [],
  monedaSede = 'ARS',
  isSuperAdmin = false,
}) {
  const { t } = useTranslation();
  const subTabs = [
    { id: 'profesores', label: t('clases.profesores') },
    { id: 'clases', label: t('clases.titulo') },
  ];
  const [sub, setSub] = useState('profesores');
  const [canchasLocal, setCanchasLocal] = useState(() => (Array.isArray(canchas) ? canchas : []));
  const sid = Number(sedeId);

  useEffect(() => {
    if (Array.isArray(canchas) && canchas.length > 0) {
      setCanchasLocal(canchas);
      return undefined;
    }
    if (!accessToken || !Number.isFinite(sid) || !apiBaseUrl) {
      setCanchasLocal([]);
      return undefined;
    }
    const ac = new AbortController();
    const base = String(apiBaseUrl).replace(/\/$/, '');
    fetch(`${base}/api/sedes/${sid}/canchas`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: ac.signal,
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || 'No se pudieron cargar canchas');
        return Array.isArray(j?.canchas) ? j.canchas : [];
      })
      .then(setCanchasLocal)
      .catch(() => setCanchasLocal([]));
    return () => ac.abort();
  }, [apiBaseUrl, accessToken, sid, canchas]);

  if (!accessToken || !Number.isFinite(sid)) {
    return <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Seleccioná una sede válida.</p>;
  }

  return (
    <div style={{ maxWidth: 640, width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {subTabs.map((tab) => {
          const active = sub === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSub(tab.id)}
              style={{
                border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 999,
                padding: '8px 14px',
                background: active ? 'rgba(229, 57, 53, 0.1)' : 'var(--bg-page)',
                color: 'var(--text-primary)',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {sub === 'profesores' ? (
        <AdminProfesoresClubSection
          apiBaseUrl={apiBaseUrl}
          accessToken={accessToken}
          sedeId={sid}
          isSuperAdmin={isSuperAdmin}
        />
      ) : (
        <AdminClasesClubSection
          apiBaseUrl={apiBaseUrl}
          accessToken={accessToken}
          sedeId={sid}
          canchas={canchasLocal}
          monedaSede={monedaSede}
        />
      )}
    </div>
  );
}

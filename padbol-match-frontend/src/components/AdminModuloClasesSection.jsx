import React, { useState } from 'react';
import AdminClasesClubSection from './AdminClasesClubSection';
import AdminProfesoresClubSection from './AdminProfesoresClubSection';

const SUB_TABS = [
  { id: 'profesores', label: 'Profesores' },
  { id: 'clases', label: 'Clases' },
];

export default function AdminModuloClasesSection({ apiBaseUrl, accessToken, sedeId, canchas = [], monedaSede = 'ARS' }) {
  const [sub, setSub] = useState('profesores');
  const sid = Number(sedeId);

  if (!accessToken || !Number.isFinite(sid)) {
    return <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Seleccioná una sede válida.</p>;
  }

  return (
    <div style={{ maxWidth: 640, width: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {SUB_TABS.map((t) => {
          const active = sub === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
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
              {t.label}
            </button>
          );
        })}
      </div>
      {sub === 'profesores' ? (
        <AdminProfesoresClubSection apiBaseUrl={apiBaseUrl} accessToken={accessToken} sedeId={sid} />
      ) : (
        <AdminClasesClubSection
          apiBaseUrl={apiBaseUrl}
          accessToken={accessToken}
          sedeId={sid}
          canchas={canchas}
          monedaSede={monedaSede}
        />
      )}
    </div>
  );
}

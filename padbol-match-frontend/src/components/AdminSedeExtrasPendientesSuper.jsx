import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import React, { useCallback, useEffect, useState } from 'react';

/**
 * Super admin — extras pendientes de todas las sedes (aprobar / rechazar).
 */
export default function AdminSedeExtrasPendientesSuper({ apiBaseUrl, accessToken }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/sede-extras-pendientes`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo cargar');
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      setMsg(e.message || 'Error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchExtra = async (sedeId, extraId, body) => {
    setBusyId(extraId);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(extraId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Error');
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setBusyId(null);
    }
  };

  if (!accessToken) return null;

  return (
    <div
      style={{
        marginBottom: 20,
        padding: 14,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        maxWidth: '100%',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>{t('admin.sedes.extrasPendingApproval')}</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        Los clubes cargan opciones para el tercer tiempo; acá las aprobás o las rechazás. Solo los aprobados se
        muestran al jugador al pagar.
      </p>
      {msg ? <p style={{ color: 'var(--pm-color-error, #f87171)', fontSize: 13, marginBottom: 8 }}>{msg}</p> : null}
      {loading ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>No hay extras pendientes.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {items.map((row) => {
            const sedeNombre = row.sede?.nombre || `Sede #${row.sede_id}`;
            const mon = row.precio_moneda || 'ARS';
            const precio = row.precio != null ? Math.round(Number(row.precio)) : 0;
            return (
              <li
                key={row.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 12,
                  background: 'var(--bg-page)',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14 }}>{row.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{sedeNombre}</div>
                {row.descripcion ? (
                  <p style={{ margin: '8px 0 0', fontSize: 13 }}>{row.descripcion}</p>
                ) : null}
                <div style={{ marginTop: 8, fontWeight: 700, fontSize: 14 }}>
                  {mon} {precio.toLocaleString('es-AR')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => patchExtra(row.sede_id, row.id, { aprobado_super: true })}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: busyId === row.id ? '#9ca3af' : '#16a34a',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: busyId === row.id ? 'wait' : 'pointer',
                    }}
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => {
                      if (!window.confirm(t('admin.confirmaciones.rejectExtra'))) return;
                      void patchExtra(row.sede_id, row.id, { activo: false });
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: busyId === row.id ? 'wait' : 'pointer',
                    }}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

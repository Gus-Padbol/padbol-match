import React, { useCallback, useEffect, useState } from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { aprobarProfesorAdmin, fetchAdminProfesoresPendientes } from '../utils/clasesAdminApi';

function labelDeporte(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_OPTIONS.find((d) => d.key === k)?.label || k;
}

function deportesLabel(deportes) {
  const list = Array.isArray(deportes) ? deportes : [];
  if (!list.length) return '—';
  return list.map(labelDeporte).join(', ');
}

function nombreProfesor(p) {
  return (
    [String(p?.nombre || '').trim(), String(p?.apellido || '').trim()].filter(Boolean).join(' ').trim() ||
    String(p?.nombre || '').trim() ||
    '—'
  );
}

export default function AdminProfesoresPendientesSuper({ accessToken }) {
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
      const list = await fetchAdminProfesoresPendientes({ accessToken });
      setItems(list);
    } catch (e) {
      setMsg(e?.message || 'Error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const aprobar = async (id) => {
    setBusyId(id);
    setMsg('');
    try {
      await aprobarProfesorAdmin({ profesorId: id, accessToken });
      await load();
    } catch (e) {
      setMsg(e?.message || 'Error');
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
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
        Aprobar profesores
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        Los clubes cargan profesores; acá los aprobás para que aparezcan en el hub de clases.
      </p>
      {msg ? <p style={{ color: 'var(--pm-color-error, #f87171)', fontSize: 13, marginBottom: 8 }}>{msg}</p> : null}
      {loading ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Cargando…</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>No hay profesores pendientes.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {items.map((row) => (
            <li
              key={row.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 12,
                background: 'var(--bg-page)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
              }}
            >
                            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)" }}>{nombreProfesor(row)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Sede: {row.sede_nombre || `ID ${row.sede_id}`}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Deportes: {deportesLabel(row.deportes)}
                </div>
                {row.certificado_fipa ? (
                  <div style={{ fontSize: 12, marginTop: 6, fontWeight: 700, color: 'var(--accent)' }}>Certificado FIPA</div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void aprobar(row.id)}
                style={{
                  flexShrink: 0,
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 16px',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: busyId === row.id ? 'wait' : 'pointer',
                  opacity: busyId === row.id ? 0.7 : 1,
                }}
              >
                {busyId === row.id ? '…' : 'Aprobar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

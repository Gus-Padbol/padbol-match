import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import SportIcon from './common/SportIcon';
import { parsePrecioDeporteInput } from '../utils/sedePreciosDeporte';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

function precioDuracionInputDisplay(raw) {
  if (raw === '' || raw == null) return '';
  const n = parsePrecioDeporteInput(raw);
  if (n == null) return '';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const emptyDraft = () => ({ precio_ars: '', precio_usd: '', activo: true, editing: false });

/**
 * Mi Sede — precios por deporte (admin_club / super_admin).
 */
export default function AdminSedePreciosDeporteSection({ apiBaseUrl, accessToken, sedeId }) {
  const { t } = useTranslation();
  const [rowsByDeporte, setRowsByDeporte] = useState({});
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(DEPORTES_CANCHA_SEDE_OPTIONS.map((o) => [o.key, emptyDraft()])),
  );
  const [loading, setLoading] = useState(true);
  const [savingDeporte, setSavingDeporte] = useState(null);
  const [msgByDeporte, setMsgByDeporte] = useState({});

  const deportesLista = useMemo(() => DEPORTES_CANCHA_SEDE_OPTIONS, []);

  const load = useCallback(async () => {
    if (!sedeId || !accessToken) {
      setRowsByDeporte({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/precios-deporte`,
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudieron cargar precios por deporte');
      const list = Array.isArray(j.precios) ? j.precios : [];
      const map = {};
      for (const r of list) {
        const k = String(r.deporte || '').trim().toLowerCase();
        if (k) map[k] = r;
      }
      setRowsByDeporte(map);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const opt of deportesLista) {
          const row = map[opt.key];
          if (row) {
            next[opt.key] = {
              precio_ars: row.precio_ars != null ? String(Math.round(Number(row.precio_ars))) : '',
              precio_usd: row.precio_usd != null ? String(Math.round(Number(row.precio_usd))) : '',
              activo: row.activo !== false,
              editing: false,
            };
          } else {
            next[opt.key] = emptyDraft();
          }
        }
        return next;
      });
    } catch (e) {
      setRowsByDeporte({});
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, sedeId, accessToken, deportesLista]);

  useEffect(() => {
    void load();
  }, [load]);

  const guardar = async (deporteKey) => {
    if (!sedeId || !accessToken) return;
    const d = drafts[deporteKey] || emptyDraft();
    setSavingDeporte(deporteKey);
    setMsgByDeporte((p) => ({ ...p, [deporteKey]: '' }));
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/admin/sedes/${encodeURIComponent(sedeId)}/precios-deporte`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            deporte: deporteKey,
            precio_ars: parsePrecioDeporteInput(d.precio_ars),
            precio_usd: parsePrecioDeporteInput(d.precio_usd),
            activo: !!d.activo,
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo guardar');
      setMsgByDeporte((p) => ({ ...p, [deporteKey]: `✅ ${t('precios.guardado')}` }));
      setDrafts((p) => ({ ...p, [deporteKey]: { ...p[deporteKey], editing: false } }));
      await load();
    } catch (e) {
      setMsgByDeporte((p) => ({ ...p, [deporteKey]: e.message || 'Error' }));
    } finally {
      setSavingDeporte(null);
    }
  };

  const desactivar = async (deporteKey) => {
    if (!sedeId || !accessToken) return;
    setSavingDeporte(deporteKey);
    setMsgByDeporte((p) => ({ ...p, [deporteKey]: '' }));
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/admin/sedes/${encodeURIComponent(sedeId)}/precios-deporte/${encodeURIComponent(deporteKey)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo desactivar');
      setDrafts((p) => ({ ...p, [deporteKey]: emptyDraft() }));
      await load();
    } catch (e) {
      setMsgByDeporte((p) => ({ ...p, [deporteKey]: e.message || 'Error' }));
    } finally {
      setSavingDeporte(null);
    }
  };

  if (!sedeId) return null;

  return (
    <div id="admin-mi-sede-precios-deporte" className="admin-precios-deporte-section">
      <h3 className="admin-mi-sede-block-title admin-precios-deporte-section__title">
        {t('precios.porDeporte')}
      </h3>
      <p className="admin-mi-sede-theme-muted admin-precios-deporte-section__hint">
        {t('admin.sedes.pricesByDurationHint', {
          defaultValue:
            'Precio de referencia por deporte. Si no hay fila activa, se usa el precio general de la sede.',
        })}
      </p>
      {loading ? (
        <p className="admin-mi-sede-theme-muted">{t('admin.metricas.loading', { defaultValue: 'Cargando…' })}</p>
      ) : (
        <div className="admin-mi-sede-theme-panel admin-precios-deporte-table-wrap">
          <table className="admin-precios-deporte-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.metricas.sportLabel', { defaultValue: 'Deporte' })}</th>
                <th scope="col">{t('precios.precioARS')}</th>
                <th scope="col">{t('precios.precioUSD')}</th>
                <th scope="col">{t('admin.metricas.statusCol', { defaultValue: 'Activo' })}</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {deportesLista.map((opt) => {
                const row = rowsByDeporte[opt.key];
                const tienePrecio =
                  row &&
                  row.activo !== false &&
                  (row.precio_ars != null || row.precio_usd != null);
                const draft = drafts[opt.key] || emptyDraft();
                const editing = draft.editing || !tienePrecio;
                const busy = savingDeporte === opt.key;
                const msg = msgByDeporte[opt.key];

                return (
                  <tr key={opt.key}>
                    <td className="admin-precios-deporte-table__deporte">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <SportIcon deporte={opt.key} size={20} color="var(--text-primary)" />
                        {opt.label}
                      </span>
                    </td>
                    {editing ? (
                      <>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="admin-mi-sede-theme-input admin-precios-deporte-table__input"
                            value={precioDuracionInputDisplay(draft.precio_ars)}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                              setDrafts((p) => ({
                                ...p,
                                [opt.key]: { ...p[opt.key], precio_ars: digits, editing: true },
                              }));
                            }}
                            placeholder="—"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="admin-mi-sede-theme-input admin-precios-deporte-table__input"
                            value={precioDuracionInputDisplay(draft.precio_usd)}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                              setDrafts((p) => ({
                                ...p,
                                [opt.key]: { ...p[opt.key], precio_usd: digits, editing: true },
                              }));
                            }}
                            placeholder="—"
                          />
                        </td>
                        <td>
                          <label className="admin-precios-deporte-table__toggle">
                            <input
                              type="checkbox"
                              checked={!!draft.activo}
                              onChange={(e) =>
                                setDrafts((p) => ({
                                  ...p,
                                  [opt.key]: { ...p[opt.key], activo: e.target.checked, editing: true },
                                }))
                              }
                            />
                            <span>{draft.activo ? t('admin.sedes.subscriptionActive', { defaultValue: 'Activo' }) : '—'}</span>
                          </label>
                        </td>
                        <td className="admin-precios-deporte-table__actions">
                          <button
                            type="button"
                            className="admin-precios-deporte-table__btn-save"
                            disabled={busy}
                            onClick={() => void guardar(opt.key)}
                          >
                            {busy
                              ? t('admin.metricas.savingEllipsis')
                              : tienePrecio
                                ? t('general.save')
                                : t('precios.agregar')}
                          </button>
                          {tienePrecio ? (
                            <button
                              type="button"
                              className="admin-precios-deporte-table__btn-cancel"
                              disabled={busy}
                              onClick={() => {
                                setDrafts((p) => ({
                                  ...p,
                                  [opt.key]: {
                                    precio_ars:
                                      row.precio_ars != null
                                        ? String(Math.round(Number(row.precio_ars)))
                                        : '',
                                    precio_usd:
                                      row.precio_usd != null
                                        ? String(Math.round(Number(row.precio_usd)))
                                        : '',
                                    activo: row.activo !== false,
                                    editing: false,
                                  },
                                }));
                                setMsgByDeporte((m) => ({ ...m, [opt.key]: '' }));
                              }}
                            >
                              {t('general.cancel')}
                            </button>
                          ) : null}
                          {msg ? (
                            <p className="admin-precios-deporte-table__msg">{msg}</p>
                          ) : null}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          {row?.precio_ars != null
                            ? `$ ${Number(row.precio_ars).toLocaleString('es-AR')}`
                            : '—'}
                        </td>
                        <td>
                          {row?.precio_usd != null
                            ? `US$ ${Number(row.precio_usd).toLocaleString('es-AR')}`
                            : '—'}
                        </td>
                        <td>
                          {row?.activo !== false
                            ? t('admin.sedes.subscriptionActive', { defaultValue: 'Activo' })
                            : '—'}
                        </td>
                        <td className="admin-precios-deporte-table__actions">
                          <button
                            type="button"
                            className="admin-precios-deporte-table__btn-edit"
                            onClick={() =>
                              setDrafts((p) => ({
                                ...p,
                                [opt.key]: {
                                  precio_ars:
                                    row.precio_ars != null
                                      ? String(Math.round(Number(row.precio_ars)))
                                      : '',
                                  precio_usd:
                                    row.precio_usd != null
                                      ? String(Math.round(Number(row.precio_usd)))
                                      : '',
                                  activo: row.activo !== false,
                                  editing: true,
                                },
                              }))
                            }
                          >
                            {t('general.edit', { defaultValue: 'Editar' })}
                          </button>
                          <button
                            type="button"
                            className="admin-precios-deporte-table__btn-off"
                            disabled={busy}
                            onClick={() => void desactivar(opt.key)}
                          >
                            {t('admin.sedes.deactivate', { defaultValue: 'Desactivar' })}
                          </button>
                          {msg ? (
                            <p className="admin-precios-deporte-table__msg">{msg}</p>
                          ) : null}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

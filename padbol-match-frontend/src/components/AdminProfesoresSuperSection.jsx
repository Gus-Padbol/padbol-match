import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import SportIcon from './common/SportIcon';
import {
  aprobarProfesorAdmin,
  fetchAdminProfesoresTodos,
  patchProfesorAdmin,
  rechazarProfesorAdmin,
} from '../utils/clasesAdminApi';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import './AdminProfesoresSuperSection.css';

const API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

const BIO_MAX = 500;

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

function inicialProfesor(p) {
  const n = String(p?.nombre || p?.apellido || '').trim();
  for (let i = 0; i < n.length; i += 1) {
    const ch = n[i];
    if (/[A-Za-zÀ-ÿÁÉÍÓÚÑáéíóúñ0-9]/.test(ch)) return ch.toUpperCase();
  }
  return '?';
}

function formatFecha(iso) {
  const raw = String(iso || '').trim();
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFechaNac(raw) {
  const s = String(raw || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, mo, d] = s.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function generoInstructorLabel(t, genero) {
  const g = String(genero || '').trim().toLowerCase();
  if (g === 'masculino') return t('instructor.generoMasculino');
  if (g === 'femenino') return t('instructor.generoFemenino');
  if (g === 'no_decir') return t('instructor.generoNoDice');
  return genero || '—';
}

function waDigitsForUrl(raw) {
  return String(raw || '').replace(/\D/g, '') || '';
}

function ProfesorAvatar({ row, sizeClass = '' }) {
  const foto = String(row?.foto_url || '').trim();
  const cls = ['admin-profesores-super__avatar', sizeClass].filter(Boolean).join(' ');
  if (foto) {
    return (
      <div className={cls} aria-hidden>
        <img src={foto} alt="" />
      </div>
    );
  }
  return (
    <div className={cls} aria-hidden>
      <span className="admin-profesores-super__avatar-initials">{inicialProfesor(row)}</span>
    </div>
  );
}

function FichaRow({ label, value, children }) {
  return (
    <div className="admin-profesores-super__ficha-row">
      <span className="admin-profesores-super__ficha-label">{label}</span>
      <span className="admin-profesores-super__ficha-value">{children ?? value ?? '—'}</span>
    </div>
  );
}

function rowToEditDraft(row) {
  const fecha = String(row?.fecha_nacimiento || '').trim().slice(0, 10);
  return {
    sede_id: row?.sede_id != null ? String(row.sede_id) : '',
    deportes: Array.isArray(row?.deportes) ? [...row.deportes] : [],
    certificado_fipa: Boolean(row?.certificado_fipa),
    whatsapp: String(row?.whatsapp || '').trim(),
    bio: String(row?.bio || '').trim(),
    fecha_nacimiento: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : '',
    genero: String(row?.genero || '').trim().toLowerCase(),
  };
}

function ProfesorFichaModal({ row: rowProp, isSuperAdmin, accessToken, onClose, onRowUpdate, t }) {
  const [row, setRow] = useState(rowProp);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(() => rowToEditDraft(rowProp));
  const [sedes, setSedes] = useState([]);
  const [sedesLoading, setSedesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setRow(rowProp);
    setEditMode(false);
    setDraft(rowToEditDraft(rowProp));
    setSaveError('');
  }, [rowProp]);

  useEffect(() => {
    if (!editMode || !isSuperAdmin) return;
    let cancelled = false;
    setSedesLoading(true);
    fetch(`${API_BASE}/api/sedes`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (Array.isArray(data) ? data : [])
          .filter((s) => s && s.activo !== false)
          .sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
        setSedes(list);
      })
      .catch(() => {
        if (!cancelled) setSedes([]);
      })
      .finally(() => {
        if (!cancelled) setSedesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editMode, isSuperAdmin]);

  if (!row) return null;

  const wa = String(row.whatsapp || '').trim();
  const waUrl = waDigitsForUrl(wa);
  const boolLabel = (v) => (v ? t('admin.profesores.si') : t('admin.profesores.no'));

  const toggleDeporte = (key) => {
    setDraft((d) => {
      const set = new Set(d.deportes);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...d, deportes: [...set] };
    });
  };

  const guardarEdicion = async () => {
    if (!accessToken) return;
    if (!draft.deportes.length) {
      setSaveError(t('admin.formularios.chooseAtLeastOneSport'));
      return;
    }
    if (draft.deportes.includes('padbol') && !draft.certificado_fipa) {
      setSaveError(t('admin.formularios.fipaRequiredPadbol'));
      return;
    }
    if (String(draft.bio || '').length > BIO_MAX) {
      setSaveError(t('instructor.errorBioMax'));
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const updated = await patchProfesorAdmin({
        profesorId: row.id,
        accessToken,
        body: {
          sede_id: Number(draft.sede_id),
          deportes: draft.deportes,
          certificado_fipa: draft.certificado_fipa,
          whatsapp: String(draft.whatsapp || '').trim() || null,
          bio: String(draft.bio || '').trim() || null,
          fecha_nacimiento: draft.fecha_nacimiento || null,
          genero: draft.genero || null,
        },
      });
      setRow(updated);
      onRowUpdate?.(updated);
      setEditMode(false);
      setDraft(rowToEditDraft(updated));
    } catch (e) {
      setSaveError(e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="admin-profesores-super__ficha-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-profesor-ficha-title"
        className="admin-profesores-super__ficha-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-profesores-super__ficha-header">
          <div className="admin-profesores-super__ficha-avatar">
            <ProfesorAvatar row={row} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 id="admin-profesor-ficha-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              {editMode ? t('admin.profesores.editarFicha') : t('admin.profesores.fichaTitulo')}
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{nombreProfesor(row)}</p>
          </div>
        </div>

        {saveError ? <p className="admin-profesores-super__ficha-error">{saveError}</p> : null}

        {editMode && isSuperAdmin ? (
          <div className="admin-profesores-super__ficha-edit">
            <label className="admin-profesores-super__ficha-edit-label">{t('admin.profesores.colSede')}</label>
            <select
              className="admin-profesores-super__ficha-edit-input"
              value={draft.sede_id}
              onChange={(e) => setDraft((d) => ({ ...d, sede_id: e.target.value }))}
              disabled={sedesLoading || saving}
            >
              <option value="">{sedesLoading ? t('general.loading') : t('instructor.eligeSede')}</option>
              {sedes.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre || `Sede ${s.id}`}
                </option>
              ))}
            </select>

            <span className="admin-profesores-super__ficha-edit-label">{t('admin.profesores.colDeportes')}</span>
            <div className="admin-profesores-super__ficha-deportes">
              {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className={`admin-profesores-super__ficha-deporte-chip${draft.deportes.includes(d.key) ? ' admin-profesores-super__ficha-deporte-chip--on' : ''}`}
                  onClick={() => toggleDeporte(d.key)}
                  disabled={saving}
                >
                  <SportIcon deporte={d.key} size={16} color="var(--text-secondary)" />
                  {d.label}
                </button>
              ))}
            </div>

            <label className="admin-profesores-super__ficha-edit-check">
              <input
                type="checkbox"
                checked={draft.certificado_fipa}
                onChange={(e) => setDraft((d) => ({ ...d, certificado_fipa: e.target.checked }))}
                disabled={saving}
              />
              <span>{t('instructor.campoCertificado')}</span>
            </label>

            <label className="admin-profesores-super__ficha-edit-label">{t('admin.profesores.colWhatsapp')}</label>
            <input
              type="tel"
              className="admin-profesores-super__ficha-edit-input"
              value={draft.whatsapp}
              onChange={(e) => setDraft((d) => ({ ...d, whatsapp: e.target.value }))}
              disabled={saving}
            />

            <label className="admin-profesores-super__ficha-edit-label">{t('admin.profesores.fichaBio')}</label>
            <textarea
              className="admin-profesores-super__ficha-edit-textarea"
              maxLength={BIO_MAX}
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              disabled={saving}
            />

            <label className="admin-profesores-super__ficha-edit-label">{t('admin.profesores.fichaFechaNac')}</label>
            <input
              type="date"
              className="admin-profesores-super__ficha-edit-input"
              value={draft.fecha_nacimiento}
              onChange={(e) => setDraft((d) => ({ ...d, fecha_nacimiento: e.target.value }))}
              disabled={saving}
            />

            <label className="admin-profesores-super__ficha-edit-label">{t('admin.profesores.fichaGenero')}</label>
            <select
              className="admin-profesores-super__ficha-edit-input"
              value={draft.genero}
              onChange={(e) => setDraft((d) => ({ ...d, genero: e.target.value }))}
              disabled={saving}
            >
              <option value="">{t('perfil.selectGender')}</option>
              <option value="masculino">{t('instructor.generoMasculino')}</option>
              <option value="femenino">{t('instructor.generoFemenino')}</option>
              <option value="no_decir">{t('instructor.generoNoDice')}</option>
            </select>

            <div className="admin-profesores-super__ficha-edit-actions">
              <button
                type="button"
                className="admin-profesores-super__btn admin-profesores-super__btn--approve"
                disabled={saving}
                onClick={() => void guardarEdicion()}
              >
                {saving ? '…' : t('instructor.guardarCambios')}
              </button>
              <button
                type="button"
                className="admin-profesores-super__btn admin-profesores-super__btn--ghost"
                disabled={saving}
                onClick={() => {
                  setEditMode(false);
                  setDraft(rowToEditDraft(row));
                  setSaveError('');
                }}
              >
                {t('instructor.cancelar')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <FichaRow label={t('admin.profesores.fichaId')} value={String(row.id ?? '—')} />
            <FichaRow label={t('admin.profesores.fichaNombre')} value={String(row.nombre || '').trim() || '—'} />
            <FichaRow label={t('admin.profesores.fichaApellido')} value={String(row.apellido || '').trim() || '—'} />
            <FichaRow label={t('admin.profesores.fichaFechaNac')} value={formatFechaNac(row.fecha_nacimiento)} />
            <FichaRow label={t('admin.profesores.fichaGenero')} value={generoInstructorLabel(t, row.genero)} />
            <FichaRow label={t('admin.profesores.colSede')} value={row.sede_nombre || (row.sede_id != null ? `ID ${row.sede_id}` : '—')} />
            <FichaRow label={t('admin.profesores.colDeportes')} value={deportesLabel(row.deportes)} />
            <FichaRow label={t('admin.profesores.colCertificado')} value={row.certificado_fipa ? t('admin.profesores.certificadoSi') : '—'} />
            <FichaRow label={t('admin.profesores.fichaBio')} value={String(row.bio || '').trim() || '—'} />
            {isSuperAdmin ? (
              <FichaRow label={t('admin.profesores.colWhatsapp')}>
                {wa && waUrl ? (
                  <a href={`https://wa.me/${waUrl}`} target="_blank" rel="noopener noreferrer">
                    {wa}
                  </a>
                ) : (
                  '—'
                )}
              </FichaRow>
            ) : null}
            <FichaRow label={t('admin.profesores.fichaEmailLabel')} value={t('admin.profesores.fichaSinEmail')} />
            <FichaRow label={t('admin.profesores.fichaTelefonoLabel')} value={t('admin.profesores.fichaSinTelefono')} />
            <FichaRow label={t('admin.profesores.fichaAprobado')} value={boolLabel(Boolean(row.aprobado))} />
            <FichaRow label={t('admin.profesores.fichaAprobadoPor')} value={String(row.aprobado_por || '').trim() || '—'} />
            <FichaRow label={t('admin.profesores.fichaActivo')} value={boolLabel(row.activo !== false)} />
            <FichaRow label={t('admin.profesores.colFechaRegistro')} value={formatFecha(row.created_at)} />
            <FichaRow label={t('admin.profesores.fichaActualizado')} value={formatFecha(row.updated_at)} />
          </>
        )}

        <div className="admin-profesores-super__ficha-footer">
          {isSuperAdmin && !editMode ? (
            <button
              type="button"
              className="admin-profesores-super__btn admin-profesores-super__btn--ghost"
              style={{ flex: 1 }}
              onClick={() => {
                setDraft(rowToEditDraft(row));
                setEditMode(true);
                setSaveError('');
              }}
            >
              {t('admin.profesores.editar')}
            </button>
          ) : null}
          <button
            type="button"
            className="admin-profesores-super__btn admin-profesores-super__btn--approve"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            {t('admin.profesores.fichaCerrar')}
          </button>
        </div>
      </div>
    </div>
  );
}

const TH_STYLE = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--bg-card)',
  background: 'var(--accent)',
  whiteSpace: 'nowrap',
};

const TD_STYLE = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--border)',
};

export default function AdminProfesoresSuperSection({
  accessToken,
  isSuperAdmin = false,
  tabActive = false,
  onPendientesCountChange,
}) {
  const { t } = useTranslation();
  const [pendientes, setPendientes] = useState([]);
  const [aprobados, setAprobados] = useState([]);
  const [loadingPend, setLoadingPend] = useState(true);
  const [loadingApr, setLoadingApr] = useState(true);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [filtroSede, setFiltroSede] = useState('');
  const [filtroDeporte, setFiltroDeporte] = useState('');
  const [fichaRow, setFichaRow] = useState(null);

  const loadPendientes = useCallback(async () => {
    if (!accessToken) {
      setPendientes([]);
      setLoadingPend(false);
      onPendientesCountChange?.(0);
      return;
    }
    setLoadingPend(true);
    try {
      const list = await fetchAdminProfesoresTodos({ accessToken, estado: 'pendiente' });
      setPendientes(list);
      onPendientesCountChange?.(list.length);
    } catch (e) {
      setMsg(e?.message || 'Error');
      setPendientes([]);
      onPendientesCountChange?.(0);
    } finally {
      setLoadingPend(false);
    }
  }, [accessToken, onPendientesCountChange]);

  const loadAprobados = useCallback(async () => {
    if (!accessToken) {
      setAprobados([]);
      setLoadingApr(false);
      return;
    }
    setLoadingApr(true);
    try {
      const list = await fetchAdminProfesoresTodos({ accessToken, estado: 'aprobado' });
      setAprobados(list);
    } catch (e) {
      setMsg(e?.message || 'Error');
      setAprobados([]);
    } finally {
      setLoadingApr(false);
    }
  }, [accessToken]);

  const reloadAll = useCallback(async () => {
    setMsg('');
    await Promise.all([loadPendientes(), loadAprobados()]);
  }, [loadPendientes, loadAprobados]);

  useEffect(() => {
    if (!accessToken) return;
    void reloadAll();
  }, [accessToken, reloadAll]);

  useEffect(() => {
    if (tabActive && accessToken) void reloadAll();
  }, [tabActive, accessToken, reloadAll]);

  useEffect(() => {
    if (!fichaRow) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fichaRow]);

  const sedesOpciones = useMemo(() => {
    const map = new Map();
    for (const row of aprobados) {
      const id = Number(row.sede_id);
      if (!Number.isFinite(id)) continue;
      const nombre = String(row.sede_nombre || '').trim() || `Sede #${id}`;
      if (!map.has(id)) map.set(id, nombre);
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [aprobados]);

  const aprobadosFiltrados = useMemo(() => {
    const sid = filtroSede ? Number(filtroSede) : null;
    const dep = String(filtroDeporte || '').trim().toLowerCase();
    return aprobados.filter((row) => {
      if (sid != null && Number.isFinite(sid) && Number(row.sede_id) !== sid) return false;
      if (dep) {
        const deps = Array.isArray(row.deportes) ? row.deportes.map((d) => String(d).trim().toLowerCase()) : [];
        if (!deps.includes(dep)) return false;
      }
      return true;
    });
  }, [aprobados, filtroSede, filtroDeporte]);

  const aprobar = async (id) => {
    setBusyId(id);
    setBusyAction('aprobar');
    setMsg('');
    try {
      await aprobarProfesorAdmin({ profesorId: id, accessToken });
      setFichaRow(null);
      await reloadAll();
    } catch (e) {
      setMsg(e?.message || 'Error');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const rechazar = async (id) => {
    if (!window.confirm(t('admin.profesores.confirmarRechazar'))) return;
    setBusyId(id);
    setBusyAction('rechazar');
    setMsg('');
    try {
      await rechazarProfesorAdmin({ profesorId: id, accessToken });
      setFichaRow(null);
      await reloadAll();
    } catch (e) {
      setMsg(e?.message || 'Error');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const desactivar = async (id) => {
    if (!window.confirm(t('admin.profesores.confirmarDesactivar'))) return;
    setBusyId(id);
    setBusyAction('desactivar');
    setMsg('');
    try {
      await rechazarProfesorAdmin({ profesorId: id, accessToken });
      setFichaRow(null);
      await reloadAll();
    } catch (e) {
      setMsg(e?.message || 'Error');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const abrirFicha = (row) => {
    if (!isSuperAdmin) return;
    setFichaRow(row);
  };

  const handleFichaRowUpdate = useCallback((updated) => {
    setFichaRow(updated);
    setPendientes((list) => list.map((r) => (Number(r.id) === Number(updated.id) ? { ...r, ...updated } : r)));
    setAprobados((list) => list.map((r) => (Number(r.id) === Number(updated.id) ? { ...r, ...updated } : r)));
  }, []);

  if (!accessToken) return null;

  const certLabel = (row) => (row.certificado_fipa ? t('admin.profesores.certificadoSi') : '—');

  return (
    <div className="admin-profesores-super section">
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>
        {t('admin.profesores.tab')}
      </h2>
      {msg ? (
        <p style={{ color: 'var(--pm-color-error, #f87171)', fontSize: 13, marginBottom: 12 }}>{msg}</p>
      ) : null}

      <section className="admin-profesores-super__block admin-profesores-super__block--pendientes">
        <div className="admin-profesores-super__heading-row">
          <h3 className="admin-profesores-super__heading">{t('admin.profesores.pendientes')}</h3>
          {!loadingPend ? (
            <span className="admin-profesores-super__count-badge" aria-label={t('admin.profesores.pendientesCount', { count: pendientes.length })}>
              {pendientes.length}
            </span>
          ) : null}
        </div>
        {loadingPend ? (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</p>
        ) : pendientes.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{t('admin.profesores.sinPendientes')}</p>
        ) : (
          <div>
            {pendientes.map((row) => (
              <div key={row.id} className="admin-profesores-super__pending-card">
                <ProfesorAvatar row={row} />
                <div className="admin-profesores-super__pending-meta">
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{nombreProfesor(row)}</div>
                  <span className="admin-profesores-super__estado-pill admin-profesores-super__estado-pill--pendiente" style={{ marginTop: 6 }}>
                    {t('admin.profesores.estadoPendiente')}
                  </span>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {t('admin.profesores.colSede')}: {row.sede_nombre || `ID ${row.sede_id}`}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {t('admin.profesores.colDeportes')}: {deportesLabel(row.deportes)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {t('admin.profesores.colCertificado')}: {certLabel(row)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {t('admin.profesores.fichaFechaNac')}: {formatFechaNac(row.fecha_nacimiento)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {t('admin.profesores.fichaGenero')}: {generoInstructorLabel(t, row.genero)}
                  </div>
                  {String(row.bio || '').trim() ? (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>
                      {t('admin.profesores.fichaBio')}: {String(row.bio).trim()}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {t('admin.profesores.colFechaRegistro')}: {formatFecha(row.created_at)}
                  </div>
                  {isSuperAdmin ? (
                    <button
                      type="button"
                      className="admin-profesores-super__btn admin-profesores-super__btn--ghost"
                      style={{ marginTop: 8 }}
                      onClick={() => abrirFicha(row)}
                    >
                      {t('admin.profesores.verFicha')}
                    </button>
                  ) : null}
                </div>
                <div className="admin-profesores-super__pending-actions">
                  <button
                    type="button"
                    className="admin-profesores-super__btn admin-profesores-super__btn--approve"
                    disabled={busyId === row.id}
                    onClick={() => void aprobar(row.id)}
                  >
                    {busyId === row.id && busyAction === 'aprobar' ? '…' : t('admin.profesores.aprobar')}
                  </button>
                  <button
                    type="button"
                    className="admin-profesores-super__btn admin-profesores-super__btn--reject"
                    disabled={busyId === row.id}
                    onClick={() => void rechazar(row.id)}
                  >
                    {busyId === row.id && busyAction === 'rechazar' ? '…' : t('admin.profesores.rechazar')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-profesores-super__block">
        <h3 className="admin-profesores-super__heading" style={{ marginBottom: 12 }}>
          {t('admin.profesores.aprobados')}
        </h3>
        <div className="admin-profesores-super__filters">
          <label className="admin-profesores-super__filter-field">
            <span className="admin-profesores-super__filter-label">{t('admin.profesores.filtrarSede')}</span>
            <select
              className="admin-profesores-super__filter-select"
              value={filtroSede}
              onChange={(e) => setFiltroSede(e.target.value)}
              aria-label={t('admin.profesores.filtrarSede')}
            >
              <option value="">{t('admin.profesores.todasLasSedes')}</option>
              {sedesOpciones.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-profesores-super__filter-field">
            <span className="admin-profesores-super__filter-label">{t('admin.profesores.filtrarDeporte')}</span>
            <select
              className="admin-profesores-super__filter-select"
              value={filtroDeporte}
              onChange={(e) => setFiltroDeporte(e.target.value)}
              aria-label={t('admin.profesores.filtrarDeporte')}
            >
              <option value="">{t('admin.sponsors.allSports')}</option>
              {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loadingApr ? (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</p>
        ) : aprobadosFiltrados.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{t('admin.profesores.sinAprobados')}</p>
        ) : (
          <div className="admin-profesores-super__table-wrap">
            <table className="reservas-table" style={{ minWidth: 800, width: '100%' }}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>{t('admin.profesores.colFoto')}</th>
                  <th style={TH_STYLE}>{t('admin.profesores.colNombre')}</th>
                  <th style={TH_STYLE}>{t('admin.profesores.colSede')}</th>
                  <th style={TH_STYLE}>{t('admin.profesores.colDeportes')}</th>
                  <th style={TH_STYLE}>{t('admin.profesores.colCertificado')}</th>
                  {isSuperAdmin ? <th style={TH_STYLE}>{t('admin.profesores.colWhatsapp')}</th> : null}
                  <th style={TH_STYLE}>{t('admin.profesores.colEstado')}</th>
                  <th style={TH_STYLE}>{t('admin.profesores.colAcciones')}</th>
                </tr>
              </thead>
              <tbody>
                {aprobadosFiltrados.map((row) => {
                  const wa = String(row.whatsapp || '').trim();
                  const activo = row.activo !== false;
                  const waUrl = waDigitsForUrl(wa);
                  return (
                    <tr key={row.id}>
                      <td style={TD_STYLE}>
                        <button
                          type="button"
                          onClick={() => abrirFicha(row)}
                          disabled={!isSuperAdmin}
                          style={{
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            cursor: isSuperAdmin ? 'pointer' : 'default',
                          }}
                          aria-label={isSuperAdmin ? t('admin.profesores.verFicha') : undefined}
                        >
                          <ProfesorAvatar row={row} />
                        </button>
                      </td>
                      <td style={TD_STYLE}>
                        <div className="admin-profesores-super__nombre-cell">
                          <button
                            type="button"
                            onClick={() => abrirFicha(row)}
                            disabled={!isSuperAdmin}
                            style={{
                              padding: 0,
                              border: 'none',
                              background: 'none',
                              fontWeight: 700,
                              fontSize: 13,
                              color: isSuperAdmin ? 'var(--accent)' : 'var(--text-primary)',
                              cursor: isSuperAdmin ? 'pointer' : 'default',
                              textAlign: 'left',
                              fontFamily: 'inherit',
                            }}
                          >
                            {nombreProfesor(row)}
                          </button>
                        </div>
                      </td>
                      <td style={TD_STYLE}>{row.sede_nombre || `ID ${row.sede_id}`}</td>
                      <td style={TD_STYLE}>{deportesLabel(row.deportes)}</td>
                      <td style={TD_STYLE}>{certLabel(row)}</td>
                      {isSuperAdmin ? (
                        <td style={TD_STYLE}>
                          {wa && waUrl ? (
                            <a href={`https://wa.me/${waUrl}`} target="_blank" rel="noopener noreferrer">
                              {wa}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      ) : null}
                      <td style={TD_STYLE}>
                        <span
                          className={
                            activo
                              ? 'admin-profesores-super__estado-pill admin-profesores-super__estado-pill--aprobado'
                              : 'admin-profesores-super__estado-pill admin-profesores-super__estado-pill--inactivo'
                          }
                        >
                          {activo ? t('admin.profesores.estadoAprobado') : t('admin.profesores.estadoInactivo')}
                        </span>
                      </td>
                      <td style={TD_STYLE}>
                        <div className="admin-profesores-super__acciones-cell">
                          {isSuperAdmin ? (
                            <button
                              type="button"
                              className="admin-profesores-super__btn admin-profesores-super__btn--ghost"
                              onClick={() => abrirFicha(row)}
                            >
                              {t('admin.profesores.verFicha')}
                            </button>
                          ) : null}
                          {activo ? (
                            <button
                              type="button"
                              className="admin-profesores-super__btn admin-profesores-super__btn--ghost"
                              disabled={busyId === row.id}
                              onClick={() => void desactivar(row.id)}
                            >
                              {busyId === row.id && busyAction === 'desactivar'
                                ? '…'
                                : t('admin.profesores.desactivar')}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              {t('admin.profesores.mostrando', { shown: aprobadosFiltrados.length, total: aprobados.length })}
            </p>
          </div>
        )}
      </section>

      {isSuperAdmin && fichaRow ? (
        <ProfesorFichaModal
          row={fichaRow}
          isSuperAdmin={isSuperAdmin}
          accessToken={accessToken}
          onClose={() => setFichaRow(null)}
          onRowUpdate={handleFichaRowUpdate}
          t={t}
        />
      ) : null}
    </div>
  );
}

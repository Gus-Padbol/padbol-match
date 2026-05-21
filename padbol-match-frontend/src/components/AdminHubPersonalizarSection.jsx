import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ImageCropModal from './ImageCropModal';
import { defaultHubCardImageForId, fallbackCopyForHubCardId } from '../constants/hubCardDefaults';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { HUB_INICIO_CARD_IDS, deporteHubInicioDesdeRow } from '../constants/hubInicioCards';
import { hubCardPhotoPorDeporte } from '../constants/hubFotosPorDeporte';
import { HUB_JUGAR_ACTION_CARD_KEYS } from '../constants/hubJugarActionCards';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import {
  dedupeHubDeporteConfigRows,
  hubDeporteRowImagenUrl,
  mergeHubDeporteRowIntoList,
  pickHubDeporteRow,
} from '../utils/hubDeporteConfig';
import { CHIVI_AVATAR_DEFAULT_SRC, HUB_CHIVI_CONFIG_ID } from '../constants/hubChiviConfig';

const cardWrap = {
  marginBottom: '20px',
  padding: '16px',
  borderRadius: '12px',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--pm-shadow-card, 0 2px 12px rgba(0,0,0,0.12))',
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  marginBottom: '6px',
};
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: '15px',
  marginBottom: '10px',
};

function draftKeyDeporte(deporte, cardKey) {
  return `${String(deporte || '').trim().toLowerCase()}|${String(cardKey || '').trim()}`;
}

/** Evita filas inconsistentes si la API devolviera deporte/card_key distintos del pedido. */
function normalizeHubDeporteRowPayload(data, deporte, cardKey) {
  if (!data || typeof data !== 'object') return data;
  const d = String(deporte || '').trim().toLowerCase();
  const c = String(cardKey || '').trim();
  return { ...data, deporte: d, card_key: c };
}

/** Mensajes de éxito vs error legibles en claro y oscuro. */
function hubEditorNoticeStyle(text) {
  const t = String(text || '');
  if (/Guardado correctamente|Foto actualizada/i.test(t)) {
    return { color: 'var(--pm-color-success, #16a34a)', fontWeight: 600 };
  }
  return { color: 'var(--pm-color-error, #dc2626)', fontWeight: 600 };
}

export default function AdminHubPersonalizarSection({ apiBaseUrl, accessToken, isSuperAdmin = false }) {
  const { t } = useTranslation();
  const hubJugarActionCards = useMemo(
    () =>
      HUB_JUGAR_ACTION_CARD_KEYS.map((key) => ({
        key,
        label:
          key === 'reservar'
            ? t('jugar.reservar')
            : key === 'buscar_partido'
              ? t('jugar.buscar')
              : t('jugar.armar'),
      })),
    [t],
  );

  const hubOtrasDeporteCards = useMemo(
    () => [{ key: 'torneos', label: t('torneos.titulo') }],
    [t],
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const fileRef = useRef(null);
  const uploadTargetIdRef = useRef(null);

  const [deporteRows, setDeporteRows] = useState([]);
  const [deporteLoading, setDeporteLoading] = useState(true);
  const [deporteMsg, setDeporteMsg] = useState('');
  const [sportSel, setSportSel] = useState(() => DEPORTES_CANCHA_SEDE_OPTIONS[0]?.key || 'padbol');
  const [deporteDrafts, setDeporteDrafts] = useState({});
  const [savingDeporteKey, setSavingDeporteKey] = useState(null);
  const [uploadingDeporteKey, setUploadingDeporteKey] = useState(null);
  const fileRefDeporte = useRef(null);
  const uploadDeporteTargetRef = useRef(null);
  const [inicioDeporteById, setInicioDeporteById] = useState({});
  const [inicioMsg, setInicioMsg] = useState('');
  const [savingInicioId, setSavingInicioId] = useState(null);
  const [uploadingInicioId, setUploadingInicioId] = useState(null);
  const fileRefInicio = useRef(null);
  const uploadInicioTargetIdRef = useRef(null);
  const [chiviImagenUrl, setChiviImagenUrl] = useState('');
  const [savingChivi, setSavingChivi] = useState(false);
  const [uploadingChivi, setUploadingChivi] = useState(false);
  const fileRefChivi = useRef(null);
  const sportSelRef = useRef(sportSel);
  sportSelRef.current = sportSel;
  /** Tras el primer paint, solo refrescamos filas cuando el deporte del selector cambia de verdad. */
  const lastRefreshSportSelRef = useRef(null);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropUploadBusy, setCropUploadBusy] = useState(false);
  const pendingUploadRef = useRef(null);

  const HUB_CARD_CROP_ASPECT = 16 / 9;

  const cerrarCropModal = useCallback(() => {
    pendingUploadRef.current = null;
    setCropModalOpen(false);
    setCropImageSrc((prev) => {
      if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const abrirCropDesdeArchivo = useCallback((file, pending) => {
    if (!file || !pending) return;
    if (!String(file.type || '').startsWith('image/')) return false;
    pendingUploadRef.current = pending;
    setCropImageSrc((prev) => {
      if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setCropModalOpen(true);
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-config`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || t('admin.hub.hubLoadFailed'));
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      const ini = {};
      HUB_INICIO_CARD_IDS.forEach((hubId, idx) => {
        const row = list.find((x) => String(x.id) === hubId);
        ini[hubId] = deporteHubInicioDesdeRow(row, idx);
      });
      setInicioDeporteById(ini);
      const chiviRow = list.find((x) => String(x.id) === HUB_CHIVI_CONFIG_ID);
      setChiviImagenUrl(String(chiviRow?.chivi_imagen_url || chiviRow?.foto_url || '').trim());
      const d = {};
      for (const r of list) {
        const id = String(r.id || '').trim();
        if (!id || HUB_INICIO_CARD_IDS.includes(id)) continue;
        d[id] = {
          titulo: String(r.titulo ?? ''),
          subtitulo: String(r.subtitulo ?? ''),
        };
      }
      setDrafts(d);
    } catch (e) {
      setMsg(e?.message || String(e));
      setRows([]);
      setDrafts({});
      setInicioDeporteById({});
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const loadDeporte = useCallback(async () => {
    setDeporteLoading(true);
    setDeporteMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-deporte-config`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || t('admin.hub.hubSportLoadFailed'));
      const list = dedupeHubDeporteConfigRows(Array.isArray(data) ? data : []);
      setDeporteRows(list);
      const next = {};
      for (const r of list) {
        const dep = String(r.deporte || '').trim().toLowerCase();
        const ck = String(r.card_key || '').trim();
        if (!dep || !ck) continue;
        next[draftKeyDeporte(dep, ck)] = {
          titulo: String(r.titulo ?? ''),
          subtitulo: String(r.subtitulo ?? ''),
        };
      }
      setDeporteDrafts(next);
    } catch (e) {
      setDeporteMsg(e?.message || String(e));
      setDeporteRows([]);
    } finally {
      setDeporteLoading(false);
    }
  }, [apiBaseUrl]);

  const legacyHubRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          !HUB_INICIO_CARD_IDS.includes(String(r.id || '')) &&
          String(r.id || '') !== HUB_CHIVI_CONFIG_ID,
      ),
    [rows],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadDeporte();
  }, [loadDeporte]);

  const refreshDeporteRowsSilently = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-deporte-config`);
      const data = await res.json().catch(() => []);
      if (!res.ok) return;
      const list = dedupeHubDeporteConfigRows(Array.isArray(data) ? data : []);
      setDeporteRows(list);
    } catch {
      /* best-effort: no tapar el editor */
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (lastRefreshSportSelRef.current === null) {
      lastRefreshSportSelRef.current = sportSel;
      return;
    }
    if (lastRefreshSportSelRef.current === sportSel) return;
    lastRefreshSportSelRef.current = sportSel;
    void refreshDeporteRowsSilently();
  }, [sportSel, refreshDeporteRowsSilently]);

  const authHeaders = useCallback(() => {
    const h = { 'Content-Type': 'application/json' };
    if (accessToken) h.Authorization = `Bearer ${accessToken}`;
    return h;
  }, [accessToken]);

  const guardarChiviAvatar = async () => {
    if (!accessToken) {
      setMsg(t('admin.formularios.loginAgain'));
      return;
    }
    setSavingChivi(true);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-config/${encodeURIComponent(HUB_CHIVI_CONFIG_ID)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ chivi_imagen_url: chiviImagenUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('admin.metricas.saveError'));
      setRows((prev) => {
        const has = prev.some((r) => String(r.id) === HUB_CHIVI_CONFIG_ID);
        if (has) {
          return prev.map((r) => (String(r.id) === HUB_CHIVI_CONFIG_ID ? { ...r, ...data } : r));
        }
        return [...prev, data];
      });
      setChiviImagenUrl(String(data?.chivi_imagen_url || data?.foto_url || chiviImagenUrl || '').trim());
      setMsg('Guardado correctamente.');
      window.setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e?.message || String(e));
    } finally {
      setSavingChivi(false);
    }
  };

  const subirChiviFoto = async (file) => {
    setUploadingChivi(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('foto', file);
      const res = await fetch(
        `${apiBaseUrl}/api/hub-config/${encodeURIComponent(HUB_CHIVI_CONFIG_ID)}/foto`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: fd,
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('admin.hub.uploadFailed'));
      const url = String(data?.chivi_imagen_url || data?.foto_url || '').trim();
      setChiviImagenUrl(url);
      setRows((prev) => {
        const has = prev.some((r) => String(r.id) === HUB_CHIVI_CONFIG_ID);
        if (has) {
          return prev.map((r) => (String(r.id) === HUB_CHIVI_CONFIG_ID ? { ...r, ...data } : r));
        }
        return [...prev, data];
      });
      setMsg('Foto actualizada.');
      window.setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e?.message || String(e));
    } finally {
      setUploadingChivi(false);
    }
  };

  const guardarCard = async (id) => {
    if (!accessToken) {
      setMsg(t('admin.formularios.loginAgain'));
      return;
    }
    const d = drafts[id];
    if (!d) return;
    setSavingId(id);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-config/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ titulo: d.titulo, subtitulo: d.subtitulo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('admin.metricas.saveError'));
      setRows((prev) => prev.map((r) => (String(r.id) === String(id) ? { ...r, ...data } : r)));
      setMsg('Guardado correctamente.');
      window.setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e?.message || String(e));
    } finally {
      setSavingId(null);
    }
  };

  const guardarDeporteCard = async (cardKey) => {
    if (!accessToken) {
      setDeporteMsg(t('admin.formularios.loginAgain'));
      return;
    }
    const dep = String(sportSelRef.current || '').trim().toLowerCase();
    const dk = draftKeyDeporte(dep, cardKey);
    const d = deporteDrafts[dk] || { titulo: '', subtitulo: '' };
    setSavingDeporteKey(dk);
    setDeporteMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-deporte-config`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          deporte: dep,
          card_key: cardKey,
          titulo: d.titulo,
          subtitulo: d.subtitulo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('admin.metricas.saveError'));
      const normalized = normalizeHubDeporteRowPayload(data, dep, cardKey);
      setDeporteRows((prev) => mergeHubDeporteRowIntoList(prev, normalized));
      setDeporteMsg('Guardado correctamente.');
      window.setTimeout(() => setDeporteMsg(''), 2500);
    } catch (e) {
      setDeporteMsg(e?.message || String(e));
    } finally {
      setSavingDeporteKey(null);
    }
  };

  const clickCambiarFoto = (id) => {
    uploadTargetIdRef.current = id;
    fileRef.current?.click();
  };

  const clickCambiarFotoDeporte = (cardKey, deporteOverride) => {
    const dep = String(deporteOverride ?? sportSel ?? '').trim().toLowerCase();
    if (!dep) {
      setDeporteMsg(t('admin.formularios.chooseSportInSelector'));
      return;
    }
    uploadDeporteTargetRef.current = { deporte: dep, cardKey: String(cardKey || '').trim() };
    fileRefDeporte.current?.click();
  };

  const subirFotoHubConfig = async (id, file) => {
    setUploadingId(id);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('foto', file);
      const res = await fetch(`${apiBaseUrl}/api/hub-config/${encodeURIComponent(id)}/foto`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error al subir la imagen');
      setRows((prev) => prev.map((r) => (String(r.id) === String(id) ? { ...r, ...data } : r)));
      setMsg('Foto actualizada.');
      window.setTimeout(() => setMsg(''), 2500);
    } finally {
      setUploadingId(null);
    }
  };

  const subirFotoHubDeporte = async (dep, ck, file) => {
    const dk = draftKeyDeporte(dep, ck);
    setUploadingDeporteKey(dk);
    setDeporteMsg('');
    try {
      const fd = new FormData();
      fd.append('foto', file);
      const qs = new URLSearchParams({ deporte: dep, card_key: ck });
      const res = await fetch(`${apiBaseUrl}/api/hub-deporte-config/foto?${qs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error al subir la imagen');
      const normalized = normalizeHubDeporteRowPayload(data, dep, ck);
      if (
        String(data?.deporte || '').trim().toLowerCase() !== dep ||
        String(data?.card_key || '').trim() !== ck
      ) {
        throw new Error(t('admin.hub.wrongSportCardSaved'));
      }
      setDeporteRows((prev) => mergeHubDeporteRowIntoList(prev, normalized));
      await refreshDeporteRowsSilently();
      setDeporteMsg('Foto actualizada.');
      window.setTimeout(() => setDeporteMsg(''), 2500);
    } finally {
      setUploadingDeporteKey(null);
    }
  };

  const subirFotoHubInicio = async (id, file) => {
    setUploadingInicioId(id);
    setInicioMsg('');
    try {
      const fd = new FormData();
      fd.append('foto', file);
      const res = await fetch(`${apiBaseUrl}/api/hub-config/${encodeURIComponent(id)}/foto`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error al subir la imagen');
      setRows((prev) => prev.map((r) => (String(r.id) === String(id) ? { ...r, ...data } : r)));
      setInicioMsg('Foto actualizada.');
      window.setTimeout(() => setInicioMsg(''), 2500);
    } finally {
      setUploadingInicioId(null);
    }
  };

  const handleCropConfirm = useCallback(
    async (file) => {
      const pending = pendingUploadRef.current;
      if (!pending || !accessToken) return;
      setCropUploadBusy(true);
      try {
        if (pending.kind === 'legacy') {
          await subirFotoHubConfig(pending.id, file);
        } else if (pending.kind === 'inicio') {
          await subirFotoHubInicio(pending.id, file);
        } else if (pending.kind === 'deporte') {
          await subirFotoHubDeporte(pending.deporte, pending.cardKey, file);
        }
        cerrarCropModal();
      } catch (err) {
        const text = err?.message || String(err);
        if (pending.kind === 'legacy') setMsg(text);
        else if (pending.kind === 'inicio') setInicioMsg(text);
        else setDeporteMsg(text);
      } finally {
        setCropUploadBusy(false);
      }
    },
    [accessToken, apiBaseUrl, cerrarCropModal, refreshDeporteRowsSilently],
  );

  const onFileChange = (e) => {
    const id = uploadTargetIdRef.current;
    const file = e.target.files?.[0];
    e.target.value = '';
    uploadTargetIdRef.current = null;
    if (!id || !file) return;
    if (!accessToken) {
      setMsg(t('admin.formularios.loginAgainUpload'));
      return;
    }
    if (!abrirCropDesdeArchivo(file, { kind: 'legacy', id })) {
      setMsg(t('admin.formularios.chooseImageFile'));
    }
  };

  const onFileChangeDeporte = (e) => {
    const target = uploadDeporteTargetRef.current;
    const file = e.target.files?.[0];
    e.target.value = '';
    uploadDeporteTargetRef.current = null;
    if (!accessToken) {
      setDeporteMsg(t('admin.formularios.loginAgainUpload'));
      return;
    }
    if (!target) {
      setDeporteMsg(t('admin.formularios.chooseChangePhotoAgain'));
      return;
    }
    const dep = String(target.deporte || '').trim().toLowerCase();
    const ck = String(target.cardKey || '').trim();
    if (!dep || !ck) {
      setDeporteMsg(t('admin.formularios.chooseChangePhotoAgain'));
      return;
    }
    if (!file) return;
    if (!abrirCropDesdeArchivo(file, { kind: 'deporte', deporte: dep, cardKey: ck })) {
      setDeporteMsg(t('admin.formularios.chooseImageFile'));
    }
  };

  const guardarInicioDeporte = async (slotId) => {
    if (!accessToken) {
      setInicioMsg(t('admin.formularios.loginAgain'));
      return;
    }
    const dep = String(inicioDeporteById[slotId] || '').trim().toLowerCase();
    if (!dep) {
      setInicioMsg(t('admin.formularios.chooseSport'));
      return;
    }
    setSavingInicioId(slotId);
    setInicioMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-config/${encodeURIComponent(slotId)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ titulo: dep, subtitulo: '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('admin.metricas.saveError'));
      setRows((prev) => prev.map((r) => (String(r.id) === String(slotId) ? { ...r, ...data } : r)));
      setInicioMsg('Guardado correctamente.');
      window.setTimeout(() => setInicioMsg(''), 2500);
    } catch (e) {
      setInicioMsg(e?.message || String(e));
    } finally {
      setSavingInicioId(null);
    }
  };

  const clickCambiarFotoInicio = (slotId) => {
    uploadInicioTargetIdRef.current = slotId;
    fileRefInicio.current?.click();
  };

  const onFileChangeInicio = (e) => {
    const id = uploadInicioTargetIdRef.current;
    const file = e.target.files?.[0];
    e.target.value = '';
    uploadInicioTargetIdRef.current = null;
    if (!id || !file) return;
    if (!accessToken) {
      setInicioMsg(t('admin.formularios.loginAgainUpload'));
      return;
    }
    if (!abrirCropDesdeArchivo(file, { kind: 'inicio', id })) {
      setInicioMsg(t('admin.formularios.chooseImageFile'));
    }
  };

  const rowDeporteActual = (cardKey) => pickHubDeporteRow(deporteRows, sportSel, cardKey);

  const renderDeporteCardEditor = (cardKey, label) => {
    const dk = draftKeyDeporte(sportSel, cardKey);
    const draft = deporteDrafts[dk] || { titulo: '', subtitulo: '' };
    const row = rowDeporteActual(cardKey);
    const previewUrl =
      hubDeporteRowImagenUrl(row) ||
      defaultHubCardImageForId(cardKey === 'buscar_partido' ? 'partidos' : cardKey);
    const saving = savingDeporteKey === dk;
    const uploading = uploadingDeporteKey === dk;
    return (
      <div key={dk} className="admin-hub-editor-card" style={cardWrap}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
          {label}
        </div>
        <div
          style={{
            display: 'flex',
            gap: '14px',
            flexWrap: 'wrap',
            marginBottom: '12px',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: '0 0 140px' }}>
            <span style={labelStyle}>{t('admin.hub.previewLabel')}</span>
            <div
              style={{
                width: '140px',
                height: '88px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: '#64748b center/cover no-repeat',
                backgroundImage: `url(${previewUrl})`,
              }}
            />
          </div>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <button
              type="button"
              disabled={uploading || !accessToken}
              onClick={() => clickCambiarFotoDeporte(cardKey, sportSel)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: uploading ? '#94a3b8' : '#E11B22',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: uploading || !accessToken ? 'not-allowed' : 'pointer',
              }}
            >
              {uploading ? 'Subiendo…' : t('admin.hub.changePhoto')}
            </button>
          </div>
        </div>
        <label style={labelStyle}>{t('admin.hub.titleOptionalHint')}</label>
        <input
          type="text"
          style={inputStyle}
          value={draft.titulo}
          placeholder={label}
          onChange={(e) =>
            setDeporteDrafts((p) => ({
              ...p,
              [dk]: { ...draft, titulo: e.target.value },
            }))
          }
        />
        <label style={labelStyle}>{t('admin.hub.subtitle')}</label>
        <input
          type="text"
          style={inputStyle}
          value={draft.subtitulo}
          placeholder={t('admin.hub.optional')}
          onChange={(e) =>
            setDeporteDrafts((p) => ({
              ...p,
              [dk]: { ...draft, subtitulo: e.target.value },
            }))
          }
        />
        <button
          type="button"
          disabled={saving || !accessToken}
          onClick={() => void guardarDeporteCard(cardKey)}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: saving ? '#94a3b8' : '#E11B22',
            color: '#fff',
            fontWeight: 700,
            fontSize: '14px',
            cursor: saving || !accessToken ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? t('admin.metricas.saving') : t('admin.hub.saveText')}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="section" style={{ color: 'var(--text-primary)' }}>
        <p style={{ margin: 0 }}>{t('admin.hub.loadingHubConfig')}</p>
      </div>
    );
  }

  return (
    <div className="section admin-hub-personalizar-root" style={{ color: 'var(--text-primary)' }}>
      <h2 style={{ marginBottom: '16px', paddingBottom: '8px', color: 'var(--text-primary)' }}>
        Personalizar Hub
      </h2>

      {isSuperAdmin ? (
        <div className="admin-hub-editor-card" style={{ ...cardWrap, marginBottom: '22px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {t('admin.hub.chiviAvatarTitle')}
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {t('admin.hub.chiviAvatarHint')}
          </p>
          <input
            ref={fileRefChivi}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(ev) => {
              const file = ev.target.files?.[0];
              ev.target.value = '';
              if (file) void subirChiviFoto(file);
            }}
          />
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '12px' }}>
            <img
              src={chiviImagenUrl || CHIVI_AVATAR_DEFAULT_SRC}
              alt="Chivi"
              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--border)' }}
            />
            <div style={{ flex: '1', minWidth: '200px' }}>
              <button
                type="button"
                disabled={uploadingChivi || !accessToken}
                onClick={() => fileRefChivi.current?.click()}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: uploadingChivi ? '#94a3b8' : '#E11B22',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: uploadingChivi || !accessToken ? 'not-allowed' : 'pointer',
                  marginBottom: '8px',
                }}
              >
                {uploadingChivi ? 'Subiendo…' : t('admin.hub.chiviUpload')}
              </button>
              <label style={labelStyle}>{t('admin.hub.chiviUrlLabel')}</label>
              <input
                type="url"
                style={inputStyle}
                value={chiviImagenUrl}
                placeholder={CHIVI_AVATAR_DEFAULT_SRC}
                onChange={(e) => setChiviImagenUrl(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={savingChivi || !accessToken}
            onClick={() => void guardarChiviAvatar()}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: savingChivi ? '#94a3b8' : '#E11B22',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              cursor: savingChivi || !accessToken ? 'not-allowed' : 'pointer',
            }}
          >
            {savingChivi ? t('admin.metricas.saving') : t('general.save')}
          </button>
        </div>
      ) : null}

      <h3
        style={{
          margin: '0 0 10px',
          fontSize: '16px',
          fontWeight: 800,
          color: 'var(--text-primary)',
        }}
      >
        Pantalla de inicio
      </h3>
      {inicioMsg ? (
        <p role="status" style={{ fontSize: '14px', marginBottom: '14px', ...hubEditorNoticeStyle(inicioMsg) }}>
          {inicioMsg}
        </p>
      ) : null}
      <input
        ref={fileRefInicio}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(ev) => void onFileChangeInicio(ev)}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '14px',
          marginBottom: '22px',
          maxWidth: '390px',
        }}
      >
        {HUB_INICIO_CARD_IDS.map((slotId, idx) => {
          const row = rows.find((r) => String(r.id) === slotId);
          const depSel = inicioDeporteById[slotId] ?? deporteHubInicioDesdeRow(row, idx);
          const previewUrl =
            String(row?.foto_url || '').trim() || hubCardPhotoPorDeporte(depSel, 'reservar');
          const saving = savingInicioId === slotId;
          const uploading = uploadingInicioId === slotId;
          return (
            <div key={slotId} className="admin-hub-editor-card" style={cardWrap}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
                Card {idx + 1}
              </div>
              <label style={{ ...labelStyle, color: 'var(--text-secondary)' }} htmlFor={`hub-inicio-deporte-${slotId}`}>
                Deporte
              </label>
              <select
                id={`hub-inicio-deporte-${slotId}`}
                value={depSel}
                onChange={(e) =>
                  setInicioDeporteById((p) => ({
                    ...p,
                    [slotId]: e.target.value,
                  }))
                }
                style={{
                  ...inputStyle,
                  maxWidth: '360px',
                  marginBottom: '14px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {DEPORTES_CANCHA_SEDE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'flex-start' }}>
                <div style={{ flex: '0 0 140px' }}>
                  <span style={labelStyle}>{t('admin.hub.previewLabel')}</span>
                  <div
                    style={{
                      width: '140px',
                      height: '88px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      background: '#64748b center/cover no-repeat',
                      backgroundImage: `url(${previewUrl})`,
                    }}
                  />
                </div>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <button
                    type="button"
                    disabled={uploading || !accessToken}
                    onClick={() => clickCambiarFotoInicio(slotId)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: uploading ? '#94a3b8' : '#E11B22',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: uploading || !accessToken ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {uploading ? 'Subiendo…' : 'Cambiar foto'}
                  </button>
                </div>
              </div>
              <button
                type="button"
                disabled={saving || !accessToken}
                onClick={() => void guardarInicioDeporte(slotId)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: saving ? '#94a3b8' : '#E11B22',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: saving || !accessToken ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? t('admin.metricas.saving') : t('admin.hub.saveSport')}
              </button>
            </div>
          );
        })}
      </div>

      <h3
        style={{
          margin: '0 0 10px',
          fontSize: '16px',
          fontWeight: 800,
          color: 'var(--text-primary)',
        }}
      >
        {t('admin.hub.jugarScreenTitle')}
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {t('admin.hub.jugarScreenIntro')}
      </p>
      {deporteMsg ? (
        <p role="status" style={{ fontSize: '14px', marginBottom: '14px', ...hubEditorNoticeStyle(deporteMsg) }}>
          {deporteMsg}
        </p>
      ) : null}
      <input
        ref={fileRefDeporte}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(ev) => void onFileChangeDeporte(ev)}
      />

      <label style={{ ...labelStyle, color: 'var(--text-secondary)' }} htmlFor="hub-admin-deporte-select">
        {t('admin.hub.sportForCards')}
      </label>
      <select
        id="hub-admin-deporte-select"
        value={sportSel}
        onChange={(e) => setSportSel(e.target.value)}
        style={{
          ...inputStyle,
          maxWidth: '360px',
          marginBottom: '18px',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        {DEPORTES_CANCHA_SEDE_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>

      {deporteLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>{t('admin.hub.loadingSportConfig')}</p>
      ) : (
        hubJugarActionCards.map(({ key: cardKey, label }) => renderDeporteCardEditor(cardKey, label))
      )}

      <h3
        style={{
          margin: '28px 0 10px',
          fontSize: '16px',
          fontWeight: 800,
          color: 'var(--text-primary)',
        }}
      >
        {t('admin.hub.hubTorneosCardTitle')}
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {t('admin.hub.hubTorneosCardIntro')}
      </p>
      {deporteLoading ? null : hubOtrasDeporteCards.map(({ key: cardKey, label }) => renderDeporteCardEditor(cardKey, label))}

      <h3
        style={{
          margin: '28px 0 10px',
          fontSize: '16px',
          fontWeight: 800,
          color: 'var(--text-primary)',
        }}
      >
        Cards globales (legacy)
      </h3>
      {msg ? (
        <p role="status" style={{ fontSize: '14px', marginBottom: '14px', ...hubEditorNoticeStyle(msg) }}>
          {msg}
        </p>
      ) : null}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(ev) => void onFileChange(ev)} />

      {!legacyHubRows.length ? (
        <p style={{ color: 'var(--text-secondary)', marginBottom: '14px' }}>{t('admin.hub.noGlobalCards')}</p>
      ) : null}

      {legacyHubRows.map((row) => {
        const id = String(row.id || '').trim();
        const draft = drafts[id] || { titulo: '', subtitulo: '' };
        const fb = fallbackCopyForHubCardId(id);
        const previewUrl = String(row.foto_url || '').trim() || defaultHubCardImageForId(id);
        return (
          <div key={id} className="admin-hub-editor-card" style={cardWrap}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', marginBottom: '10px' }}>
              ID: {id}
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'flex-start' }}>
              <div style={{ flex: '0 0 140px' }}>
                <span style={labelStyle}>{t('admin.hub.previewLabel')}</span>
                <div
                  style={{
                    width: '140px',
                    height: '88px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    background: '#64748b center/cover no-repeat',
                    backgroundImage: `url(${previewUrl})`,
                  }}
                />
              </div>
              <div style={{ flex: '1', minWidth: '200px' }}>
                <button
                  type="button"
                  disabled={uploadingId === id || !accessToken}
                  onClick={() => clickCambiarFoto(id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: uploadingId === id ? '#94a3b8' : '#E11B22',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: uploadingId === id || !accessToken ? 'not-allowed' : 'pointer',
                  }}
                >
                  {uploadingId === id ? 'Subiendo…' : 'Cambiar foto'}
                </button>
                {!accessToken ? (
                  <p style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px' }}>{t('admin.hub.sessionRequiredUpload')}</p>
                ) : null}
              </div>
            </div>

            <label style={labelStyle}>
              Título {(!draft.titulo?.trim() && fb.titulo) ? `(por defecto: ${fb.titulo})` : null}
            </label>
            <input
              type="text"
              style={inputStyle}
              value={draft.titulo}
              placeholder={fb.titulo}
              onChange={(e) => setDrafts((p) => ({ ...p, [id]: { ...draft, titulo: e.target.value } }))}
            />

            <label style={labelStyle}>{t('admin.hub.subtitle')}</label>
            <input
              type="text"
              style={inputStyle}
              value={draft.subtitulo}
              placeholder={fb.subtitulo || t('admin.hub.optional')}
              onChange={(e) => setDrafts((p) => ({ ...p, [id]: { ...draft, subtitulo: e.target.value } }))}
            />

            <button
              type="button"
              disabled={savingId === id || !accessToken}
              onClick={() => void guardarCard(id)}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: savingId === id ? '#94a3b8' : '#E11B22',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: savingId === id || !accessToken ? 'not-allowed' : 'pointer',
              }}
            >
              {savingId === id ? t('admin.metricas.saving') : t('general.save')}
            </button>
          </div>
        );
      })}

      <ImageCropModal
        open={cropModalOpen}
        imageSrc={cropImageSrc}
        onClose={cerrarCropModal}
        onConfirm={handleCropConfirm}
        aspect={HUB_CARD_CROP_ASPECT}
        cropShape="rect"
        title={t('admin.hub.cropHubPhoto')}
        description={t('admin.hub.cropHubHint')}
        confirmLabel={t('admin.hub.confirmAndUpload')}
        confirmColor="#E11B22"
        busy={cropUploadBusy}
        zoomInputId="admin-hub-crop-zoom"
      />
    </div>
  );
}

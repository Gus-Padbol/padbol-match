import { stripAdminEmoji } from '../i18n/adminTranslation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HubPhotoEditorModal from './HubPhotoEditorModal';
import {hubPhotoFrames} from '../utils/hubPhotoFrame';
import {fetchHubPhotoSource, saveHubPhotoEdit} from '../utils/hubPhotoEditorApi';
import { defaultHubCardImageForId, fallbackCopyForHubCardId } from '../constants/hubCardDefaults';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { HUB_INICIO_CARD_IDS, deporteHubInicioDesdeRow } from '../constants/hubInicioCards';
import { hubCardPhotoPorDeporte } from '../constants/hubFotosPorDeporte';
import { HUB_JUGAR_ACTION_CARD_KEYS } from '../constants/hubJugarActionCards';
import { useSafeTranslation as useTranslation } from '../i18n/adminTranslation';
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
  if (/^|Guardado correctamente|Foto actualizada/i.test(t)) {
    return { color: 'var(--pm-color-success, #16a34a)', fontWeight: 600 };
  }
  return { color: 'var(--pm-color-error, #dc2626)', fontWeight: 600 };
}

// The same image is shared by Home and Jugar in the installed app.
// Show both renderings; selecting one crop ratio must not hide the other crop.
export const HUB_PHONE_VIEWS = [
  {id: 'compact', label: 'iPhone · pantalla compacta', width: 375, height: 812, topInset: 44, bottomInset: 34},
  {id: 'medium', label: 'iPhone · pantalla mediana', width: 390, height: 844, topInset: 47, bottomInset: 34},
  {id: 'large', label: 'iPhone · pantalla grande', width: 430, height: 932, topInset: 59, bottomInset: 34},
];

const HUB_SAFE_FRAMES = HUB_PHONE_VIEWS.flatMap(view => [...hubPhotoFrames(view), ...hubPhotoFrames({...view, isGuest: true})]);

function HubPhotoPreview({src, frames, onAdjust, disabled, loading = false, error = ''}) {
  return <>
    <div style={{display: 'grid', gap: 10}}>
      {frames.map(frame => <div key={frame.id}>
        <span style={{fontSize: 11, color: 'var(--text-secondary)'}}>{frame.label}</span>
        <div data-testid="hub-photo-frame" style={{width: '100%', aspectRatio: `${frame.width} / ${frame.height}`, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: '#0f172a'}}>
          <img src={src} alt={`Vista previa ${frame.label}`} style={{display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center'}} />
        </div>
      </div>)}
    </div>
    <button type="button" disabled={disabled} onClick={onAdjust} style={{marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: disabled ? 'not-allowed' : 'pointer'}}>{loading ? 'Cargando original…' : 'Ajustar encuadre'}</button>
    {error ? <p role="alert" style={{margin: '8px 0 0', color: '#dc2626', fontSize: 12, lineHeight: 1.45}}>{error} Usá <strong>Cambiar foto</strong> para elegir el archivo original.</p> : null}
  </>;
}


export const PRACTICE_IMAGE_ORIGIN = (url) => {
  try {
    const u = new URL(String(url), typeof window !== 'undefined' ? window.location.origin : 'https://www.padbolmatch.com');
    if (u.protocol !== 'https:' || u.username || u.password || u.hash) return null;
    const allowed = u.hostname === 'auth.padbolmatch.com'
      || u.hostname === 'www.padbolmatch.com'
      || u.hostname === 'vpldffhsxhgnmitiikof.supabase.co';
    if (!allowed) return null;
    if (u.pathname === '/brand/next-generation-youth.png' && u.hostname === 'www.padbolmatch.com') return u;
    if (!u.pathname.startsWith('/storage/v1/object/public/hub-images/')) return null;
    return u;
  } catch { return null; }
};
async function downloadCurrentHubImage(src) {
  const url = PRACTICE_IMAGE_ORIGIN(src);
  if (!url) throw new Error('La imagen actual no está en un origen permitido.');
  const response = await fetch(url.href, {credentials: 'omit', cache: 'no-store', redirect: 'error'});
  if (!response.ok) throw new Error('No se pudo descargar la imagen actual.');
  const type = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!['image/jpeg','image/png','image/webp'].includes(type)) throw new Error('La imagen actual no tiene un formato admitido.');
  const blob = await response.blob();
  if (!blob.size || blob.size > 10 * 1024 * 1024) throw new Error('La imagen actual supera 10 MB.');
  return new File([blob], 'imagen-actual.' + (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'), {type});
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

  const [cropError, setCropError] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const fileRef = useRef(null);
  const uploadTargetIdRef = useRef(null);

  const [deporteRows, setDeporteRows] = useState([]);
  const [deporteLoading, setDeporteLoading] = useState(true);
  const [deporteMsg, setDeporteMsg] = useState('');
  const [sportSel, setSportSel] = useState(() => DEPORTES_CANCHA_SEDE_OPTIONS[0]?.key || 'padbol');
  const hubOtrasDeporteCards = useMemo(
    () => [{ key: 'torneos', label: t('torneos.titulo') }, ...(sportSel === 'padbol' ? [{ key: 'next_generation', label: 'Next Generation · Padbol' }] : [])],
    [t, sportSel],
  );
  const [deporteDrafts, setDeporteDrafts] = useState({});
  const [savingDeporteKey, setSavingDeporteKey] = useState(null);
  const fileRefDeporte = useRef(null);
  const uploadDeporteTargetRef = useRef(null);
  const [inicioDeporteById, setInicioDeporteById] = useState({});
  const [inicioMsg, setInicioMsg] = useState('');
  const [savingInicioId, setSavingInicioId] = useState(null);
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
  const uploadingId = cropUploadBusy && pendingUploadRef.current?.kind === 'legacy' ? pendingUploadRef.current.id : null;
  const uploadingInicioId = cropUploadBusy && pendingUploadRef.current?.kind === 'inicio' ? pendingUploadRef.current.id : null;
  const uploadingDeporteKey = cropUploadBusy && pendingUploadRef.current?.kind === 'deporte' ? draftKeyDeporte(pendingUploadRef.current.deporte, pendingUploadRef.current.cardKey) : null;

  const [phoneViewId, setPhoneViewId] = useState('medium');
  const phoneView = HUB_PHONE_VIEWS.find(view => view.id === phoneViewId) || HUB_PHONE_VIEWS[1];
  const photoFrames = useMemo(() => hubPhotoFrames(phoneView), [phoneView]);
  const [cropSource, setCropSource] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [sourceErrorTarget, setSourceErrorTarget] = useState('');
  const [sourceLoadingTarget, setSourceLoadingTarget] = useState('');
  const [sourceNotice, setSourceNotice] = useState('');
  const editGenerationRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const authScopeRef = useRef({apiBaseUrl, accessToken});
  authScopeRef.current = {apiBaseUrl, accessToken, imageSrc: cropImageSrc};

  const cerrarCropModal = useCallback(() => {
    editGenerationRef.current += 1;
    pendingUploadRef.current = null;
    saveInFlightRef.current = false;
    setCropModalOpen(false); setCropSource(null); setSourceLoading(false); setCropUploadBusy(false); setSourceNotice('');
    setCropImageSrc(prev => {
      if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);
  useEffect(() => { cerrarCropModal(); }, [apiBaseUrl, accessToken, cerrarCropModal]);
  useEffect(() => () => {
    editGenerationRef.current += 1;
    const src = authScopeRef.current.imageSrc;
    if (src && String(src).startsWith('blob:')) URL.revokeObjectURL(src);
  }, []);
  useEffect(() => {
    if (pendingUploadRef.current?.kind === 'deporte' && pendingUploadRef.current.deporte !== sportSel) cerrarCropModal();
  }, [sportSel, cerrarCropModal]);

  const targetKey = (pending) => pending?.kind === 'deporte' ? `deporte:${pending.deporte}:${pending.cardKey || pending.card_key}` : `${pending?.kind}:${pending?.id}`;

  const abrirCropDesdeUrl = useCallback(async (src, pending) => {
    if (!src || !pending || !accessToken) return;
    cerrarCropModal();
    const generation = editGenerationRef.current;
    pendingUploadRef.current = {...pending, expectedImageUrl: src};
    setSourceLoading(true); setSourceLoadingTarget(targetKey(pending)); setSourceError(''); setSourceErrorTarget(targetKey(pending));
    try {
      const source = await fetchHubPhotoSource({apiBaseUrl, accessToken, target: pending, expectedImageUrl: src});
      if (generation !== editGenerationRef.current || authScopeRef.current.accessToken !== accessToken || authScopeRef.current.apiBaseUrl !== apiBaseUrl) return;
      const savedPhone = HUB_PHONE_VIEWS.find(view => view.width === source.frame?.viewport?.width && view.height === source.frame?.viewport?.height);
      if (savedPhone) setPhoneViewId(savedPhone.id);
      setCropSource({sourceId: source.sourceId, originalFile: null, initialPixels: source.frame?.pixels || null});
      setCropImageSrc(URL.createObjectURL(source.original));
      setCropError(''); setCropModalOpen(true);
    } catch (err) {
      if (generation !== editGenerationRef.current) return;
      if (err?.code === 'SOURCE_NOT_AVAILABLE') {
        try {
          const file = await downloadCurrentHubImage(src);
          if (generation !== editGenerationRef.current) return;
          pendingUploadRef.current = {...pending, sourceId: null, expectedImageUrl: src};
          setCropSource({sourceId: null, originalFile: file, initialPixels: null});
          setCropImageSrc(URL.createObjectURL(file));
          setSourceError(''); setSourceErrorTarget('');
          setSourceNotice('Editando la imagen disponible; si faltan partes ya recortadas, cargá la foto original.');
          setCropError('');
          setCropModalOpen(true);
        } catch (fallbackError) {
          if (generation === editGenerationRef.current) { setSourceError(fallbackError?.message || 'No se pudo abrir la imagen actual.'); setSourceErrorTarget(targetKey(pending)); pendingUploadRef.current = null; }
        }
      } else if (generation === editGenerationRef.current) {
        setSourceError(err?.message || 'No se pudo recuperar el original. Elegí su archivo de nuevo.');
        setSourceErrorTarget(targetKey(pending));
        pendingUploadRef.current = null;
      }
    } finally { if (generation === editGenerationRef.current) { setSourceLoading(false); setSourceLoadingTarget(''); } }
  }, [accessToken, apiBaseUrl, cerrarCropModal]);

  const abrirCropDesdeArchivo = useCallback((file, pending) => {
    if (!file || !pending || !['image/jpeg', 'image/png', 'image/webp'].includes(String(file.type || ''))) return false;
    if (file.size > 10 * 1024 * 1024) { setSourceError('La foto original supera 10 MB. Elige una imagen más pequeña.'); return true; }
    cerrarCropModal();
    const current = pending.kind === 'deporte'
      ? deporteRows.find(row => row.deporte === pending.deporte && row.card_key === pending.cardKey)?.imagen_url
      : rows.find(row => String(row.id) === String(pending.id))?.foto_url;
    pendingUploadRef.current = {...pending, expectedImageUrl: current ?? null};
    setCropSource({sourceId: null, originalFile: file, initialPixels: null});
    setCropImageSrc(URL.createObjectURL(file));
    setCropError(''); setSourceError(''); setSourceErrorTarget(''); setSourceLoadingTarget(''); setSourceNotice(''); setCropModalOpen(true);
    return true;
  }, [cerrarCropModal, deporteRows, rows]);

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
  }, [apiBaseUrl, t]);

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
  }, [apiBaseUrl, t]);

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
      setMsg(t('admin.hub.imageUploaded'));
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

  const handleCropConfirm = useCallback(async (file, composition) => {
    const pending = pendingUploadRef.current;
    if (!pending || !cropSource || !accessToken || saveInFlightRef.current || composition?.originalSrc !== authScopeRef.current.imageSrc) return;
    const generation = editGenerationRef.current;
    saveInFlightRef.current = true; setCropError(''); setCropUploadBusy(true);
    try {
      const data = await saveHubPhotoEdit({apiBaseUrl, accessToken, target: pending, photo: file, expectedImageUrl: pending.expectedImageUrl,
        original: cropSource.originalFile, sourceId: cropSource.sourceId,
        frame: {version: 1, pixels: composition.pixels, viewport: {width: phoneView.width, height: phoneView.height}}});
      if (generation !== editGenerationRef.current || authScopeRef.current.accessToken !== accessToken || authScopeRef.current.apiBaseUrl !== apiBaseUrl) return;
      if (pending.kind === 'deporte') {
        const normalized = normalizeHubDeporteRowPayload(data.row, pending.deporte, pending.cardKey);
        setDeporteRows(prev => mergeHubDeporteRowIntoList(prev, normalized));
        setDeporteMsg(t('admin.hub.imageUploaded'));
      } else {
        setRows(prev => prev.map(row => String(row.id) === String(pending.id) ? {...row, ...data.row} : row));
        if (pending.kind === 'inicio') setInicioMsg(t('admin.hub.imageUploaded'));
        else setMsg(t('admin.hub.imageUploaded'));
      }
      cerrarCropModal();
    } catch (err) {
      if (generation === editGenerationRef.current) setCropError(err?.message || 'No se pudo guardar la foto y su original. Intenta de nuevo.');
    } finally {
      if (generation === editGenerationRef.current) { saveInFlightRef.current = false; setCropUploadBusy(false); }
    }
  }, [accessToken, apiBaseUrl, cropSource, phoneView, cerrarCropModal, t]);

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
      <div key={dk} data-testid={`hub-editor-${dk}`} className="admin-hub-editor-card" style={cardWrap}>
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
          <div style={{ flex: '1 1 300px', maxWidth: '390px' }}>
            <span style={labelStyle}>{t('admin.hub.previewLabel')}</span>
            <HubPhotoPreview src={previewUrl} frames={photoFrames} disabled={uploading || sourceLoading || cropUploadBusy || !accessToken} loading={sourceLoading && sourceLoadingTarget === targetKey({kind: 'deporte', deporte: sportSel, cardKey})} error={sourceErrorTarget === targetKey({kind: 'deporte', deporte: sportSel, cardKey}) ? sourceError : ''} onAdjust={() => abrirCropDesdeUrl(previewUrl, {kind: 'deporte', deporte: sportSel, cardKey})} />
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

      <div style={cardWrap}>
        <label htmlFor="hub-phone-view" style={labelStyle}>Comprobar las vistas del teléfono</label>
        <select id="hub-phone-view" value={phoneViewId} onChange={event => setPhoneViewId(event.target.value)} style={inputStyle}>
          {HUB_PHONE_VIEWS.map(view => <option key={view.id} value={view.id}>{view.label}</option>)}
        </select>
        <p style={{margin: 0, fontSize: 13, lineHeight: 1.45}}>La misma foto aparece en Inicio y Jugar. Revisa ambas vistas al acomodarla. Conservamos el original para que puedas volver a editarla.</p>
        {sourceLoading ? <p role="status">Abriendo la foto original…</p> : null}
        {sourceError ? <p role="alert" style={{color: '#dc2626'}}>{sourceError}</p> : null}
      </div>

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
          {stripAdminEmoji(inicioMsg)}
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
                <div style={{ flex: '1 1 300px', maxWidth: '390px' }}>
                  <span style={labelStyle}>{t('admin.hub.previewLabel')}</span>
                  <HubPhotoPreview src={previewUrl} frames={photoFrames} disabled={uploading || sourceLoading || cropUploadBusy || !accessToken} loading={sourceLoading && sourceLoadingTarget === targetKey({kind: 'inicio', id: slotId})} error={sourceErrorTarget === targetKey({kind: 'inicio', id: slotId}) ? sourceError : ''} onAdjust={() => abrirCropDesdeUrl(previewUrl, {kind: 'inicio', id: slotId})} />
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
          {stripAdminEmoji(deporteMsg)}
        </p>
      ) : null}
      <input
        data-testid="hub-deporte-file"
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

      <details className="admin-hub-legacy-details">
        <summary style={{fontWeight:700,padding:12,cursor:'pointer'}}>Tarjetas adicionales del hub</summary>
      <h3
        style={{
          margin: '28px 0 10px',
          fontSize: '16px',
          fontWeight: 800,
          color: 'var(--text-primary)',
        }}
      >
        Tarjetas adicionales
      </h3>
      {msg ? (
        <p role="status" style={{ fontSize: '14px', marginBottom: '14px', ...hubEditorNoticeStyle(msg) }}>
          {stripAdminEmoji(msg)}
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
              {draft.titulo || fb.titulo || 'Tarjeta del hub'}
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 300px', maxWidth: '390px' }}>
                <span style={labelStyle}>{t('admin.hub.previewLabel')}</span>
                <HubPhotoPreview src={previewUrl} frames={photoFrames} disabled={uploadingId === id || sourceLoading || cropUploadBusy || !accessToken} loading={sourceLoading && sourceLoadingTarget === targetKey({kind: 'legacy', id})} error={sourceErrorTarget === targetKey({kind: 'legacy', id}) ? sourceError : ''} onAdjust={() => abrirCropDesdeUrl(previewUrl, {kind: 'legacy', id})} />
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
                  {uploadingId === id ? t('admin.hub.uploading') : t('admin.hub.changePhoto')}
                </button>
                {!accessToken ? (
                  <p style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px' }}>{t('admin.hub.sessionRequiredUpload')}</p>
                ) : null}
              </div>
            </div>

            <label htmlFor={`hub-legacy-title-${id}`} style={labelStyle}>
              {t('admin.hub.title')} {(!draft.titulo?.trim() && fb.titulo) ? t('admin.hub.defaultValue', { value: fb.titulo }) : null}
            </label>
            <input
              id={`hub-legacy-title-${id}`}
              type="text"
              style={{...inputStyle,maxWidth:640}}
              value={draft.titulo}
              placeholder={fb.titulo}
              onChange={(e) => setDrafts((p) => ({ ...p, [id]: { ...draft, titulo: e.target.value } }))}
            />

            <label htmlFor={`hub-legacy-subtitle-${id}`} style={labelStyle}>{t('admin.hub.subtitle')}</label>
            <input
              id={`hub-legacy-subtitle-${id}`}
              type="text"
              style={{...inputStyle,maxWidth:640}}
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

      </details>
      <HubPhotoEditorModal
        error={cropError}
        open={cropModalOpen}
        originalSrc={cropImageSrc}
        initialPixels={cropSource?.initialPixels || null}
        frames={photoFrames}
        safeFrames={HUB_SAFE_FRAMES}
        onClose={cerrarCropModal}
        onConfirm={handleCropConfirm}
        busy={cropUploadBusy}
        sourceNotice={sourceNotice}
      />
    </div>
  );
}

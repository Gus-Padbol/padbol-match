import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import {
  nombreCompletoJugadorPerfil,
  formatAliasConArroba,
} from './utils/jugadorPerfil';
import { buildJugadorPreviewModalData } from './utils/jugadorPreviewModalData';
import JugadorPreviewModal from './components/JugadorPreviewModal';
import JugadorQrModal from './components/JugadorQrModal';
import PerfilPublicoVista from './components/PerfilPublicoVista';
import { hubInstagramColumnWrapStyle } from './constants/hubLayout';
import { normalizeTorneoDeporte } from './utils/torneoDeporteFormato';
import { IconGeroUbicacion } from './components/icons/GeroIcons';
import HubSponsorsTicker from './components/HubSponsorsTicker';
import { useHubSponsors } from './hooks/useHubSponsors';
import { useSafeTranslation as useTranslation } from './i18n/tSafe';

const API_BASE_PERFIL =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

function instagramHandleFromStored(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.hostname.toLowerCase().includes('instagram.com')) {
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[0] ? String(parts[0]).replace(/\/$/, '') : '';
      }
    } catch {
      return '';
    }
  }
  return s.replace(/^@/, '').trim();
}

const wrap = {
  ...hubInstagramColumnWrapStyle,
  padding: '20px 16px',
  paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
};

function estrellasJugadorLabel(n) {
  const v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}

function formatResenaJugadorFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function JugadorResenaCard({ row }) {
  const nombre = row?.autor?.nombre || 'Jugador';
  const foto = String(row?.autor?.foto_url || '').trim();
  const ini = nombre ? nombre.charAt(0).toUpperCase() : '?';
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          background: '#e2e8f0',
          border: '1px solid var(--border)',
        }}
      >
        {foto ? (
          <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--text-secondary)' }}>
            {ini}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{nombre}</span>
          <span style={{ color: '#fbbf24', fontSize: '13px', letterSpacing: '0.04em' }} aria-hidden>
            {estrellasJugadorLabel(row.estrellas)}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatResenaJugadorFecha(row.created_at)}</span>
        </div>
        {String(row.comentario || '').trim() ? (
          <p style={{ margin: '6px 0 0', fontSize: '13px', lineHeight: 1.45, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
            {row.comentario}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function PerfilPublico() {
  const { t } = useTranslation();
  const { alias: aliasParam, userId: userIdParam } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [perfilPublicoApi, setPerfilPublicoApi] = useState(null);
  /** `null` = sin ids; `{ kind, row }` con fila del otro jugador (o `row: null` si no se encontró). */
  const [companeroDisplay, setCompaneroDisplay] = useState(null);
  const [jugadorPreviewCompaneroPublico, setJugadorPreviewCompaneroPublico] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [resenasJugador, setResenasJugador] = useState(null);
  const [resenasJugadorLoading, setResenasJugadorLoading] = useState(false);
  const [verTodasResenasJugador, setVerTodasResenasJugador] = useState(false);
  const [resenasJugadorTodas, setResenasJugadorTodas] = useState([]);

  const hubSedePerfil = useMemo(() => {
    if (!perfil?.sede_id) return null;
    const n = Number(perfil.sede_id);
    return Number.isFinite(n) ? n : null;
  }, [perfil?.sede_id]);

  const deporteTickerPerfil = useMemo(() => {
    const deps = perfilPublicoApi?.deportes;
    if (!Array.isArray(deps) || !deps.length) return null;
    return normalizeTorneoDeporte(deps[0]);
  }, [perfilPublicoApi?.deportes]);

  const { tickerSponsors } = useHubSponsors({
    sedeId: hubSedePerfil,
    pais: String(perfil?.pais || '').trim(),
    deporte: deporteTickerPerfil,
    enabled: Boolean(perfil),
  });

  const aliasDecoded = useMemo(() => {
    const raw = String(userIdParam || aliasParam || '').trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [aliasParam, userIdParam]);

  const load = useCallback(async () => {
    const a = aliasDecoded;
    if (!a) {
      setPerfil(null);
      setPerfilPublicoApi(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setPerfil(null);
    setPerfilPublicoApi(null);
    setCompaneroDisplay(null);
    setResenasJugador(null);
    setVerTodasResenasJugador(false);
    setResenasJugadorTodas([]);

    try {
      const res = await fetch(`${API_BASE_PERFIL}/api/jugador/perfil-publico/${encodeURIComponent(a)}`);
      if (!res.ok) {
        setPerfil(null);
        setPerfilPublicoApi(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const match = data?.perfil || null;
      if (!match) {
        setPerfil(null);
        setPerfilPublicoApi(null);
        setLoading(false);
        return;
      }

      setPerfilPublicoApi(data);
      setPerfil(match);

      const cid = match.companero_id != null ? String(match.companero_id).trim() : '';
      const uid = match.ultimo_companero_id != null ? String(match.ultimo_companero_id).trim() : '';
      if (cid) {
        const { data: comp } = await supabase
          .from('jugadores_perfil')
          .select('user_id, alias, foto_url, nombre, apellido, nivel, ciudad')
          .eq('user_id', cid)
          .maybeSingle();
        setCompaneroDisplay({ kind: 'habitual', row: comp || null });
      } else if (uid) {
        const { data: comp } = await supabase
          .from('jugadores_perfil')
          .select('user_id, alias, foto_url, nombre, apellido, nivel, ciudad')
          .eq('user_id', uid)
          .maybeSingle();
        setCompaneroDisplay({ kind: 'ultimo', row: comp || null });
      } else {
        setCompaneroDisplay(null);
      }
    } catch (e) {
      console.error('[PerfilPublico]', e);
      setPerfil(null);
      setPerfilPublicoApi(null);
    }

    setLoading(false);
  }, [aliasDecoded]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!aliasDecoded) {
      setResenasJugador(null);
      return undefined;
    }
    let cancelled = false;
    setResenasJugadorLoading(true);
    fetch(`${API_BASE_PERFIL}/api/jugador/${encodeURIComponent(aliasDecoded)}/resenas?limit=3`)
      .then((r) => (r.ok ? r.json() : { promedio: null, total: 0, resenas: [] }))
      .then((body) => {
        if (!cancelled) setResenasJugador(body);
      })
      .catch(() => {
        if (!cancelled) setResenasJugador({ promedio: null, total: 0, resenas: [] });
      })
      .finally(() => {
        if (!cancelled) setResenasJugadorLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aliasDecoded]);

  const cargarTodasResenasJugador = useCallback(async () => {
    if (!aliasDecoded) return;
    setVerTodasResenasJugador(true);
    try {
      const r = await fetch(`${API_BASE_PERFIL}/api/jugador/${encodeURIComponent(aliasDecoded)}/resenas?limit=100`);
      const body = r.ok ? await r.json() : { resenas: [] };
      setResenasJugadorTodas(Array.isArray(body.resenas) ? body.resenas : []);
    } catch {
      setResenasJugadorTodas([]);
    }
  }, [aliasDecoded]);

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
    fontFamily: 'Arial',
    paddingTop: '16px',
    paddingBottom: '32px',
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    paddingLeft: 'calc(16px + env(safe-area-inset-left, 0px))',
    paddingRight: 'calc(16px + env(safe-area-inset-right, 0px))',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const nivelPerfilTexto =
    perfil?.nivel != null && String(perfil.nivel) !== '' ? String(perfil.nivel) : '';
  const nombreCompleto =
    String(perfilPublicoApi?.display_name || '').trim() ||
    nombreCompletoJugadorPerfil(perfil) ||
    String(perfil?.nombre || '').trim();
  const aliasGrande = String(perfil?.alias || perfilPublicoApi?.username || '').trim();
  const instagramRaw =
    perfil?.instagram_url != null && String(perfil.instagram_url) !== ''
      ? String(perfil.instagram_url)
      : '';
  const instagramHref =
    instagramRaw && /^https?:\/\//i.test(instagramRaw)
      ? instagramRaw
      : (() => {
          const h = instagramHandleFromStored(instagramRaw);
          return h ? `https://www.instagram.com/${encodeURIComponent(h)}/` : '';
        })();
  const fotoUrlPerfil = String(perfilPublicoApi?.avatar_url || perfil?.foto_url || '').trim();
  const clubCiudadTrim = perfil?.ciudad != null ? String(perfil.ciudad).trim() : '';
  const localidadTrim = perfil?.localidad != null ? String(perfil.localidad).trim() : '';
  const esFederadoBool = perfil?.es_federado;

  const perfilShareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !aliasDecoded) return '';
    return `${window.location.origin}/jugador/${encodeURIComponent(aliasDecoded)}`;
  }, [aliasDecoded]);

  const perfilShareMeta = useMemo(() => {
    const aliasTxt = aliasGrande ? formatAliasConArroba(aliasGrande) : '';
    const nm = String(nombreCompleto || '').trim();
    const title = nm || aliasTxt || 'Perfil Padbol Match';
    const head = nm && aliasTxt ? `${nm} — ${aliasTxt}` : nm || aliasTxt || title;
    const url = perfilShareUrl;
    const text = url ? `${head}\n\n${url}` : head;
    return { title, text, url };
  }, [nombreCompleto, aliasGrande, perfilShareUrl]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={wrap}>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>{t('perfilPublico.loading')}</p>
        </div>
      </div>
    );
  }

  if (!perfil || !perfilPublicoApi) {
    return (
      <div style={pageStyle}>
        <div style={wrap}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              marginBottom: '16px',
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            {t('perfilPublico.back')}
          </button>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '28px 22px',
              textAlign: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
            }}
          >
            {t('perfilPublico.notFound')}
          </div>
        </div>
      </div>
    );
  }

  const resenasTotalLabel =
    (resenasJugador?.total ?? 0) > 0
      ? t('resenas.totalCount', { count: resenasJugador.total })
      : t('resenas.noReviewsYet');

  return (
    <div style={pageStyle}>
      <div style={wrap}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            marginBottom: '14px',
            padding: '8px 0',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontWeight: 700,
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          {t('perfilPublico.back')}
        </button>

        <PerfilPublicoVista
          data={perfilPublicoApi}
          shareMeta={perfilShareMeta}
          shareUrl={perfilShareUrl}
          onOpenQr={() => setQrOpen(true)}
          perfilRow={perfil}
        />

        {(localidadTrim || clubCiudadTrim || companeroDisplay || esFederadoBool != null || instagramRaw) ? (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '18px 18px 8px',
              marginBottom: '14px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}
          >
            <h2
              style={{
                margin: '0 0 10px',
                paddingBottom: '10px',
                borderBottom: '1px solid var(--border)',
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--text-primary)',
              }}
            >
              {t('perfilPublico.additionalInfo')}
            </h2>
            {localidadTrim ? (
              <p
                style={{
                  margin: '0 0 8px',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <IconGeroUbicacion size={14} />
                {localidadTrim}
              </p>
            ) : null}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('perfilPublico.usualClub')}</span>
              <span style={{ fontSize: '14px', color: 'var(--text-primary)', textAlign: 'right' }}>
                {clubCiudadTrim || <span style={{ color: 'var(--text-secondary)' }}>{t('perfilPublico.undefined')}</span>}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>
                {companeroDisplay?.kind === 'ultimo' ? t('perfilPublico.lastPartner') : t('perfilPublico.usualPartner')}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--text-primary)', textAlign: 'right', flex: 1, minWidth: 0 }}>
                {companeroDisplay?.row ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                    {companeroDisplay.row.foto_url ? (
                      <img src={companeroDisplay.row.foto_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : null}
                    {String(companeroDisplay.row.alias || '').trim() ? (
                      <button
                        type="button"
                        onClick={() => setJugadorPreviewCompaneroPublico(buildJugadorPreviewModalData(companeroDisplay.row, null))}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        {formatAliasConArroba(String(companeroDisplay.row.alias).trim())}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setJugadorPreviewCompaneroPublico(buildJugadorPreviewModalData(companeroDisplay.row, null))}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        {nombreCompletoJugadorPerfil(companeroDisplay.row) || companeroDisplay.row.nombre || t('perfilPublico.undefined')}
                      </button>
                    )}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>{t('perfilPublico.undefined')}</span>
                )}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('perfilPublico.federated')}</span>
              <span style={{ fontSize: '14px', color: 'var(--text-primary)', textAlign: 'right' }}>
                {esFederadoBool === true ? (
                  <>
                    {t('perfilPublico.yes')}
                    {String(perfil.numero_fipa || '').trim() ? (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px', marginLeft: '6px' }}>
                        · N° {String(perfil.numero_fipa).trim()}
                      </span>
                    ) : null}
                  </>
                ) : esFederadoBool === false ? (
                  t('perfilPublico.no')
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>{t('perfilPublico.undefined')}</span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '6px 0 8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('perfilPublico.instagram')}</span>
              <span style={{ fontSize: '14px', textAlign: 'right' }}>
                {instagramHref ? (
                  <a href={instagramHref} target="_blank" rel="noopener noreferrer" style={{ color: '#c026d3', fontWeight: 700, textDecoration: 'none' }}>
                    {t('perfilPublico.instagram')}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>{t('perfilPublico.undefined')}</span>
                )}
              </span>
            </div>
          </div>
        ) : null}

        {(resenasJugadorLoading || (resenasJugador?.total ?? 0) > 0 || (resenasJugador?.resenas?.length ?? 0) > 0) ? (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              marginBottom: '14px',
            }}
          >
            <h2 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {t('resenas.title')}
            </h2>
            {resenasJugadorLoading ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>{t('resenas.loading')}</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {resenasJugador?.promedio != null ? (
                    <>
                      <span style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24' }}>
                        {Number(resenasJugador.promedio).toFixed(1)}
                      </span>
                      <span style={{ color: '#fbbf24', fontSize: '14px' }} aria-hidden>
                        {estrellasJugadorLabel(Math.round(Number(resenasJugador.promedio)))}
                      </span>
                    </>
                  ) : null}
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{resenasTotalLabel}</span>
                </div>
                {(resenasJugador?.resenas || []).map((row, idx, arr) => (
                  <div key={row.id || idx} style={{ borderBottom: idx === arr.length - 1 ? 'none' : undefined }}>
                    <JugadorResenaCard row={row} />
                  </div>
                ))}
                {(resenasJugador?.total ?? 0) > 3 ? (
                  <button
                    type="button"
                    onClick={() => void cargarTodasResenasJugador()}
                    style={{
                      marginTop: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--accent)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {t('perfilPublico.seeAllReviews')}
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}


        {tickerSponsors?.length > 0 ? (
          <div style={{ marginTop: '24px', marginBottom: '4px', width: '100%', maxWidth: '100%' }}>
            <HubSponsorsTicker sponsors={tickerSponsors} deporte={deporteTickerPerfil} />
          </div>
        ) : null}
      </div>

      {verTodasResenasJugador ? (
        <div
          role="presentation"
          onClick={() => setVerTodasResenasJugador(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '12px',
            boxSizing: 'border-box',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              maxHeight: '80vh',
              overflowY: 'auto',
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '18px',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{t('perfilPublico.allReviewsTitle')}</h3>
              <button type="button" onClick={() => setVerTodasResenasJugador(false)} style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer' }} aria-label={t('perfilPublico.close')}>×</button>
            </div>
            {(resenasJugadorTodas.length ? resenasJugadorTodas : resenasJugador?.resenas || []).map((row, idx) => (
              <JugadorResenaCard key={row.id || idx} row={row} />
            ))}
          </div>
        </div>
      ) : null}

      <JugadorPreviewModal
        open={Boolean(jugadorPreviewCompaneroPublico)}
        onClose={() => setJugadorPreviewCompaneroPublico(null)}
        data={jugadorPreviewCompaneroPublico}
      />
      <JugadorQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        alias={aliasGrande || aliasDecoded}
        nombre={nombreCompleto || t('perfilPublico.playerFallback')}
        apodo={
          (() => {
            const raw = String(perfil?.apodo ?? '').trim();
            if (raw) return raw.startsWith('@') ? raw : `@${raw.replace(/^@+/, '')}`;
            return aliasGrande ? formatAliasConArroba(aliasGrande) : '';
          })()
        }
        categoria={nivelPerfilTexto}
        sede={clubCiudadTrim || localidadTrim}
        fotoUrl={fotoUrlPerfil}
      />
    </div>
  );
}

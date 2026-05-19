import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import HubTercerTiempoSponsor from '../components/HubTercerTiempoSponsor';
import HubDeporteSelect from '../components/HubDeporteSelect';
import HubJugarSponsorsTicker from '../components/HubJugarSponsorsTicker';
import HubSponsorsTicker from '../components/HubSponsorsTicker';
import HubJugarFinalSponsorCard from '../components/HubJugarFinalSponsorCard';
import {
  HUB_BOTTOM_NAV_CONTENT_GAP_PX,
  HUB_NAV_HEIGHT_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { HUB_JUGAR_SLOT } from '../constants/hubJugarSponsorSlots';
import { DEPORTES_CANCHA_SEDE_KEYS } from '../constants/deportesCanchaSede';
import { readHubDeporteFilterPersisted, writeHubDeporteFilterToSession } from '../constants/hubDeporteSession';
import { hubCardPhotoFallback, hubCardPhotoPorDeporte, HUB_CARD_UNSPLASH_GENERIC } from '../constants/hubFotosPorDeporte';
import { useAuth } from '../context/AuthContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { useHubSponsors } from '../hooks/useHubSponsors';
import { useHubJugarSponsorSlots } from '../hooks/useHubJugarSponsorSlots';
import useUserRole from '../hooks/useUserRole';
import { fetchProfesores } from '../utils/clasesApi';
import { useHubPromoSedeActiva } from '../hooks/useHubPromoSedeActiva';
import './Jugar.css';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const CARD_OVERLAY = 'rgba(180, 20, 20, 0.35)';

function deporteQuery(deporteElegido) {
  const dep = String(deporteElegido || '').trim().toLowerCase();
  return dep && DEPORTES_CANCHA_SEDE_KEYS.includes(dep) ? `?deporte=${encodeURIComponent(dep)}` : '';
}

export default function Jugar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [searchParams] = useSearchParams();
  const { session, userProfile } = useAuth();

  const [deporteElegido, setDeporteElegido] = useState(() => readHubDeporteFilterPersisted());
  const [hayProfesores, setHayProfesores] = useState(false);

  const { getSlot, tickerItems } = useHubJugarSponsorSlots();

  useEffect(() => {
    const d = String(searchParams.get('deporte') || '').trim().toLowerCase();
    if (!DEPORTES_CANCHA_SEDE_KEYS.includes(d)) return;
    setDeporteElegido(d);
    writeHubDeporteFilterToSession(d);
  }, [searchParams]);

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { sedeId: hubSedeId, pais: hubPaisUsuario } = useUserRole(currentCliente);
  const paisParaSponsors = String(hubPaisUsuario || userProfile?.pais || '').trim();
  const deporteTickerJugar = useMemo(() => {
    const d = String(deporteElegido || '').trim().toLowerCase();
    return d && DEPORTES_CANCHA_SEDE_KEYS.includes(d) ? d : null;
  }, [deporteElegido]);
  const { tercerTiempoSponsor, cardSponsor, tickerSponsors: hubTickerSponsors } = useHubSponsors({
    sedeId: hubSedeId != null && Number.isFinite(Number(hubSedeId)) ? Number(hubSedeId) : null,
    pais: paisParaSponsors,
    deporte: deporteTickerJugar,
    enabled: true,
  });

  const hubSedeNum = hubSedeId != null && Number.isFinite(Number(hubSedeId)) ? Number(hubSedeId) : null;

  useEffect(() => {
    if (hubSedeNum == null) {
      setHayProfesores(false);
      return undefined;
    }
    const ac = new AbortController();
    fetchProfesores({ sedeId: hubSedeNum, signal: ac.signal })
      .then((list) => setHayProfesores(Array.isArray(list) && list.length > 0))
      .catch(() => setHayProfesores(false));
    return () => ac.abort();
  }, [hubSedeNum]);

  const jugarOpcionesLista = useMemo(() => {
    const base = [
      {
        title: t('jugar.reservar'),
        body: t('jugar.reservarBody'),
        path: '/reservar',
        hubKey: 'reservar',
      },
      {
        title: t('jugar.buscar'),
        body: t('jugar.buscarBody'),
        path: '/partidos-abiertos',
        hubKey: 'buscar_partido',
      },
    ];
    const items = [...base];
    if (hayProfesores) {
      items.push({
        title: t('jugar.clase'),
        body: t('jugar.claseBody'),
        path: '/clases',
        hubKey: 'tomar_clase',
      });
    }
    items.push({
      title: t('jugar.armar'),
      body: t('jugar.armarBody'),
      path: '/jugar/armar',
      hubKey: 'armar_partido',
    });
    return items;
  }, [hayProfesores, t]);

  const opciones = useMemo(
    () =>
      jugarOpcionesLista.map((op) => {
        const cardKey = String(op.hubKey || '').trim();
        const porDeporte = deporteElegido ? hubCardPhotoPorDeporte(deporteElegido, cardKey) : '';
        const desdeDeporte = porDeporte && String(porDeporte).trim() ? String(porDeporte).trim() : '';
        const desdeFallback = hubCardPhotoFallback(cardKey);
        const fb = desdeFallback && String(desdeFallback).trim() ? String(desdeFallback).trim() : '';
        const generic = HUB_CARD_UNSPLASH_GENERIC[cardKey] || HUB_CARD_UNSPLASH_GENERIC.reservar || '';
        const image = desdeDeporte || fb || generic;
        return { ...op, image };
      }),
    [deporteElegido, jugarOpcionesLista],
  );

  const { row: hubPromoRow } = useHubPromoSedeActiva(hubSedeNum);

  const openPromoDestino = useCallback(() => {
    const raw = String(hubPromoRow?.url_destino || '').trim();
    if (!raw) return;
    if (/^https?:\/\//i.test(raw)) {
      window.open(raw, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(raw.startsWith('/') ? raw : `/${raw}`);
  }, [hubPromoRow?.url_destino, navigate]);

  const q = deporteQuery(deporteElegido);

  const dockBottom = navDock === 'bottom';
  const mainBottomPad = dockBottom
    ? `calc(20px + ${HUB_NAV_HEIGHT_PX}px + ${HUB_BOTTOM_NAV_CONTENT_GAP_PX}px + env(safe-area-inset-bottom, 0px))`
    : `calc(20px + env(safe-area-inset-bottom, 0px))`;

  return (
    <div
      style={{
        minHeight: '100dvh',
        height: '100dvh',
        maxHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-page)',
        paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title={t('jugar.titulo')} />
      <main
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          maxWidth: 460,
          margin: '0 auto',
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 4,
          paddingBottom: mainBottomPad,
          boxSizing: 'border-box',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <HubDeporteSelect
          compact
          id="jugar-deporte-select"
          value={deporteElegido}
          onChange={(v) => {
            setDeporteElegido(v);
            writeHubDeporteFilterToSession(v);
          }}
        />

        <div style={{ width: '100%', marginTop: 12, marginBottom: 10 }}>
          {hubTickerSponsors?.length > 0 ? (
            <HubSponsorsTicker sponsors={hubTickerSponsors} deporte={deporteTickerJugar} />
          ) : (
            <HubJugarSponsorsTicker items={tickerItems} deporte={deporteTickerJugar} />
          )}
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {opciones.map((op) => (
            <button
              key={op.hubKey}
              type="button"
              onClick={() => navigate(`${op.path}${q}`)}
              style={{
                textAlign: 'left',
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'var(--bg-card)',
                padding: 0,
                overflow: 'hidden',
                boxShadow: 'var(--pm-shadow-card, 0 2px 8px rgba(0,0,0,0.08))',
                cursor: 'pointer',
                display: 'block',
                position: 'relative',
              }}
            >
              <div
                className="jugar-card-media"
                style={{
                  backgroundImage: `url(${op.image})`,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: CARD_OVERLAY,
                  }}
                />
                <div className="jugar-card-copy">
                  <strong className="jugar-card-title">{op.title}</strong>
                  <span className="jugar-card-body">{op.body}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ width: '100%', marginTop: 10 }}>
          <HubJugarFinalSponsorCard
            slot={getSlot(HUB_JUGAR_SLOT.CARD_AD)}
            sponsor={cardSponsor}
            sedeId={hubSedeNum}
            pais={paisParaSponsors}
          />
        </div>

        {hubPromoRow &&
        String(hubPromoRow.titulo || '').trim() &&
        String(hubPromoRow.url_destino || '').trim() ? (
          <button
            type="button"
            onClick={openPromoDestino}
            style={{
              marginTop: 12,
              textAlign: 'left',
              border: '1px solid var(--border)',
              borderRadius: 12,
              background: 'var(--bg-card)',
              padding: 0,
              overflow: 'hidden',
              boxShadow: 'var(--pm-shadow-card, 0 2px 8px rgba(0,0,0,0.08))',
              cursor: 'pointer',
              display: 'block',
              width: '100%',
            }}
          >
            <div
              className="jugar-card-media"
              style={
                String(hubPromoRow.imagen_url || '').trim()
                  ? { backgroundImage: `url(${String(hubPromoRow.imagen_url).trim()})` }
                  : { background: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)' }
              }
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: CARD_OVERLAY,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  zIndex: 2,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#fff',
                  background: 'rgba(15,23,42,0.55)',
                  borderRadius: 999,
                  padding: '4px 10px',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                Del club
              </span>
              <div className="jugar-card-copy">
                <strong className="jugar-card-title">{String(hubPromoRow.titulo).trim()}</strong>
                {String(hubPromoRow.subtitulo || '').trim() ? (
                  <span className="jugar-card-body">{String(hubPromoRow.subtitulo).trim()}</span>
                ) : null}
                <span className="jugar-card-body" style={{ marginTop: 6, display: 'block', fontWeight: 800 }}>
                  {String(hubPromoRow.texto_boton || 'Ver más').trim()}
                </span>
              </div>
            </div>
          </button>
        ) : null}

        <HubTercerTiempoSponsor sponsor={tercerTiempoSponsor} />
      </main>

      <BottomNav />
    </div>
  );
}

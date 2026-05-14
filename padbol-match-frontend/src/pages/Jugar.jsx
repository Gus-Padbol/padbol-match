import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import HubTercerTiempoSponsor from '../components/HubTercerTiempoSponsor';
import HubDeporteSelect from '../components/HubDeporteSelect';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_NAV_HEIGHT_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { DEPORTES_CANCHA_SEDE_KEYS } from '../constants/deportesCanchaSede';
import { readHubDeporteFilterFromSession, writeHubDeporteFilterToSession } from '../constants/hubDeporteSession';
import { hubCardPhotoFallback, hubCardPhotoPorDeporte } from '../constants/hubFotosPorDeporte';
import { useAuth } from '../context/AuthContext';
import { useHubSponsors } from '../hooks/useHubSponsors';
import useUserRole from '../hooks/useUserRole';
import './Jugar.css';

const JUGAR_OPCIONES_BASE = [
  {
    title: 'Reservar cancha',
    body: 'Ya tengo equipo completo, quiero una cancha.',
    path: '/reservar',
    hubKey: 'reservar',
  },
  {
    title: 'Buscar partido',
    body: 'Quiero unirme a un partido que ya existe.',
    path: '/partidos-abiertos',
    hubKey: 'buscar_partido',
  },
  {
    title: 'Armar partido',
    body: 'Quiero crear un partido y sumar jugadores.',
    path: '/jugar/armar',
    hubKey: 'armar_partido',
  },
];

const CARD_OVERLAY = 'rgba(180, 20, 20, 0.35)';

function deporteQuery(deporteElegido) {
  const dep = String(deporteElegido || '').trim().toLowerCase();
  return dep && DEPORTES_CANCHA_SEDE_KEYS.includes(dep) ? `?deporte=${encodeURIComponent(dep)}` : '';
}

export default function Jugar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session, userProfile } = useAuth();

  const [deporteElegido, setDeporteElegido] = useState(() => readHubDeporteFilterFromSession());

  useEffect(() => {
    const d = String(searchParams.get('deporte') || '').trim().toLowerCase();
    if (!DEPORTES_CANCHA_SEDE_KEYS.includes(d)) return;
    setDeporteElegido(d);
    writeHubDeporteFilterToSession(d);
  }, [searchParams]);

  const opciones = useMemo(
    () =>
      JUGAR_OPCIONES_BASE.map((op) => {
        const porDeporte = deporteElegido ? hubCardPhotoPorDeporte(deporteElegido, op.hubKey) : '';
        const image = porDeporte || hubCardPhotoFallback(op.hubKey);
        return { ...op, image };
      }),
    [deporteElegido]
  );

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { sedeId: hubSedeId, pais: hubPaisUsuario } = useUserRole(currentCliente);
  const paisParaSponsors = String(hubPaisUsuario || userProfile?.pais || '').trim();
  const { tercerTiempoSponsor } = useHubSponsors({
    sedeId: hubSedeId != null && Number.isFinite(Number(hubSedeId)) ? Number(hubSedeId) : null,
    pais: paisParaSponsors,
    enabled: true,
  });

  const q = deporteQuery(deporteElegido);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Jugar" />
      <main
        style={{
          width: '100%',
          maxWidth: 460,
          margin: '0 auto',
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 0,
          paddingBottom: `calc(20px + ${HUB_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`,
          boxSizing: 'border-box',
        }}
      >
        <HubDeporteSelect
          id="jugar-deporte-select"
          value={deporteElegido}
          onChange={(v) => {
            setDeporteElegido(v);
            writeHubDeporteFilterToSession(v);
          }}
        />
        <h1
          style={{
            color: 'var(--text-primary)',
            margin: '0 0 10px',
            fontSize: 24,
            lineHeight: 1.15,
            fontWeight: 700,
          }}
        >
          ¡Vamos a jugar!
        </h1>
        <div style={{ display: 'grid', gap: 10 }}>
          {opciones.map((op) => (
            <button
              key={op.title}
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
        <HubTercerTiempoSponsor sponsor={tercerTiempoSponsor} />
      </main>
      <BottomNav />
    </div>
  );
}

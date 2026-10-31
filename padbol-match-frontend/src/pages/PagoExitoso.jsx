import { useAuth } from '../context/AuthContext';
import { readPaymentConfirmation } from '../utils/paymentReturn';
import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  hubContentPaddingTopCss,
  hubMainPaddingBottomCss,
} from '../constants/hubLayout';
import { clearMpReservaPendingSlot,readMpReservaPendingSlot } from '../utils/reservaReturnUrl';
import { supabase } from '../supabaseClient';
import { IconGeroUbicacion } from '../components/icons/GeroIcons';
import SuccessPaymentHeroCheck from '../components/SuccessPaymentHeroCheck';
import { useSponsor } from '../hooks/useSponsor';
import { useSedeTickerSponsors } from '../hooks/useSedeTickerSponsors';
import { useHubJugarSponsorSlots } from '../hooks/useHubJugarSponsorSlots';
import { HUB_JUGAR_SLOT } from '../constants/hubJugarSponsorSlots';
import { HubJugarSlotRect } from '../components/HubJugarSponsorSurfaces';
import SponsorBannerReserva from '../components/SponsorBannerReserva';
import HubSponsorsTicker from '../components/HubSponsorsTicker';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { normalizeTorneoDeporte } from '../utils/torneoDeporteFormato';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { QRCodeCanvas } from 'qrcode.react';
import './PagoExitoso.css';
import { usePadcoinsActiveCampaign } from '../hooks/usePadcoinsActiveCampaign';
import { PadcoinsCampaignPlayerHint } from '../components/PadcoinsCampaignPlayerSurfaces';

const API_BASE = (
  getApiBaseUrl()
);

function PagoExitosoHeroCheck() {
  return (
    <div className="pago-exitoso__success-glow">
      <SuccessPaymentHeroCheck />
    </div>
  );
}

export default function PagoExitoso() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const ownerId=session?.user?.id||null;
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [params] = useSearchParams();

  const paymentId = params.get('payment_id') || params.get('collection_id');

  const [saving, setSaving] = useState(true);
  const [ownedReserva,setOwnedReserva]=useState(null);
  const [verifiedContext,setVerifiedContext]=useState(null);
  const [confirmError, setConfirmError] = useState(false);
  /** null | 'reserva' | 'torneo' | 'partido' */
  const [pagoKind, setPagoKind] = useState(null);
  const [torneoInscripcion, setTorneoInscripcion] = useState(null);
  const [qrToken, setQrToken] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  const [pending,setPending]=useState(false);
  const [verificationRevision,setVerificationRevision]=useState(0);
  const paymentContext=JSON.stringify([paymentId,ownerId,verificationRevision]);
  const reserva=ownedReserva?.context===paymentContext?ownedReserva.row:null;
  const [detailNotice,setDetailNotice]=useState('');
  const qrCanvasWrapRef = useRef(null);

  const reservaSedeId = useMemo(() => {
    if (!reserva) return null;
    const raw = reserva.sede_id ?? reserva.sedeId;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [reserva]);

  const { campaign: pagoPadcoinsCampaign } = usePadcoinsActiveCampaign(reservaSedeId, {
    apiBaseUrl: API_BASE,
    enabled: !saving && !confirmError && pagoKind === 'reserva' && Boolean(reservaSedeId),
  });

  const deporteReservaPago = useMemo(() => {
    const raw = reserva?.deporte ?? reserva?.deporte_cancha;
    if (raw == null || String(raw).trim() === '') return null;
    return normalizeTorneoDeporte(raw);
  }, [reserva]);

  const sponsorReservaEnabled =
    !saving && !confirmError && pagoKind === 'reserva' && Boolean(reserva);

  const sedeTickerPagoEnabled =
    !saving && !confirmError && pagoKind === 'reserva' && Boolean(reservaSedeId);

  const { sponsors: sedeTickerPago } = useSedeTickerSponsors(reservaSedeId, {
    enabled: sedeTickerPagoEnabled,
    deporte: deporteReservaPago,
  });

  const { sponsor: sponsorReserva } = useSponsor(reservaSedeId, null, {
    enabled: sponsorReservaEnabled,
    deporte: deporteReservaPago,
  });

  const { getSlot: getHubJugarSlot } = useHubJugarSponsorSlots();

  useEffect(() => {
    const controller=new AbortController();let active=true;
    setSaving(true);setPending(false);setConfirmError(false);setOwnedReserva(null);setDetailNotice('');
    (async()=>{
      try {
        if(!paymentId)throw new Error('Falta referencia de pago.');
        const result=await readPaymentConfirmation({url:`${API_BASE}/api/pago-exitoso?payment_id=${encodeURIComponent(paymentId)}`,signal:controller.signal});
        if(!active)return;
        if(!result.confirmed){setPending(true);return;}
        const data=result.data;
        const stored=readMpReservaPendingSlot();
        if(stored?.reserva_id!=null&&String(stored.reserva_id)===String(data.reserva_id))clearMpReservaPendingSlot();
        const tipo=String(data.tipo||'reserva').toLowerCase();
        if(tipo==='torneo'&&data.torneo_id&&data.equipo_id){setPagoKind('torneo');setTorneoInscripcion({torneo_id:data.torneo_id,equipo_id:data.equipo_id});return;}
        setPagoKind(tipo==='partido'?'partido':'reserva');
        setVerifiedContext(paymentContext);setSaving(false);
        // The public status DTO deliberately has no personal booking details.
        // Obtain them only through the existing authenticated owner endpoint.
        try {
          const {data:sessionData}=await supabase.auth.getSession();if(!active)return;
          const token=sessionData?.session?.access_token;
          if(!token||!ownerId||sessionData.session.user?.id!==ownerId){setDetailNotice('Inicia sesión y revisa Mis reservas para ver los detalles y el QR.');return;}
          const response=await fetch(`${API_BASE}/api/reservas/mis-reservas`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
          const rows=await response.json();if(!active)return;
          if(!response.ok||!Array.isArray(rows))throw new Error('Details unavailable');
          const own=rows.find(row=>String(row.id)===String(data.reserva_id));
          if(!own)throw new Error('Booking not visible');
          setOwnedReserva({ownerId,context:paymentContext,row:own});
        }catch{if(active)setDetailNotice('La confirmación está registrada. Revisa Mis reservas para consultar los detalles.');}
      }catch(error){if(active&&error.name!=='AbortError')setConfirmError(true);}
      finally{if(active){setVerifiedContext(paymentContext);setSaving(false);}}
    })();
    return()=>{active=false;controller.abort();};
  },[paymentId,verificationRevision,ownerId,paymentContext]);

  useEffect(() => {
    const rid = reserva?.id;
    if (!rid || pagoKind !== 'reserva' || saving || confirmError) {
      setQrToken(null);
      setQrError('');
      return undefined;
    }
    let cancelled = false;
    setQrLoading(true);
    setQrError('');
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token || '';
        const res = await fetch(`${API_BASE}/api/reservas/${encodeURIComponent(rid)}/generar-qr`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setQrError(j?.error || t('pago.qrGenerationFailed'));
          setQrToken(null);
          return;
        }
        setQrToken(String(j?.qr_token || '').trim() || null);
      } catch (e) {
        if (!cancelled) {
          setQrError(e?.message || t('pago.networkError'));
          setQrToken(null);
        }
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reserva?.id, pagoKind, saving, confirmError, t]);

  const descargarQrPago = () => {
    const canvas = qrCanvasWrapRef.current?.querySelector('canvas');
    if (!canvas || !qrToken) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkin-${qrToken.slice(0, 24)}.png`;
    a.click();
  };

  const pagePadding = {
    padding: `${hubContentPaddingTopCss(location.pathname, navDock)} 24px ${hubMainPaddingBottomCss(location.pathname, navDock)}`,
  };

  return (
    <div className="pago-exitoso" style={pagePadding}>
      <AppHeader title={t('pago.titulo')} />
      <div className="pago-exitoso__panel">
        {(saving||verifiedContext!==paymentContext) ? (
          <>
            <div className="pago-exitoso__emoji" aria-hidden>
              ⏳
            </div>
            <h1 className="pago-exitoso__title pago-exitoso__title--loading">Confirmando pago...</h1>
            <p className="pago-exitoso__muted">Registrando tu operación, un momento.</p>
          </>
        ) : pending ? (
          <><h1>Pago pendiente de confirmación</h1><p>No hay una confirmación de la reserva todavía. Puedes volver a consultar sin repetir el pago.</p><button type="button" onClick={()=>setVerificationRevision(value=>value+1)}>Volver a consultar</button></>
        ) : confirmError ? (
          <>
            <div className="pago-exitoso__emoji" aria-hidden>
              ⚠️
            </div>
            <h1 className="pago-exitoso__title pago-exitoso__title--warn">No pudimos comprobar el pago</h1>
            <p className="pago-exitoso__lead" style={{ marginBottom: 20 }}>
              No hay una confirmación comprobada todavía. No repitas el pago; revisa Mis reservas o consulta a la sede con la referencia.
            </p>
            <button type="button" onClick={()=>setVerificationRevision(value=>value+1)}>Volver a consultar</button>
            <button type="button" className="pago-exitoso__btn pago-exitoso__btn--primary" onClick={() => navigate('/')}>
              Continuar
            </button>
          </>
        ) : pagoKind === 'partido' ? (
          <>
            <PagoExitosoHeroCheck />
            <h1 className="pago-exitoso__title">¡Partido publicado!</h1>
            <p className="pago-exitoso__lead">
              Tu reserva fue confirmada: el partido ya está publicado para que otros se sumen.
            </p>
            <div className="pago-exitoso__slot-wrap">
              <HubJugarSlotRect slot={getHubJugarSlot(HUB_JUGAR_SLOT.CONFIRMACION_BANNER)} borderRadius={10} />
            </div>
            <a
              className="pago-exitoso__btn--whatsapp"
              href={`https://wa.me/?text=${encodeURIComponent(`Únete a mi partido en Padbol Match: ${window.location.origin}/partidos-abiertos`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Compartir por WhatsApp
            </a>
            <button
              type="button"
              className="pago-exitoso__btn pago-exitoso__btn--primary"
              onClick={() => navigate('/partidos-abiertos')}
            >
              Ver cupos para unirte
            </button>
          </>
        ) : pagoKind === 'torneo' && torneoInscripcion ? (
          <>
            <PagoExitosoHeroCheck />
            <h1 className="pago-exitoso__title">¡Inscripción confirmada!</h1>
            <p className="pago-exitoso__lead">El pago se registró y tu equipo quedó confirmado en el torneo.</p>
            <div className="pago-exitoso__slot-wrap">
              <HubJugarSlotRect slot={getHubJugarSlot(HUB_JUGAR_SLOT.CONFIRMACION_BANNER)} borderRadius={10} />
            </div>
            {paymentId ? (
              <p className="pago-exitoso__muted" style={{ marginBottom: 20 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Pago #:</strong> {paymentId}
              </p>
            ) : null}
            <div className="pago-exitoso__actions">
              <button
                type="button"
                className="pago-exitoso__btn pago-exitoso__btn--primary"
                onClick={() => navigate(`/torneo/${torneoInscripcion.torneo_id}/equipos`)}
              >
                Volver al torneo
              </button>
            </div>
          </>
        ) : (
          <>
            <PagoExitosoHeroCheck />
            <h1 className="pago-exitoso__title">¡Pago exitoso!</h1>
            <p className="pago-exitoso__lead">
              Tu reserva está confirmada.
            </p>
            {detailNotice&&<p role="status">{detailNotice}</p>}
            <PadcoinsCampaignPlayerHint campaign={pagoPadcoinsCampaign} variant="success" />
            <div className="pago-exitoso__slot-wrap">
              <HubJugarSlotRect slot={getHubJugarSlot(HUB_JUGAR_SLOT.CONFIRMACION_BANNER)} borderRadius={10} />
            </div>

            {reserva ? (
              <div className="pago-exitoso__details">
                {reserva.sede ? (
                  <p className="pago-exitoso__details-row">
                    <span className="pago-exitoso__details-icon">
                      <IconGeroUbicacion size={16} />
                    </span>
                    <span>
                      <strong>Sede:</strong> {reserva.sede}
                    </span>
                  </p>
                ) : null}
                {reserva.fecha ? (
                  <p className="pago-exitoso__details-row">
                    <span className="pago-exitoso__details-icon" aria-hidden>
                      📅
                    </span>
                    <span>
                      <strong>Fecha:</strong> {reserva.fecha}
                    </span>
                  </p>
                ) : null}
                {reserva.hora ? (
                  <p className="pago-exitoso__details-row">
                    <span className="pago-exitoso__details-icon" aria-hidden>
                      🕐
                    </span>
                    <span>
                      <strong>Hora:</strong> {reserva.hora}
                    </span>
                  </p>
                ) : null}
                {reserva.cancha ? (
                  <p className="pago-exitoso__details-row">
                    <span className="pago-exitoso__details-icon" aria-hidden>
                      🏟️
                    </span>
                    <span>
                      <strong>Cancha:</strong> {reserva.cancha}
                    </span>
                  </p>
                ) : null}
                {reserva.nombre ? (
                  <p className="pago-exitoso__details-row">
                    <span className="pago-exitoso__details-icon" aria-hidden>
                      👤
                    </span>
                    <span>
                      <strong>Jugador:</strong> {reserva.nombre}
                    </span>
                  </p>
                ) : null}
                {paymentId ? (
                  <p className="pago-exitoso__details-payment">
                    <strong>Pago #:</strong> {paymentId}
                  </p>
                ) : null}
              </div>
            ) : null}

            {(qrLoading || qrToken || qrError) && reserva?.id ? (
              <div className="pago-exitoso__qr">
                <p className="pago-exitoso__qr-title">{t('checkin.tuQr')}</p>
                {qrLoading ? (
                  <p className="pago-exitoso__muted">{t('general.loading')}</p>
                ) : qrError ? (
                  <p className="pago-exitoso__muted" style={{ color: 'var(--pm-color-warning, #d97706)' }}>
                    {qrError}
                  </p>
                ) : qrToken ? (
                  <>
                    <div
                      ref={qrCanvasWrapRef}
                      style={{
                        display: 'inline-block',
                        padding: 8,
                        background: '#fff',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <QRCodeCanvas value={qrToken} size={200} level="M" includeMargin />
                    </div>
                    <button
                      type="button"
                      className="pago-exitoso__btn pago-exitoso__btn--primary"
                      style={{ marginTop: 12 }}
                      onClick={descargarQrPago}
                    >
                      {t('checkin.descargar')}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            <SponsorBannerReserva sponsor={sponsorReserva} />

            <HubSponsorsTicker sponsors={sedeTickerPago} deporte={deporteReservaPago} />

            <div className="pago-exitoso__actions">
              <button
                type="button"
                className="pago-exitoso__btn pago-exitoso__btn--primary"
                onClick={() => navigate('/reservar')}
              >
                ⚽ Hacer otra reserva
              </button>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  hubContentPaddingTopCss,
  hubMainPaddingBottomCss,
} from '../constants/hubLayout';
import { clearMpReservaPendingSlot } from '../utils/reservaReturnUrl';
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
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
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
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [params] = useSearchParams();

  const paymentId = params.get('payment_id') || params.get('collection_id');

  const [saving, setSaving] = useState(true);
  const [reserva, setReserva] = useState(null);
  const [confirmError, setConfirmError] = useState(false);
  /** null | 'reserva' | 'torneo' | 'partido' */
  const [pagoKind, setPagoKind] = useState(null);
  const [torneoInscripcion, setTorneoInscripcion] = useState(null);
  const [qrToken, setQrToken] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  const savedRef = useRef(false);
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
    if (savedRef.current) return;

    if (!paymentId) {
      savedRef.current = true;
      setConfirmError(true);
      setSaving(false);
      return;
    }

    savedRef.current = true;
    const url = `${API_BASE}/api/pago-exitoso?payment_id=${encodeURIComponent(paymentId)}`;

    fetch(url)
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok || data?.ok === false) {
          setConfirmError(true);
          return;
        }

        clearMpReservaPendingSlot();
        const tipo = String(data.tipo || 'reserva').toLowerCase();

        if (tipo === 'torneo') {
          setPagoKind('torneo');
          setTorneoInscripcion({
            torneo_id: data.torneo_id,
            equipo_id: data.equipo_id,
          });
          return;
        }

        if (tipo === 'partido') {
          setPagoKind('partido');
          if (data.reserva) setReserva(data.reserva);
          return;
        }

        setPagoKind('reserva');
        setReserva(data.reserva || data.reservation || null);
      })
      .catch(() => {
        setConfirmError(true);
      })
      .finally(() => setSaving(false));
  }, [paymentId]);

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
        {saving ? (
          <>
            <div className="pago-exitoso__emoji" aria-hidden>
              ⏳
            </div>
            <h1 className="pago-exitoso__title pago-exitoso__title--loading">Confirmando pago...</h1>
            <p className="pago-exitoso__muted">Registrando tu operación, un momento.</p>
          </>
        ) : confirmError ? (
          <>
            <div className="pago-exitoso__emoji" aria-hidden>
              ⚠️
            </div>
            <h1 className="pago-exitoso__title pago-exitoso__title--warn">Pago exitoso, pero hubo un problema</h1>
            <p className="pago-exitoso__lead" style={{ marginBottom: 20 }}>
              Tu pago fue procesado correctamente
              {paymentId ? ` (#${paymentId})` : ''}, pero no pudimos completar el registro automáticamente.
              Por favor contacta a la sede con el número de pago.
            </p>
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
              href={`https://wa.me/?text=${encodeURIComponent(`Sumate a mi partido en Padbol Match: ${window.location.origin}/partidos-abiertos`)}`}
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
              Tu reserva está confirmada. Recibirás la confirmación por WhatsApp.
            </p>
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

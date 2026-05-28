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

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

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
          setQrError(j?.error || 'No se pudo generar el QR');
          setQrToken(null);
          return;
        }
        setQrToken(String(j?.qr_token || '').trim() || null);
      } catch (e) {
        if (!cancelled) {
          setQrError(e?.message || 'Error de red');
          setQrToken(null);
        }
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reserva?.id, pagoKind, saving, confirmError]);

  const descargarQrPago = () => {
    const canvas = qrCanvasWrapRef.current?.querySelector('canvas');
    if (!canvas || !qrToken) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkin-${qrToken.slice(0, 24)}.png`;
    a.click();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${hubContentPaddingTopCss(location.pathname, navDock)} 24px ${hubMainPaddingBottomCss(location.pathname, navDock)}`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title={t('pago.titulo')} />
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '48px 36px',
          maxWidth: '460px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        }}
      >
        {saving ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46' }}>
              Confirmando pago...
            </h1>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              Registrando tu operación, un momento.
            </p>
          </>
        ) : confirmError ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: '#92400e',
                marginBottom: '8px',
              }}
            >
              Pago exitoso, pero hubo un problema
            </h1>
            <p
              style={{
                color: '#374151',
                fontSize: '14px',
                lineHeight: 1.6,
                marginBottom: '20px',
              }}
            >
              Tu pago fue procesado correctamente
              {paymentId ? ` (#${paymentId})` : ''}, pero no pudimos completar el registro automáticamente.
              Por favor contacta a la sede con el número de pago.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                padding: '11px 24px',
                background: '#065f46',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Continuar
            </button>
          </>
        ) : pagoKind === 'partido' ? (
          <>
            <SuccessPaymentHeroCheck />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#065f46', marginBottom: '8px' }}>
              ¡Partido publicado!
            </h1>
            <p style={{ color: '#374151', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
              Tu reserva fue confirmada: el partido ya está publicado para que otros se sumen.
            </p>
            <div style={{ width: '100%', maxWidth: 390, margin: '0 auto 16px' }}>
              <HubJugarSlotRect slot={getHubJugarSlot(HUB_JUGAR_SLOT.CONFIRMACION_BANNER)} borderRadius={10} />
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Sumate a mi partido en Padbol Match: ${window.location.origin}/partidos-abiertos`)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                padding: '12px 18px',
                background: '#22c55e',
                color: 'white',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 800,
                textDecoration: 'none',
                marginBottom: '10px',
              }}
            >
              Compartir por WhatsApp
            </a>
            <button
              type="button"
              onClick={() => navigate('/partidos-abiertos')}
              style={{
                padding: '11px 24px',
                background: '#065f46',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ver cupos para unirte
            </button>
          </>
        ) : pagoKind === 'torneo' && torneoInscripcion ? (
          <>
            <SuccessPaymentHeroCheck />
            <h1
              style={{
                fontSize: '1.6rem',
                fontWeight: 900,
                color: '#065f46',
                marginBottom: '8px',
              }}
            >
              ¡Inscripción confirmada!
            </h1>
            <p
              style={{
                color: '#374151',
                fontSize: '15px',
                lineHeight: 1.6,
                marginBottom: '24px',
              }}
            >
              El pago se registró y tu equipo quedó confirmado en el torneo.
            </p>
            <div style={{ width: '100%', maxWidth: 390, margin: '0 auto 16px' }}>
              <HubJugarSlotRect slot={getHubJugarSlot(HUB_JUGAR_SLOT.CONFIRMACION_BANNER)} borderRadius={10} />
            </div>
            {paymentId && (
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#6b7280' }}>
                <strong>Pago #:</strong> {paymentId}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() =>
                  navigate(`/torneo/${torneoInscripcion.torneo_id}/equipos`)
                }
                style={{
                  padding: '12px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Volver al torneo
              </button>
            </div>
          </>
        ) : (
          <>
            <SuccessPaymentHeroCheck />
            <h1
              style={{
                fontSize: '1.6rem',
                fontWeight: 900,
                color: '#065f46',
                marginBottom: '8px',
              }}
            >
              ¡Pago exitoso!
            </h1>
            <p
              style={{
                color: '#374151',
                fontSize: '15px',
                lineHeight: 1.6,
                marginBottom: '24px',
              }}
            >
              Tu reserva está confirmada. Recibirás la confirmación por WhatsApp.
            </p>
            <div style={{ width: '100%', maxWidth: 390, margin: '0 auto 16px' }}>
              <HubJugarSlotRect slot={getHubJugarSlot(HUB_JUGAR_SLOT.CONFIRMACION_BANNER)} borderRadius={10} />
            </div>

            {reserva && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  marginBottom: '24px',
                  textAlign: 'left',
                }}
              >
                {reserva.sede && (
                  <p
                    style={{
                      margin: '0 0 6px',
                      fontSize: '13px',
                      color: '#166534',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <span style={{ flexShrink: 0, display: 'inline-flex', marginTop: 1, color: '#166534' }}>
                      <IconGeroUbicacion size={16} />
                    </span>
                    <span>
                      <strong>Sede:</strong> {reserva.sede}
                    </span>
                  </p>
                )}
                {reserva.fecha && (
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#166534' }}>
                    <strong>📅 Fecha:</strong> {reserva.fecha}
                  </p>
                )}
                {reserva.hora && (
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#166534' }}>
                    <strong>🕐 Hora:</strong> {reserva.hora}
                  </p>
                )}
                {reserva.cancha && (
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#166534' }}>
                    <strong>🏟️ Cancha:</strong> {reserva.cancha}
                  </p>
                )}
                {reserva.nombre && (
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#166534' }}>
                    <strong>👤 Jugador:</strong> {reserva.nombre}
                  </p>
                )}
                {paymentId && (
                  <p style={{ margin: '0', fontSize: '12px', color: '#4ade80' }}>
                    <strong>Pago #:</strong> {paymentId}
                  </p>
                )}
              </div>
            )}

            {(qrLoading || qrToken || qrError) && reserva?.id ? (
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: '0 0 12px', fontWeight: 800, color: '#065f46', fontSize: '15px' }}>
                  {t('checkin.tuQr')}
                </p>
                {qrLoading ? (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>{t('general.loading')}</p>
                ) : qrError ? (
                  <p style={{ margin: 0, color: '#b45309', fontSize: '13px' }}>{qrError}</p>
                ) : qrToken ? (
                  <>
                    <div ref={qrCanvasWrapRef} style={{ display: 'inline-block', padding: '8px', background: '#fff' }}>
                      <QRCodeCanvas value={qrToken} size={200} level="M" includeMargin />
                    </div>
                    <button
                      type="button"
                      onClick={descargarQrPago}
                      style={{
                        display: 'block',
                        width: '100%',
                        marginTop: '12px',
                        padding: '10px',
                        background: '#065f46',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      {t('checkin.descargar')}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            <SponsorBannerReserva sponsor={sponsorReserva} />

            <HubSponsorsTicker sponsors={sedeTickerPago} deporte={deporteReservaPago} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => navigate('/reservar')}
                style={{
                  padding: '12px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
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

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
import { useTranslation } from 'react-i18next';

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

  const paymentId = params.get('payment_id');
  const extRef = params.get('external_reference');

  const [saving, setSaving] = useState(true);
  const [reserva, setReserva] = useState(null);
  const [saveError, setSaveError] = useState('');
  /** null | 'reserva' | 'torneo' | 'partido' */
  const [pagoKind, setPagoKind] = useState(null);
  const [torneoInscripcion, setTorneoInscripcion] = useState(null);
  const savedRef = useRef(false);

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
    !saving && !saveError && pagoKind === 'reserva' && Boolean(reserva);

  const sedeTickerPagoEnabled =
    !saving && !saveError && pagoKind === 'reserva' && Boolean(reservaSedeId);

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

    if (!extRef) {
      savedRef.current = true;
      setSaving(false);
      return;
    }

    let rawRef = extRef;
    try {
      rawRef = decodeURIComponent(extRef);
    } catch {
      rawRef = extRef;
    }

    let payload;
    try {
      payload = JSON.parse(rawRef);
    } catch {
      savedRef.current = true;
      setSaveError('No se pudo leer los datos del pago.');
      setSaving(false);
      return;
    }

    if (payload?.tipo === 'torneo_inscripcion') {
      savedRef.current = true;
      fetch(`${API_BASE}/api/torneos/confirmar-inscripcion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipo_id: payload.equipo_id,
          torneo_id: payload.torneo_id,
          email: payload.email,
        }),
      })
        .then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d })))
        .then(({ ok, data }) => {
          if (ok) {
            setPagoKind('torneo');
            setTorneoInscripcion({
              torneo_id: payload.torneo_id,
              equipo_id: payload.equipo_id,
            });
          } else {
            setSaveError(data?.error || 'No se pudo confirmar la inscripción.');
          }
        })
        .catch((err) => setSaveError(err.message || 'Error de red'))
        .finally(() => setSaving(false));
      return;
    }

    if (payload?.tipo === 'partido_abierto') {
      savedRef.current = true;
      supabase.auth
        .getSession()
        .then(({ data }) => {
          const token = data?.session?.access_token || '';
          return fetch(`${API_BASE}/api/partidos-abiertos/confirmar-pago`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          });
        })
        .then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d })))
        .then(({ ok, data }) => {
          if (ok) {
            clearMpReservaPendingSlot();
            if (data?.partido) {
              setPagoKind('partido');
            } else {
              setReserva(data?.reserva || null);
              setPagoKind('reserva');
            }
          } else {
            setSaveError(data?.error || 'No se pudo publicar el partido.');
          }
        })
        .catch((err) => setSaveError('Error al publicar el partido: ' + err.message))
        .finally(() => setSaving(false));
      return;
    }

    savedRef.current = true;
    fetch(`${API_BASE}/api/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d })))
      .then(({ ok, status: httpStatus, data }) => {
        if (ok) {
          clearMpReservaPendingSlot();
          const created = Array.isArray(data) ? data[0] : data;
          setReserva({ ...payload, id: created?.id });
          setPagoKind('reserva');
        } else if (httpStatus === 409) {
          clearMpReservaPendingSlot();
          setReserva(payload);
          setPagoKind('reserva');
        } else {
          setSaveError(data?.error || 'No se pudo guardar la reserva.');
        }
      })
      .catch((err) => setSaveError('Error al guardar la reserva: ' + err.message))
      .finally(() => setSaving(false));
  }, [extRef]);

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
        ) : saveError ? (
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
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                textAlign: 'left',
                fontSize: '13px',
                color: '#92400e',
              }}
            >
              <strong>Error:</strong> {saveError}
            </div>
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
              <HubJugarSlotRect slot={getHubJugarSlot(HUB_JUGAR_SLOT.CONFIRMACION_BANNER)} height={80} borderRadius={10} />
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
              <HubJugarSlotRect slot={getHubJugarSlot(HUB_JUGAR_SLOT.CONFIRMACION_BANNER)} height={80} borderRadius={10} />
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
              <HubJugarSlotRect slot={getHubJugarSlot(HUB_JUGAR_SLOT.CONFIRMACION_BANNER)} height={80} borderRadius={10} />
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

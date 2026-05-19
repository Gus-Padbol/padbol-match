import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation, createSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  hubContentPaddingTopCss,
  hubMainPaddingBottomCss,
} from '../constants/hubLayout';
import AppButton from '../components/AppButton';
import ConfirmCancelReservaModal from '../components/ConfirmCancelReservaModal';
import * as T from '../theme/designTokens';
import { cardStyle } from '../theme/uiStyles';
import { useAuth } from '../context/AuthContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import {
  readMpReservaPendingSlot,
  clearMpReservaPendingSlot,
  clearReservaFlowSessionStorage,
  clearReservaReturnLocalStorage,
} from '../utils/reservaReturnUrl';
import { scheduleHubEntryScrollReset } from '../utils/hubEntryScrollReset';
import { useTranslation } from 'react-i18next';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function reservarUrlFromPending(pending) {
  if (!pending?.sedeId) return '/reservar';
  const p = { sedeId: String(pending.sedeId) };
  if (pending.fecha) p.fecha = String(pending.fecha);
  if (pending.hora) p.hora = String(pending.hora);
  if (pending.cancha != null && String(pending.cancha).trim() !== '') p.canchaId = String(pending.cancha);
  return `/reservar?${createSearchParams(p).toString()}`;
}

export default function PagoFallido() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [cancelReservaModalOpen, setCancelReservaModalOpen] = useState(false);

  const pending = readMpReservaPendingSlot();

  const onIntentarDeNuevo = useCallback(() => {
    const p = readMpReservaPendingSlot();
    const dest = p ? reservarUrlFromPending(p) : '/reservar';
    navigate(dest, { replace: true });
  }, [navigate]);

  const onCancelarReserva = useCallback(async () => {
    setBusy(true);
    const p = readMpReservaPendingSlot();
    try {
      if (p?.sede && p.fecha && p.hora && p.cancha != null) {
        const body = {
          sede: String(p.sede).trim(),
          fecha: String(p.fecha).trim(),
          hora: String(p.hora).trim(),
          cancha: parseInt(String(p.cancha), 10),
        };
        if (p.email) body.email = String(p.email).trim().toLowerCase();
        await fetch(`${API_BASE}/api/reservas/liberar-slot-pendiente`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
    } catch {
      /* best-effort */
    } finally {
      clearMpReservaPendingSlot();
      clearReservaFlowSessionStorage();
      clearReservaReturnLocalStorage();
      const sid = p?.sedeId != null ? Number(p.sedeId) : null;
      if (session?.user) {
        navigate('/hub', { replace: true });
        scheduleHubEntryScrollReset();
      } else if (sid) navigate(`/sede/${sid}`, { replace: true });
      else navigate('/reservar', { replace: true });
      setBusy(false);
    }
  }, [navigate, session?.user]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${T.colorErrorDark} 0%, ${T.colorError} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        padding: `${hubContentPaddingTopCss(location.pathname, navDock)} 0 ${hubMainPaddingBottomCss(location.pathname, navDock)}`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title={t('pago.titulo')} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            ...cardStyle,
            padding: '48px 36px',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '16px' }} aria-hidden>
            ❌
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: T.colorErrorDark, marginBottom: '12px' }}>
            El pago no se completó
          </h1>
          <p style={{ color: T.colorTextMuted, fontSize: '15px', lineHeight: 1.65, marginBottom: '20px' }}>
            El pago no se completó. Puedes intentarlo de nuevo o cancelar la reserva.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <AppButton
              variant="primary"
              onClick={onIntentarDeNuevo}
              disabled={busy}
              style={{
                background: `linear-gradient(135deg, ${T.colorError}, ${T.colorErrorDark})`,
                boxShadow: '0 4px 14px rgba(185, 28, 28, 0.35)',
              }}
            >
              Intentar de nuevo
            </AppButton>
            <AppButton
              variant="secondary"
              onClick={() => setCancelReservaModalOpen(true)}
              disabled={busy}
              style={{
                background: '#f1f5f9',
                color: T.colorText,
                boxShadow: 'none',
                border: `1px solid ${T.colorTextMuted}`,
              }}
            >
              Cancelar reserva
            </AppButton>
          </div>
        </div>
      </div>
      <ConfirmCancelReservaModal
        open={cancelReservaModalOpen}
        title="¿Cancelar la reserva?"
        message="Se liberará el turno pendiente y vas a salir del flujo de pago."
        confirmLabel="Sí, cancelar reserva"
        dismissLabel="Seguir en esta pantalla"
        busy={busy}
        onDismiss={() => setCancelReservaModalOpen(false)}
        onConfirm={() => {
          setCancelReservaModalOpen(false);
          void onCancelarReserva();
        }}
      />
      <BottomNav />
    </div>
  );
}

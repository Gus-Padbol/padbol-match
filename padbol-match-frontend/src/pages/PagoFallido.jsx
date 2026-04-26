import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_CONTENT_PADDING_TOP_PX,
} from '../constants/hubLayout';
import AppButton from '../components/AppButton';
import * as T from '../theme/designTokens';
import { cardStyle } from '../theme/uiStyles';

export default function PagoFallido() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${T.colorErrorDark} 0%, ${T.colorError} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        padding: `${HUB_CONTENT_PADDING_TOP_PX}px 0 ${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Pago" />
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
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: T.colorErrorDark, marginBottom: '8px' }}>
            El pago no se completó
          </h1>
          <p style={{ color: T.colorTextMuted, fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
            No se realizó ningún cobro y tu reserva no fue registrada. Puedes intentarlo de nuevo cuando quieras.
          </p>

          <AppButton
            variant="primary"
            onClick={() => navigate('/reservar')}
            style={{
              background: `linear-gradient(135deg, ${T.colorError}, ${T.colorErrorDark})`,
              boxShadow: '0 4px 14px rgba(185, 28, 28, 0.35)',
            }}
          >
            Intentar de nuevo
          </AppButton>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

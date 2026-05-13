import React from 'react';
import { IconGeroCheck } from './icons/GeroIcons';

/** Círculo verde con tilde Gero (CHECK.svg) — pago / reserva confirmados. */
export default function SuccessPaymentHeroCheck({ iconSize = 40, circleSize = 72 }) {
  return (
    <div
      style={{
        width: circleSize,
        height: circleSize,
        margin: '0 auto 16px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 6px 20px rgba(22, 163, 74, 0.35)',
      }}
    >
      <IconGeroCheck size={iconSize} style={{ color: '#fff' }} />
    </div>
  );
}

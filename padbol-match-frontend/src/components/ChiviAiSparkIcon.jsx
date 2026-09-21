import React from 'react';

export const CHIVI_AI_SPARK_PATH = 'M12 2C12.65 7.35 16.65 11.35 22 12C16.65 12.65 12.65 16.65 12 22C11.35 16.65 7.35 12.65 2 12C7.35 11.35 11.35 7.35 12 2Z';

/**
 * Identificador visual oficial de Chivi IA.
 * Se centraliza para que el launcher nunca vuelva a degradarse a un punto rojo.
 */
export default function ChiviAiSparkIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d={CHIVI_AI_SPARK_PATH} fill="currentColor" />
    </svg>
  );
}

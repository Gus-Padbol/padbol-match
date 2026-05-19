import React from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const PLACEHOLDER_BORDER = '1px dashed #e53935';
const PLACEHOLDER_BG = 'rgba(229, 57, 53, 0.05)';
const PLACEHOLDER_COLOR = '#e53935';

/**
 * Banner o bloque rectangular: imagen + link opcional, o placeholder "Tu marca aquí".
 */
export function HubJugarSlotRect({ slot, height, width = '100%', borderRadius = 10, objectFit = 'cover' }) {
  const { t } = useTranslation();
  const img = String(slot?.imagen_url || '').trim();
  const url = String(slot?.url_destino || '').trim();
  const h = typeof height === 'number' ? `${height}px` : height;
  const w = typeof width === 'number' ? `${width}px` : width;

  if (img) {
    const inner = (
      <img
        src={img}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          display: 'block',
        }}
      />
    );
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius,
          overflow: 'hidden',
          boxSizing: 'border-box',
          background: '#0f172a',
        }}
      >
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
            {inner}
          </a>
        ) : (
          inner
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius,
        boxSizing: 'border-box',
        border: PLACEHOLDER_BORDER,
        background: PLACEHOLDER_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: PLACEHOLDER_COLOR, textAlign: 'center', padding: '0 10px' }}>
        {t('jugar.publicidad')}
      </span>
    </div>
  );
}

/** Logo 40×40 esquina; imagen o placeholder cuadrado. */
export function HubJugarSlotOverlayCorner({ slot }) {
  const { t } = useTranslation();
  const img = String(slot?.imagen_url || '').trim();
  const url = String(slot?.url_destino || '').trim();
  const box = (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        overflow: 'hidden',
        border: img ? '1px solid rgba(255,255,255,0.35)' : PLACEHOLDER_BORDER,
        background: img ? '#fff' : PLACEHOLDER_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      {img ? (
        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontSize: 8, fontWeight: 700, color: PLACEHOLDER_COLOR, lineHeight: 1.1, textAlign: 'center', padding: 2 }}>
          {t('jugar.publicidadShort')}
        </span>
      )}
    </div>
  );
  if (url && img) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
        {box}
      </a>
    );
  }
  return box;
}

/** Franja horizontal: logo + texto corto, o placeholder ancho. */
export function HubJugarSlotStrip({ slot }) {
  const { t } = useTranslation();
  const img = String(slot?.imagen_url || '').trim();
  const url = String(slot?.url_destino || '').trim();
  const texto = String(slot?.texto_corto || '').trim();

  if (!img && !texto) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: PLACEHOLDER_BORDER,
          background: PLACEHOLDER_BG,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: PLACEHOLDER_COLOR }}>{t('jugar.publicidad')}</span>
      </div>
    );
  }

  const inner = (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '0 14px',
        boxSizing: 'border-box',
        background: 'rgba(15,23,42,0.04)',
      }}
    >
      {img ? (
        <img src={img} alt="" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
      ) : null}
      {texto ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {texto}
        </span>
      ) : null}
    </div>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'block', height: '100%', width: '100%', textDecoration: 'none', color: 'inherit' }}
      >
        {inner}
      </a>
    );
  }
  return inner;
}

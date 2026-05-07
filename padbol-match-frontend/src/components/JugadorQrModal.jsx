import React, { useMemo, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { canUseNavigatorShare } from './ShareLinkButton';

function normalizedAlias(rawAlias) {
  return String(rawAlias || '').trim().replace(/^@+/, '');
}

export default function JugadorQrModal({ open, onClose, alias, nombre, fotoUrl }) {
  const canvasRef = useRef(null);
  const aliasNorm = normalizedAlias(alias);
  const profileUrl = useMemo(
    () => (aliasNorm ? `https://padbolmatch.com/jugador/${encodeURIComponent(aliasNorm)}` : ''),
    [aliasNorm]
  );

  if (!open) return null;

  const handleDownload = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const png = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = png;
      a.download = `padbol-qr-${aliasNorm || 'jugador'}.png`;
      a.click();
    } catch (e) {
      alert('No se pudo descargar el QR.');
    }
  };

  const handleShare = async () => {
    if (!profileUrl) return;
    try {
      if (!canUseNavigatorShare()) throw new Error('share-unavailable');
      await navigator.share({
        title: `Perfil de ${nombre || aliasNorm || 'jugador'}`,
        text: 'Escaneá mi QR para ver mi perfil público en Padbol Match.',
        url: profileUrl,
      });
    } catch (e) {
      if (e?.name === 'AbortError') return;
      try {
        await navigator.clipboard?.writeText(profileUrl);
        alert('Link copiado al portapapeles.');
      } catch {
        alert('No se pudo compartir.');
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        background: 'rgba(2,6,23,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '360px',
          borderRadius: '16px',
          background: '#fff',
          padding: '18px',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt=""
              style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }}
            />
          ) : (
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#667eea,#764ba2)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
              }}
            >
              {(String(nombre || aliasNorm || '?').trim().charAt(0) || '?').toUpperCase()}
            </div>
          )}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>{nombre || 'Jugador'}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>@{aliasNorm || 'sin-alias'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
          <QRCodeCanvas ref={canvasRef} value={profileUrl || 'https://padbolmatch.com'} size={220} bgColor="#ffffff" fgColor="#0f172a" includeMargin />
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px', wordBreak: 'break-all' }}>{profileUrl}</div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleDownload}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Descargar QR
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Compartir
          </button>
        </div>
      </div>
    </div>
  );
}

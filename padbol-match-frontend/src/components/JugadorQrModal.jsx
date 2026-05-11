import React, { useMemo, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { canUseNavigatorShare } from './ShareLinkButton';

function normalizedAlias(rawAlias) {
  return String(rawAlias || '').trim().replace(/^@+/, '');
}

function slugForFilename(s) {
  const t = String(s || 'jugador')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .trim()
    .slice(0, 72);
  return t || 'jugador';
}

async function copyToClipboardWithFallback(text) {
  const link = String(text || '').trim();
  if (!link) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = link;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

/**
 * Modal QR del jugador: enlace absoluto a `/jugador/:alias` (perfil público).
 * @param {string} [apodo] — línea bajo el nombre (ej. apodo o @alias)
 * @param {string} [categoria] — nivel / categoría
 * @param {string} [sede] — club habitual / sede
 */
export default function JugadorQrModal({
  open,
  onClose,
  alias,
  nombre,
  fotoUrl,
  apodo = '',
  categoria = '',
  sede = '',
}) {
  const canvasRef = useRef(null);
  const aliasNorm = normalizedAlias(alias);

  const profileUrl = useMemo(() => {
    if (!aliasNorm) return '';
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? String(window.location.origin).replace(/\/$/, '')
        : 'https://padbolmatch.com';
    return `${origin}/jugador/${encodeURIComponent(aliasNorm)}`;
  }, [aliasNorm]);

  const shareTitle = useMemo(
    () => `Perfil de ${String(nombre || aliasNorm || 'jugador').trim()}`,
    [nombre, aliasNorm]
  );
  const shareText = useMemo(
    () => 'Escanea mi QR o abre el enlace para ver mi perfil público en Padbol Match.',
    []
  );

  const categoriaTxt = String(categoria || '').trim() || '—';
  const sedeTxt = String(sede || '').trim() || '—';
  const apodoTxt = String(apodo || '').trim();

  if (!open) return null;

  const handleDownload = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const png = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = png;
      const base = slugForFilename(String(nombre || '').trim() || aliasNorm || 'jugador');
      a.download = `qr_${base}.png`;
      a.click();
    } catch (e) {
      alert('No se pudo descargar el QR.');
    }
  };

  const handleShare = async () => {
    if (!profileUrl) return;
    if (canUseNavigatorShare()) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: profileUrl,
        });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    const ok = await copyToClipboardWithFallback(profileUrl);
    if (ok) {
      alert('Link copiado al portapapeles.');
    } else {
      window.prompt('Copia este link:', profileUrl);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jugador-qr-modal-title"
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
          maxWidth: '380px',
          borderRadius: '16px',
          background: '#fff',
          padding: '20px 18px 18px',
          boxSizing: 'border-box',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#475569',
            fontSize: '18px',
            lineHeight: 1,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          ×
        </button>

        <h2
          id="jugador-qr-modal-title"
          style={{
            margin: '0 44px 14px 0',
            fontSize: '16px',
            fontWeight: 800,
            color: '#0f172a',
            textAlign: 'left',
          }}
        >
          Tu perfil público
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <QRCodeCanvas
            ref={canvasRef}
            value={
              profileUrl ||
              (aliasNorm ? `https://padbolmatch.com/jugador/${encodeURIComponent(aliasNorm)}` : 'https://padbolmatch.com')
            }
            size={220}
            bgColor="#ffffff"
            fgColor="#0f172a"
            includeMargin
          />
        </div>

        <div
          style={{
            textAlign: 'left',
            marginBottom: '12px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            {fotoUrl ? (
              <img
                src={fotoUrl}
                alt=""
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid #e2e8f0',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#667eea,#764ba2)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  flexShrink: 0,
                  fontSize: '18px',
                }}
              >
                {(String(nombre || aliasNorm || '?').trim().charAt(0) || '?').toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px', lineHeight: 1.3 }}>
                {nombre || 'Jugador'}
              </div>
              {apodoTxt ? (
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>{apodoTxt}</div>
              ) : null}
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '10px', lineHeight: 1.45 }}>
                <span style={{ color: '#64748b', fontWeight: 700 }}>Categoría:</span> {categoriaTxt}
              </div>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px', lineHeight: 1.45 }}>
                <span style={{ color: '#64748b', fontWeight: 700 }}>Sede:</span> {sedeTxt}
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '14px', wordBreak: 'break-all', textAlign: 'left' }}>
          {profileUrl}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={!profileUrl}
            style={{
              flex: '1 1 140px',
              padding: '11px 12px',
              borderRadius: '10px',
              border: 'none',
              background: profileUrl ? '#0f766e' : '#94a3b8',
              color: '#fff',
              fontWeight: 700,
              cursor: profileUrl ? 'pointer' : 'not-allowed',
              fontSize: '14px',
            }}
          >
            Compartir
          </button>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              flex: '1 1 140px',
              padding: '11px 12px',
              borderRadius: '10px',
              border: 'none',
              background: '#1d4ed8',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Descargar
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { getCroppedImgBlob } from '../utils/cropImage';

export default function ImageCropModal({
  open,
  imageSrc,
  onClose,
  onConfirm,
  aspect = 1,
  cropShape = 'round',
  title = 'Recortar foto',
  description = 'Mové la imagen y usá el zoom para encuadrar. Confirmá cuando quede bien.',
  confirmLabel = 'Confirmar recorte',
  confirmColor = '#15803d',
  busy = false,
  zoomInputId = 'image-crop-zoom',
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropAreaListo, setCropAreaListo] = useState(false);
  const croppedAreaPixelsRef = useRef(null);
  const bodyOverflowPrevRef = useRef('');

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    bodyOverflowPrevRef.current = prevOverflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = bodyOverflowPrevRef.current;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropAreaListo(false);
    croppedAreaPixelsRef.current = null;
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_area, areaPixels) => {
    croppedAreaPixelsRef.current = areaPixels;
    setCropAreaListo(Boolean(areaPixels?.width));
  }, []);

  const handleConfirmar = useCallback(async () => {
    const src = imageSrc;
    const pixels = croppedAreaPixelsRef.current;
    if (!src || !pixels || busy) return;
    const blob = await getCroppedImgBlob(src, pixels, 'image/jpeg', 0.92);
    const file = new File([blob], 'recorte.jpg', { type: 'image/jpeg' });
    await onConfirm(file);
  }, [imageSrc, busy, onConfirm]);

  const handleClose = useCallback(() => {
    if (busy) return;
    document.body.style.overflow = bodyOverflowPrevRef.current;
    onClose();
  }, [busy, onClose]);

  if (!open || !imageSrc) return null;

  const canConfirm = cropAreaListo && !busy;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-crop-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        background: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: aspect > 1 ? '520px' : '420px',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)' }}>
          <h3 id="image-crop-modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
            {title}
          </h3>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {description}
          </p>
        </div>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: aspect > 1 ? 'min(50vh, 320px)' : 'min(56vh, 360px)',
            background: '#0f172a',
          }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div style={{ padding: '14px 18px 18px' }}>
          <label
            htmlFor={zoomInputId}
            style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}
          >
            Zoom
          </label>
          <input
            id={zoomInputId}
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(ev) => setZoom(Number(ev.target.value))}
            style={{ width: '100%', marginBottom: '16px' }}
          />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              style={{
                flex: 1,
                minWidth: '120px',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: 700,
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => void handleConfirmar()}
              style={{
                flex: 1,
                minWidth: '120px',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: 700,
                borderRadius: '10px',
                border: "none",
                background: canConfirm ? confirmColor : "#94a3b8",
                color: '#fff',
                cursor: canConfirm ? 'pointer' : 'default',
              }}
            >
              {busy ? 'Subiendo…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

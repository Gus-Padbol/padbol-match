import React, {useCallback, useEffect, useRef, useState} from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import {createImage} from '../utils/cropImage';
import {centeredCoverWindow, hubPhotoSafeArea} from '../utils/hubPhotoFrame';

export async function renderHubPhoto(src, pixels) {
  const image = await createImage(src);
  const scale = Math.min(1, 1200 / Math.max(pixels.width, pixels.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(pixels.width * scale));
  canvas.height = Math.max(1, Math.round(pixels.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la foto');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Drawing the whole original with an offset also preserves intentional margins.
  ctx.drawImage(image, -pixels.x * scale, -pixels.y * scale, image.naturalWidth * scale, image.naturalHeight * scale);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo preparar la foto')), 'image/jpeg', 0.92));
  return new File([blob], 'hub-encuadre.jpg', {type: 'image/jpeg'});
}

export function HubFramingPreview({src, pixels, imageSize, frame}) {
  if (!pixels || !imageSize) return null;
  const window = centeredCoverWindow(pixels.width, pixels.height, frame);
  return <div>
    <strong style={{fontSize: 13}}>{frame.label}</strong>
    <div data-testid={`hub-live-preview-${frame.id}`} style={{position: 'relative', width: '100%', aspectRatio: `${frame.width} / ${frame.height}`, background: '#0f172a', overflow: 'hidden', borderRadius: 12, marginTop: 6}}>
      <div style={{position: 'absolute', width: `${pixels.width / window.width * 100}%`, height: `${pixels.height / window.height * 100}%`, left: `${-window.x / window.width * 100}%`, top: `${-window.y / window.height * 100}%`}}>
        <img alt="" src={src} draggable={false} style={{position: 'absolute', maxWidth: 'none', width: `${imageSize.width / pixels.width * 100}%`, height: `${imageSize.height / pixels.height * 100}%`, left: `${-pixels.x / pixels.width * 100}%`, top: `${-pixels.y / pixels.height * 100}%`}} />
      </div>
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,.65))', pointerEvents: 'none'}} />
    </div>
  </div>;
}

/** Hub-specific editor: previews every place sharing this image, and never
 * uses the already-cropped output as its editable source when an original exists. */
function HubPhotoEditor({open, originalSrc, initialPixels = null, frames, safeFrames = frames, onClose, onConfirm, busy = false, error = '', canSave = true, sourceNotice = ''}) {
  const [crop, setCrop] = useState({x: 0, y: 0});
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [mediaSize, setMediaSize] = useState(null);
  const [cropSize, setCropSize] = useState(null);
  const [localError, setLocalError] = useState('');
  const inFlight = useRef(false);
  const initialFitRef = useRef(false);
  const sourceRef = useRef(originalSrc);
  sourceRef.current = originalSrc;
  const master = frames.find(frame => frame.id === 'jugar') || frames[0];
  useEffect(() => {
    if (!open) return undefined;
    sourceRef.current = originalSrc;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { sourceRef.current = null; document.body.style.overflow = previous; };
  }, [open, originalSrc]);
  const fitWholePhoto = useCallback(() => {
    if (!mediaSize || !cropSize) return;
    const safe = hubPhotoSafeArea(cropSize.width, cropSize.height, safeFrames);
    setCrop({x: 0, y: 0});
    setZoom(Math.max(0.1, Math.min(safe.width / mediaSize.width, safe.height / mediaSize.height)));
  }, [mediaSize, cropSize, safeFrames]);
  useEffect(() => {
    if (initialPixels || initialFitRef.current || !mediaSize || !cropSize) return;
    initialFitRef.current = true;
    fitWholePhoto();
  }, [initialPixels, mediaSize, cropSize, fitWholePhoto]);
  if (!open || !originalSrc) return null;
  const save = async () => {
    if (busy || !canSave || !pixels || inFlight.current) return;
    const source = originalSrc;
    inFlight.current = true; setLocalError('');
    try {
      const file = await renderHubPhoto(source, pixels);
      if (sourceRef.current !== source) return;
      await onConfirm(file, {pixels, originalSrc: source});
    } catch (err) { if (sourceRef.current === source) setLocalError(err?.message || 'No se pudo guardar el encuadre'); }
    finally { inFlight.current = false; }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="hub-framing-title" style={{position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(0,0,0,.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 12}}>
    <div style={{width: '100%', maxWidth: 760, maxHeight: '94vh', overflowY: 'auto', borderRadius: 16, background: 'var(--bg-card)', color: 'var(--text-primary)', padding: 18}}>
      <h3 id="hub-framing-title" style={{marginTop: 0}}>Acomodar la foto del Hub</h3>
      <p>Mueve la foto y revisa las dos vistas. «Foto completa» añade margen para que no se corten las caras.</p>
      {sourceNotice ? <p role="status">{sourceNotice}</p> : null}
      <div style={{height: 260, position: 'relative', background: '#0f172a', borderRadius: 12, overflow: 'hidden'}}>
        <Cropper image={originalSrc} crop={crop} zoom={zoom} minZoom={0.1} maxZoom={3} aspect={master.width / master.height} restrictPosition={false} showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropSizeChange={setCropSize} onCropComplete={(_area, value) => setPixels(value)} onCropAreaChange={(_area, value) => setPixels(value)} initialCroppedAreaPixels={initialPixels || undefined} onMediaLoaded={media => {setImageSize({width: media.naturalWidth, height: media.naturalHeight});setMediaSize(media);}} />
      </div>
      <div style={{display: 'flex', gap: 12, alignItems: 'center', margin: '14px 0'}}>
        <button type="button" disabled={busy || !mediaSize} onClick={fitWholePhoto}>Foto completa</button>
        <label htmlFor="hub-framing-zoom">Alejar / acercar</label>
        <input id="hub-framing-zoom" type="range" min="0.1" max="3" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} disabled={busy} style={{flex: 1, minWidth: 60}} />
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginBottom: 16}}>
        {frames.map(frame => <HubFramingPreview key={frame.id} src={originalSrc} pixels={pixels} imageSize={imageSize} frame={frame} />)}
      </div>
      {error || localError ? <p role="alert" style={{color: '#dc2626'}}>{error || localError}</p> : null}
      <div style={{display: 'flex', gap: 12}}>
        <button type="button" disabled={busy} onClick={onClose} style={{padding: 12, flex: 1}}>Cancelar</button>
        <button type="button" disabled={busy || !canSave || !pixels} onClick={save} style={{padding: 12, flex: 1, background: '#E11B22', color: '#fff', border: 0, borderRadius: 8}}>{busy ? 'Guardando…' : 'Guardar encuadre'}</button>
      </div>
    </div>
  </div>;
}

export default function HubPhotoEditorModal(props) {
  return props.open && props.originalSrc ? <HubPhotoEditor key={props.originalSrc} {...props} /> : null;
}

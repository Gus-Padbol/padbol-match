import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { buildCheckinQrUrl, resolveReservaQrToken } from '../utils/reservaCheckinQr';
import './ReservaQrModal.css';

/**
 * Modal de check-in: QR grande para reserva confirmada.
 */
export default function ReservaQrModal({ open, reserva, accessToken, apiBaseUrl, onClose, onTokenResolved }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrToken, setQrToken] = useState('');
  const onTokenResolvedRef = useRef(onTokenResolved);
  onTokenResolvedRef.current = onTokenResolved;

  useEffect(() => {
    if (!open || !reserva?.id) {
      setLoading(false);
      setError('');
      setQrToken('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setQrToken('');

    resolveReservaQrToken({
      reservaId: reserva.id,
      existingToken: reserva.qr_token,
      accessToken,
      apiBaseUrl,
    })
      .then((token) => {
        if (cancelled) return;
        setQrToken(token);
        if (onTokenResolvedRef.current && !String(reserva.qr_token || '').trim()) {
          onTokenResolvedRef.current(reserva.id, token);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || t('checkin.qrError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, reserva?.id, reserva?.qr_token, accessToken, apiBaseUrl, t]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !reserva) return null;

  const qrUrl = buildCheckinQrUrl(qrToken);
  const sede = String(reserva.sede || '').trim() || '—';
  const fecha = String(reserva.fecha || '').trim();
  const hora = String(reserva.hora || '').trim();

  return (
    <div
      className="reserva-qr-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserva-qr-modal-title"
      onClick={onClose}
    >
      <div className="reserva-qr-modal__panel" onClick={(e) => e.stopPropagation()}>
        <h2 id="reserva-qr-modal-title" className="reserva-qr-modal__title">
          {t('checkin.tuQr')}
        </h2>
        <p className="reserva-qr-modal__meta">
          {sede}
          {fecha || hora ? (
            <span className="reserva-qr-modal__meta-sub">
              {fecha}
              {fecha && hora ? ' · ' : ''}
              {hora}
            </span>
          ) : null}
        </p>

        {loading ? (
          <p className="reserva-qr-modal__loading">{t('general.loading')}</p>
        ) : error ? (
          <p className="reserva-qr-modal__error" role="alert">
            {error}
          </p>
        ) : qrUrl ? (
          <div className="reserva-qr-modal__qr-wrap">
            <QRCodeCanvas value={qrUrl} size={240} level="M" includeMargin />
          </div>
        ) : null}

        <button type="button" className="reserva-qr-modal__close" onClick={onClose}>
          {t('general.close')}
        </button>
      </div>
    </div>
  );
}

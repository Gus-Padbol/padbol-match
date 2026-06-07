import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useSafeTranslation } from '../../i18n/tSafe';

const QR_PUBLIC_BASE = 'https://padbolmatch.com';

function buildJoinUrl(sedeId, cancha) {
  const encodedCancha = encodeURIComponent(String(cancha || '').trim());
  return `${QR_PUBLIC_BASE}/scoreboard/join/${encodeURIComponent(String(sedeId))}/${encodedCancha}`;
}

export default function ScoreboardCanchaQrModal({ partido, onClose }) {
  const { t } = useSafeTranslation();
  if (!partido) return null;

  const sedeId = partido.sede_id;
  const cancha = String(partido.cancha || '').trim() || t('admin.scoreboard.defaultCourt', 'Cancha 1');
  const joinUrl = buildJoinUrl(sedeId, cancha);

  return (
    <div
      className="sb-cancha-qr-modal__backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="sb-cancha-qr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-cancha-qr-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="sb-cancha-qr-modal__close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
        <h3 id="sb-cancha-qr-title" className="sb-cancha-qr-modal__title">
          {t('admin.scoreboard.qrTitle', 'QR fijo de cancha')}
        </h3>
        <p className="sb-cancha-qr-modal__subtitle">
          {partido.equipo_a_nombre}
          {' vs '}
          {partido.equipo_b_nombre}
          {' · '}
          {cancha}
        </p>

        <div className="sb-cancha-qr-modal__single">
          <QRCodeCanvas value={joinUrl} size={220} level="M" includeMargin />
          <p className="sb-cancha-qr-modal__url">{joinUrl}</p>
        </div>

        <p className="sb-cancha-qr-modal__hint">
          {t(
            'admin.scoreboard.qrScanHint',
            'Escaneá este QR al llegar a la cancha',
          )}
        </p>
        <p className="sb-cancha-qr-modal__hint">
          {t(
            'admin.scoreboard.qrHint',
            'Imprimí este QR y pegalo en la cancha. Es permanente.',
          )}
        </p>
      </div>
    </div>
  );
}

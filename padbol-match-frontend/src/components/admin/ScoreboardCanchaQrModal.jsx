import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useSafeTranslation } from '../../i18n/tSafe';

const QR_PUBLIC_BASE = 'https://padbolmatch.com';

function buildJoinUrl(sedeId, cancha, equipo) {
  const encodedCancha = encodeURIComponent(String(cancha || '').trim());
  return `${QR_PUBLIC_BASE}/scoreboard/join/${encodeURIComponent(String(sedeId))}/${encodedCancha}/${equipo}`;
}

export default function ScoreboardCanchaQrModal({ partido, onClose }) {
  const { t } = useSafeTranslation();
  if (!partido) return null;

  const sedeId = partido.sede_id;
  const cancha = String(partido.cancha || '').trim() || t('admin.scoreboard.defaultCourt', 'Cancha 1');
  const urlA = buildJoinUrl(sedeId, cancha, 'a');
  const urlB = buildJoinUrl(sedeId, cancha, 'b');

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
          {t('admin.scoreboard.qrTitle', 'QR fijos de cancha')}
        </h3>
        <p className="sb-cancha-qr-modal__subtitle">
          {partido.equipo_a_nombre}
          {' vs '}
          {partido.equipo_b_nombre}
          {' · '}
          {cancha}
        </p>

        <div className="sb-cancha-qr-modal__grid">
          <div className="sb-cancha-qr-modal__item">
            <p className="sb-cancha-qr-modal__label">
              {t('admin.scoreboard.qrTeamA', '🔵 Lado Azul')}
            </p>
            <QRCodeCanvas value={urlA} size={180} level="M" includeMargin />
            <p className="sb-cancha-qr-modal__url">{urlA}</p>
          </div>
          <div className="sb-cancha-qr-modal__item">
            <p className="sb-cancha-qr-modal__label">
              {t('admin.scoreboard.qrTeamB', '🔴 Lado Rojo')}
            </p>
            <QRCodeCanvas value={urlB} size={180} level="M" includeMargin />
            <p className="sb-cancha-qr-modal__url">{urlB}</p>
          </div>
        </div>

        <p className="sb-cancha-qr-modal__hint">
          {t(
            'admin.scoreboard.qrSideHint',
            'Cada equipo escanea el QR de su lado de la cancha',
          )}
        </p>
        <p className="sb-cancha-qr-modal__hint">
          {t(
            'admin.scoreboard.qrHint',
            'Imprimí estos QR y pegálos en la cancha. Son permanentes.',
          )}
        </p>
      </div>
    </div>
  );
}

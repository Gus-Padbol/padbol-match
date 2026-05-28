import { useEffect, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { fetchAdminJugadorReputacion } from '../utils/jugadorReputacionApi';
import './ReputacionJugadorPanel.css';

/** Badges de reputación en listados admin (reservas). */
export default function JugadorReputacionBadges({ userId, apiBaseUrl, accessToken }) {
  const { t } = useTranslation();
  const uid = String(userId || '').trim();
  const [rep, setRep] = useState(null);

  useEffect(() => {
    if (!uid || !accessToken) {
      setRep(null);
      return;
    }
    let cancelled = false;
    fetchAdminJugadorReputacion({ apiBaseUrl, accessToken, userId: uid })
      .then((data) => {
        if (!cancelled) setRep(data);
      })
      .catch(() => {
        if (!cancelled) setRep(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, apiBaseUrl, accessToken]);

  if (!rep) return null;

  const count = Number(rep.cancelaciones_30dias) || 0;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {rep.suspendido ? (
        <span className="reputacion-badge reputacion-badge--danger">{t('reputacion.badgeSuspended')}</span>
      ) : null}
      {!rep.suspendido && count >= 3 ? (
        <span className="reputacion-badge reputacion-badge--warn">{t('reputacion.badgeManyCancellations')}</span>
      ) : null}
    </div>
  );
}

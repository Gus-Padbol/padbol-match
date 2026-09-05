import { useEffect, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { padbolLangToIntlLocale } from '../utils/padbolLang';
import { fetchJugadorReputacion, formatFechaReputacion } from '../utils/jugadorReputacionApi';
import './ReputacionJugadorPanel.css';

/**
 * Banners de reputación (suspensión / advertencia) y contador de cancelaciones.
 */
export default function ReputacionJugadorPanel({
  apiBaseUrl,
  accessToken,
  showCounter = true,
  compact = false,
  className = '',
}) {
  const { t, i18n } = useTranslation();
  const locale = padbolLangToIntlLocale(i18n.language);
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(Boolean(accessToken));

  useEffect(() => {
    if (!accessToken) {
      setRep(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchJugadorReputacion({ apiBaseUrl, accessToken })
      .then((data) => {
        if (!cancelled) setRep(data);
      })
      .catch(() => {
        if (!cancelled) setRep(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, accessToken]);

  if (!accessToken || loading || !rep) return null;
  if (!rep.suspendido && !rep.advertencia && !(showCounter && rep.cancelaciones_30dias > 0)) {
    return null;
  }

  const fechaHasta = formatFechaReputacion(rep.suspendido_hasta, locale);
  const count = Number(rep.cancelaciones_30dias) || 0;

  return (
    <div className={`reputacion-panel${className ? ` ${className}` : ''}`}>
      {rep.suspendido ? (
        <div className="reputacion-panel__banner reputacion-panel__banner--danger" role="alert">
          {t('reputacion.suspendedBanner', { date: fechaHasta })}
        </div>
      ) : rep.advertencia ? (
        <div className="reputacion-panel__banner reputacion-panel__banner--warn" role="status">
          {t('reputacion.warningBanner', { count })}
        </div>
      ) : null}
      {showCounter && count > 0 && !compact ? (
        <p className="reputacion-panel__counter">
          {t('reputacion.recentCancellations', { count })}
        </p>
      ) : null}
    </div>
  );
}

/** Solo el banner amarillo de advertencia (flujo reserva). */
export function ReputacionReservaAdvertencia({ apiBaseUrl, accessToken }) {
  const { t } = useTranslation();
  const [rep, setRep] = useState(null);

  useEffect(() => {
    if (!accessToken) {
      setRep(null);
      return;
    }
    let cancelled = false;
    fetchJugadorReputacion({ apiBaseUrl, accessToken })
      .then((data) => {
        if (!cancelled) setRep(data);
      })
      .catch(() => {
        if (!cancelled) setRep(null);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, accessToken]);

  if (!rep?.advertencia || rep?.suspendido) return null;
  const count = Number(rep.cancelaciones_30dias) || 0;
  return (
    <div className="reputacion-panel__banner reputacion-panel__banner--warn" role="status" style={{ marginBottom: 14 }}>
      {t('reputacion.warningBanner', { count })}
    </div>
  );
}

/** Hook ligero para bloquear pago si está suspendido. */
export function useJugadorReputacionReserva({ apiBaseUrl, accessToken, enabled = true }) {
  const { t, i18n } = useTranslation();
  const locale = padbolLangToIntlLocale(i18n.language);
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled && accessToken));

  useEffect(() => {
    if (!enabled || !accessToken) {
      setRep(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchJugadorReputacion({ apiBaseUrl, accessToken })
      .then((data) => {
        if (!cancelled) setRep(data);
      })
      .catch(() => {
        if (!cancelled) setRep(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, accessToken, enabled]);

  const suspendido = Boolean(rep?.suspendido);
  const advertencia = Boolean(rep?.advertencia && !rep?.suspendido);
  const suspendidoMsg = suspendido
    ? t('reputacion.suspendedBanner', {
        date: formatFechaReputacion(rep?.suspendido_hasta, locale),
      })
    : '';

  return { rep, loading, suspendido, advertencia, suspendidoMsg, cancelaciones: Number(rep?.cancelaciones_30dias) || 0 };
}

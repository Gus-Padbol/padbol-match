import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import PadbolBrandLogo from '../components/PadbolBrandLogo';
import './CheckinKiosco.css';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

const SCANNER_DIV_ID = 'checkin-qr-reader';
const RESET_MS = 4000;

function extractQrToken(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/QR-\d+-\d+-[a-f0-9]+/i);
  if (m) return m[0];
  try {
    const u = new URL(s);
    const path = u.pathname.split('/').filter(Boolean).pop();
    if (path && path.startsWith('QR-')) return path;
  } catch {
    /* plain token */
  }
  return s;
}

export default function CheckinKiosco() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('scan');
  const [manualToken, setManualToken] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef(null);
  const resetTimerRef = useRef(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const volverAEscanear = useCallback(() => {
    clearResetTimer();
    setResult(null);
    setBusy(false);
    setPhase('scan');
  }, [clearResetTimer]);

  const programarReset = useCallback(() => {
    clearResetTimer();
    resetTimerRef.current = setTimeout(() => {
      volverAEscanear();
    }, RESET_MS);
  }, [clearResetTimer, volverAEscanear]);

  const procesarToken = useCallback(
    async (rawToken) => {
      const qr_token = extractQrToken(rawToken);
      if (!qr_token || busy) return;
      setBusy(true);
      try {
        const valRes = await fetch(
          `${API_BASE}/api/checkin/validar/${encodeURIComponent(qr_token)}`
        );
        const val = await valRes.json().catch(() => ({}));
        if (!val?.valido) {
          setResult({ ok: false, motivo: val?.motivo || t('checkin.invalido') });
          setPhase('error');
          programarReset();
          return;
        }

        const confRes = await fetch(
          `${API_BASE}/api/checkin/confirmar/${encodeURIComponent(qr_token)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operador: 'kiosco' }),
          }
        );
        const conf = await confRes.json().catch(() => ({}));
        if (!confRes.ok && !conf?.ok) {
          setResult({ ok: false, motivo: conf?.error || t('checkin.invalido') });
          setPhase('error');
          programarReset();
          return;
        }

        setResult({
          ok: true,
          nombre: val.nombre,
          cancha: val.cancha,
          hora: val.hora,
          sede: val.sede,
        });
        setPhase('success');
        programarReset();
      } catch (e) {
        setResult({ ok: false, motivo: e?.message || t('checkin.invalido') });
        setPhase('error');
        programarReset();
      } finally {
        setBusy(false);
      }
    },
    [busy, programarReset, t]
  );

  useEffect(() => {
    if (phase !== 'scan') return undefined;

    const scanner = new Html5QrcodeScanner(
      SCANNER_DIV_ID,
      { fps: 10, qrbox: { width: 280, height: 280 }, rememberLastUsedCamera: true },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      (decoded) => {
        if (busy) return;
        scanner.clear().catch(() => {});
        scannerRef.current = null;
        void procesarToken(decoded);
      },
      () => {}
    );

    return () => {
      clearResetTimer();
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [phase, busy, procesarToken, clearResetTimer]);

  const onManualSubmit = (e) => {
    e.preventDefault();
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    void procesarToken(manualToken);
  };

  const horaDisplay = (hora) => {
    const s = String(hora || '').trim();
    if (!s) return '—';
    return s.split(' - ')[0].trim();
  };

  return (
    <div className={`checkin-kiosco checkin-kiosco--${phase}`}>
      <header className="checkin-kiosco__header">
        <PadbolBrandLogo
          variant="on-dark"
          className="checkin-kiosco__logo"
          style={{ height: 48, width: 'auto' }}
        />
        <img src="/chivi.png" alt="" className="checkin-kiosco__chivi" />
        <h1 className="checkin-kiosco__title">{t('checkin.titulo')}</h1>
        <p className="checkin-kiosco__subtitle">{t('checkin.escanear')}</p>
      </header>

      {phase === 'scan' ? (
        <div className="checkin-kiosco__scan-panel">
          <div id={SCANNER_DIV_ID} className="checkin-kiosco__scanner" />
          <form className="checkin-kiosco__manual" onSubmit={onManualSubmit}>
            <input
              type="text"
              className="checkin-kiosco__manual-input"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="QR-…"
              autoComplete="off"
              disabled={busy}
            />
            <button type="submit" className="checkin-kiosco__manual-btn" disabled={busy || !manualToken.trim()}>
              OK
            </button>
          </form>
        </div>
      ) : null}

      {phase === 'success' && result?.ok ? (
        <div className="checkin-kiosco__result checkin-kiosco__result--ok">
          <div className="checkin-kiosco__result-icon">✅</div>
          <h2>{t('checkin.valido')}</h2>
          <p className="checkin-kiosco__result-name">{result.nombre || '—'}</p>
          <p className="checkin-kiosco__result-detail">
            {t('admin.metricas.courtCol', { defaultValue: 'Cancha' })} {result.cancha ?? '—'} ·{' '}
            {horaDisplay(result.hora)}
          </p>
          {result.sede ? <p className="checkin-kiosco__result-sede">{result.sede}</p> : null}
          <button type="button" className="checkin-kiosco__reset-btn" onClick={volverAEscanear}>
            {t('checkin.reiniciar')}
          </button>
        </div>
      ) : null}

      {phase === 'error' && result && !result.ok ? (
        <div className="checkin-kiosco__result checkin-kiosco__result--error">
          <div className="checkin-kiosco__result-icon">❌</div>
          <h2>{t('checkin.invalido')}</h2>
          <p className="checkin-kiosco__result-motivo">{result.motivo}</p>
          <button type="button" className="checkin-kiosco__reset-btn" onClick={volverAEscanear}>
            {t('checkin.reiniciar')}
          </button>
        </div>
      ) : null}

      {busy ? <div className="checkin-kiosco__busy">{t('general.loading')}</div> : null}
    </div>
  );
}

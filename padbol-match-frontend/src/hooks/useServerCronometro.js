import { useEffect, useState } from 'react';

function isCronometroPausado(partido) {
  const raw = partido?.cronometro_pausado;
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  return Boolean(raw);
}

/**
 * Cronómetro derivado del estado del servidor: solo avanza cuando
 * display.cronometroActivo es true; al pausar muestra el valor congelado del backend.
 */
export default function useServerCronometro(partido) {
  const serverSeconds = Math.max(0, Number(partido?.display?.cronometroSegundos) || 0);
  const cronometroActivo = Boolean(partido?.display?.cronometroActivo) && !isCronometroPausado(partido);
  const [anchor, setAnchor] = useState({ seconds: serverSeconds, at: Date.now() });
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!cronometroActivo) return undefined;
    setAnchor({ seconds: serverSeconds, at: Date.now() });
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cronometroActivo, serverSeconds, partido?.cronometro_pausado, partido?.cronometro_inicio]);

  if (!cronometroActivo) return serverSeconds;
  return anchor.seconds + Math.floor((nowMs - anchor.at) / 1000);
}

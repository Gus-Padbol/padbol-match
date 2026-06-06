import { useEffect, useState } from 'react';

/**
 * Cronómetro derivado del estado del servidor: solo avanza cuando
 * display.cronometroActivo es true; al pausar muestra el valor congelado del backend.
 */
export default function useServerCronometro(partido) {
  const cronometroActivo = Boolean(partido?.display?.cronometroActivo);
  const serverSeconds = partido?.display?.cronometroSegundos ?? 0;
  const [anchor, setAnchor] = useState({ seconds: serverSeconds, at: Date.now() });
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    setAnchor({ seconds: serverSeconds, at: Date.now() });
  }, [
    serverSeconds,
    cronometroActivo,
    partido?.cronometro_pausado,
    partido?.cronometro_inicio,
  ]);

  useEffect(() => {
    if (!cronometroActivo) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cronometroActivo]);

  if (!cronometroActivo) return serverSeconds;
  return anchor.seconds + Math.floor((nowMs - anchor.at) / 1000);
}

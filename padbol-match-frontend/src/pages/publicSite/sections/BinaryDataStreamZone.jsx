import React, { useEffect, useState } from 'react';
import BinaryDataStream from '../globe/BinaryDataStream';

/**
 * Zona de contenido (Qué es → Jugadores → Comunidad) con corriente binaria
 * vertical alternada: comienza a la izquierda y termina a la derecha, antes
 * de que empiecen las secciones fotográficas. Hace scroll con la zona.
 */
export default function BinaryDataStreamZone({ children }) {
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const [tablet, setTablet] = useState(() =>
    typeof window !== 'undefined'
      ? window.innerWidth >= 768 && window.innerWidth < 900
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setCompact(w < 768);
      setTablet(w >= 768 && w < 900);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div
      className="ps-binary-zone"
      data-binary-zone="true"
      data-binary-zone-start="what-is"
      data-binary-zone-end="community"
    >
      <BinaryDataStream
        className="ps-binary-zone__stream ps-binary-zone__stream--start"
        reducedMotion={reduceMotion}
        compact={compact}
        tablet={tablet}
        position="left"
        direction="ttb"
        color="cyan"
      />
      <BinaryDataStream
        className="ps-binary-zone__stream ps-binary-zone__stream--end"
        reducedMotion={reduceMotion}
        compact={compact}
        tablet={tablet}
        position="right"
        direction="ttb"
        speedScale={1.12}
        opacityScale={0.82}
        color="cyan"
      />
      <div className="ps-binary-zone__content">{children}</div>
    </div>
  );
}

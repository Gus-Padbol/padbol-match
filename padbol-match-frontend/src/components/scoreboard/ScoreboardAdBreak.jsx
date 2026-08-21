import React, { useEffect, useMemo, useState } from 'react';
import { sponsorsForScoreboardPlacement } from '../../utils/scoreboardAdvertising';

const AD_ROTATION_MS = 6000;

/**
 * Pantalla comercial del marcador. Siempre trabaja con los sponsors activos
 * de la sede y rota hasta diez piezas sin requerir una integración externa.
 */
export default function ScoreboardAdBreak({ sponsors, moment = 'break', startIndex = 0 }) {
  const placement = moment === 'waiting' ? 'waiting' : moment === 'game-break' ? 'game_break' : moment === 'set-break' ? 'set_break' : 'rest';
  const items = useMemo(() => sponsorsForScoreboardPlacement(sponsors, placement).slice(0, 10), [sponsors, placement]);
  const [index, setIndex] = useState(0);
  const isWaiting = moment === 'waiting';

  useEffect(() => {
    setIndex(items.length ? startIndex % items.length : 0);
  }, [items.length, moment, startIndex]);

  useEffect(() => {
    if (items.length < 2) return undefined;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, AD_ROTATION_MS);
    return () => window.clearInterval(id);
  }, [items.length]);

  const sponsor = items[index] || null;
  const title = isWaiting
    ? 'PRÓXIMO PARTIDO'
    : moment === 'game-break'
      ? 'CAMBIO DE GAME'
      : 'TIEMPO DE DESCANSO';

  return (
    <section className={`sb-ad-break sb-ad-break--${moment}`} aria-label="Espacio publicitario">
      <div className="sb-ad-break__topline">
        <span>PADBOL MATCH</span>
        <span>{title}</span>
      </div>
      <div className="sb-ad-break__content" key={`${sponsor?.id || 'venue'}-${index}`}>
        {sponsor?.tipo_media === 'video' && sponsor?.video_url ? (
          <video className="sb-ad-break__media" src={sponsor.video_url} autoPlay muted loop playsInline />
        ) : sponsor?.banner_url ? (
          <img src={sponsor.banner_url} alt={sponsor.nombre} className="sb-ad-break__media" />
        ) : sponsor?.logo_url ? <img src={sponsor.logo_url} alt={sponsor.nombre} className="sb-ad-break__logo" /> : null}
        <p className="sb-ad-break__eyebrow">
          {sponsor?.categoria || (sponsor ? 'SPONSOR OFICIAL' : 'ESPACIO DISPONIBLE')}
        </p>
        <h1>{sponsor?.nombre || 'TU MARCA ACÁ'}</h1>
        <p className="sb-ad-break__message">
          {sponsor
            ? 'Este encuentro es posible junto a nuestros aliados.'
            : 'Promocioná tu marca, buffet, shop o beneficio de la sede.'}
        </p>
      </div>
      <div className="sb-ad-break__footer">
        <span>{items.length ? `${index + 1} / ${items.length}` : 'PUBLICIDAD DE LA SEDE'}</span>
        <span className="sb-ad-break__pulse" aria-hidden="true" />
      </div>
    </section>
  );
}

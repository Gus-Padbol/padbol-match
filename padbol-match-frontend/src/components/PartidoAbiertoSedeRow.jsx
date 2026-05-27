import React from 'react';
import PartidoAbiertoCard from './PartidoAbiertoCard';

/** Fila compacta en perfil público de sede — misma UI que PartidoAbiertoCard (variante sede). */
export default function PartidoAbiertoSedeRow({ partido, onJoin, joining = false }) {
  return (
    <PartidoAbiertoCard
      partido={partido}
      onJoin={onJoin}
      joining={joining}
      variant="sede"
    />
  );
}

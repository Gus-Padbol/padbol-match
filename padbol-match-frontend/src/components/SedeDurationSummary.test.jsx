import React from 'react';
import { render, screen } from '@testing-library/react';
import SedeDurationSummary from './SedeDurationSummary';

it('distinguishes base and sport-specific prices for equal durations without changing amounts', () => {
  render(<div>
    <SedeDurationSummary row={{ duracion_minutos: 60, deporte: null, precio: 20000, activo: true }} activeLabel="Activa" inactiveLabel="Inactiva" />
    <SedeDurationSummary row={{ duracion_minutos: 60, deporte: 'padbol', precio: 26000, activo: true }} activeLabel="Activa" inactiveLabel="Inactiva" />
  </div>);
  expect(screen.getAllByText('60 min')).toHaveLength(2);
  expect(screen.getByText('Base · ARS 20.000 · Activa')).toBeInTheDocument();
  expect(screen.getByText('Padbol · ARS 26.000 · Activa')).toBeInTheDocument();
});

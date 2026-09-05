import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminIncentivosSection from './AdminIncentivosSection';

jest.setTimeout(20000);

const program = {
  id: 'programa-1',
  sede_id: 7,
  beneficio_hasta: '2027-03-04',
  meses_desbloqueados: 2,
  racha_actual: 2,
  configuracion: {
    torneos_minimos: 1,
    jugadores_registrados_minimos: 8,
    partidos_marcador_minimos: 3,
    reservas_minimas: 10,
    jugadores_activos_minimos: 10,
    movimientos_padcoins_minimos: 5,
  },
  progreso: [],
};

afterEach(() => jest.restoreAllMocks());

test('muestra reglas, vigencia y continuidad del beneficio', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => [program] });
  render(<AdminIncentivosSection accessToken="token" sedeId={7} />);

  expect(await screen.findByText('Hasta 2027-03-04')).toBeInTheDocument();
  expect(screen.getByText(/continuar sin pagar indefinidamente/i)).toBeInTheDocument();
  expect(screen.getByText(/8 jugadores registrados e identificados/i)).toBeInTheDocument();
  expect(screen.getByText(/progreso parcial vence/i)).toBeInTheDocument();
  expect(screen.getByText(/continuar en Starter/i)).toBeInTheDocument();
  expect(screen.getByText(/no se realiza ningún cobro automático/i)).toBeInTheDocument();
});

test('presenta el avance real contra cada mínimo mensual', async () => {
  jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce({ ok: true, json: async () => [program] })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        preview: true,
        metrics: {
          torneos_validos: 1,
          jugadores_registrados_torneos: 8,
          partidos_marcador_finalizados: 2,
          reservas_validas: 10,
          jugadores_activos: 10,
          movimientos_padcoins: 5,
        },
        evaluation: {
          cumplido: false,
          criterios: { torneos_integrales: true, jugadores_registrados: true, marcador: false, reservas: true, jugadores_activos: true, padcoins: true },
          rules: program.configuracion,
        },
      }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => [program] });

  render(<AdminIncentivosSection accessToken="token" sedeId={7} />);
  await screen.findByText('Hasta 2027-03-04');
  fireEvent.click(screen.getByRole('button', { name: /actualizar progreso/i }));

  await waitFor(() => expect(screen.getByText(/Partidos finalizados con el marcador de Padbol Match: 2\/3/)).toBeInTheDocument());
  expect(screen.getByText(/Lo incompleto no se traslada/i)).toBeInTheDocument();
});

import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminIncentivosSection from './AdminIncentivosSection';

const VERSION = 'activity-v4-four-goals-scoreboard-half';
const currentPeriod = `${new Date().toISOString().slice(0, 7)}-01`;
const priorMonth = offset => {
  const date = new Date(`${currentPeriod}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - offset);
  return date.toISOString().slice(0, 7);
};
const rules = {
  torneos_integrales_minimos: 1, parejas_confirmadas_por_torneo_minimas: 8,
  jugadores_distintos_por_torneo_minimos: 16, partidos_marcador_porcentaje_minimo: 50,
  reservas_completadas_minimas: 10, jugadores_vinculados_activos_minimos: 10,
};
const policy = { rulesVersion: VERSION, currency: 'USD', baseMonthlyUsd: 68, includedMonths: 3, padbolCourtMonthlyUsd: 34, objectivesMonthlyUsd: 17, billingEnabled: false };

function progress({ complete = false, period = currentPeriod, unavailable = false, mixed = false } = {}) {
  const values = [1, complete ? 1 : 0, 10, 10], targets = [1, 1, 10, 10];
  const keys = ['torneos_integrales', 'marcador', 'reservas', 'jugadores_activos'];
  const detail = Object.fromEntries(keys.map((key, i) => [key, {
    configured: true, current: unavailable && i === 2 ? null : values[i], target: targets[i],
    state: unavailable && i === 2 ? 'unavailable' : values[i] >= targets[i] ? 'completed' : 'pending',
  }]));
  return {
    period, preview: true, persisted: false, credito_otorgado: false, requires_rules_migration: false,
    metrics: { torneos_integrales_validos: values[0], torneos_marcador_completo: values[1], reservas_validas: unavailable ? null : 10, jugadores_activos: 10 },
    evaluation: { rules_version: VERSION, configuracion_completa: true, cumplido: unavailable ? null : complete, criterios_configurados: 4, criterios_cumplidos: complete ? 4 : 3, criterios_requeridos: 4, detalle_criterios: detail },
    evidence: [{ torneo_id: 91, parejas_confirmadas: 8, jugadores_distintos: 16, torneo_elegible: true, partidos_requeridos: 15, partidos_jugados_resultado_registrado: 15, todos_resultados_registrados: true, partidos_jugados_sincronizados: complete ? 8 : 7, porcentaje_marcador_minimo: 50, partidos_marcador_requeridos: 8, marcador_completo: complete }],
    commercial_status: { venue_scope: mixed ? 'mixed' : 'padbol_only', program_month: 4, phase: mixed ? 'mixed_quote_pending' : complete ? 'objectives_met_projected' : 'objectives_in_progress', currency: 'USD', projected_monthly_usd: mixed ? null : complete ? 17 : null, reference_monthly_usd: mixed ? null : 34, potential_monthly_usd: mixed ? null : 17, billing_enabled: false },
  };
}
const response = payload => ({ ok: true, json: async () => payload });
const payload = (report = progress(), overrides = {}) => ({ policy, programs: [{ id: 'program-1', sede_id: 7, estado: 'borrador', reglas_version: VERSION, configuracion: rules, progreso: [], current_progress: report, ...overrides }] });
const fetchMock = value => jest.spyOn(global, 'fetch').mockResolvedValue(response(value));

afterEach(() => jest.restoreAllMocks());

test('la sede consulta su propio informe V4, con cuatro objetivos y detalle 7 de 8 marcadores', async () => {
  const fetch = fetchMock(payload());
  render(<AdminIncentivosSection apiBaseUrl="https://qa.example" accessToken="test-token" sedeId={7} sedes={[{ id: 99, nombre: 'Otra sede' }]} />);
  expect(await screen.findByText('3 de 4 cumplidos')).toBeInTheDocument();
  expect(screen.getByText('USD 34 de referencia')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(4);
  expect(screen.getByText('15 / 15')).toBeInTheDocument();
  expect(screen.getByText('7 / 8')).toBeInTheDocument();
  expect(screen.queryByLabelText('Sede')).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByText(/PadCoins/i)).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith('https://qa.example/api/admin/incentivos?sede_id=7', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }), signal: expect.anything() }));
});

test('sólo proyecta el beneficio conjunto con cuatro objetivos cumplidos y 8 de 8 marcadores', async () => {
  fetchMock(payload(progress({ complete: true })));
  render(<AdminIncentivosSection accessToken="token" sedeId={7} />);
  expect(await screen.findByText('4 de 4 cumplidos')).toBeInTheDocument();
  expect(screen.getByText('USD 17 proyectados')).toBeInTheDocument();
  expect(screen.getByText('8 / 8')).toBeInTheDocument();
  expect(screen.getByText(/no confirma un descuento aplicado ni genera cobros/i)).toBeInTheDocument();
  expect(screen.getByText(/Las mismas parejas y los mismos jugadores pueden participar/i)).toBeInTheDocument();
  expect(screen.getByText(/no son informes cerrados/i)).toBeInTheDocument();
});

test('al cambiar de mes oculta el cumplimiento anterior y un error no lo restaura', async () => {
  let rejectMonth;
  const fetch = fetchMock(payload(progress({ complete: true })));
  render(<AdminIncentivosSection apiBaseUrl="https://qa.example" accessToken="token" sedeId={7} />);
  await screen.findByText('USD 17 proyectados');
  fetch.mockResolvedValueOnce(response(payload())).mockImplementationOnce(() => new Promise((resolve, reject) => { rejectMonth = reject; }));
  fireEvent.change(screen.getByLabelText('Mes del informe'), { target: { value: priorMonth(1) } });
  expect(screen.queryByText('USD 17 proyectados')).not.toBeInTheDocument();
  await waitFor(() => expect(rejectMonth).toBeDefined());
  expect(fetch).toHaveBeenLastCalledWith('https://qa.example/api/admin/incentivos/7/evaluar', expect.objectContaining({ method: 'POST', body: JSON.stringify({ periodo: `${priorMonth(1)}-01` }) }));
  await act(async () => rejectMonth(new Error('Consulta mensual interrumpida')));
  expect(await screen.findByRole('alert')).toHaveTextContent('Consulta mensual interrumpida');
  expect(screen.queryByText('4 de 4 cumplidos')).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('ignora una respuesta tardía de otro mes aunque fetch no respete la cancelación', async () => {
  let resolveEarlier;
  const fetch = fetchMock(payload());
  render(<AdminIncentivosSection accessToken="token" sedeId={7} />);
  await screen.findByText('3 de 4 cumplidos');
  fetch.mockResolvedValueOnce(response(payload())).mockImplementationOnce(() => new Promise(resolve => { resolveEarlier = resolve; }));
  fireEvent.change(screen.getByLabelText('Mes del informe'), { target: { value: priorMonth(1) } });
  await waitFor(() => expect(resolveEarlier).toBeDefined());
  fetch.mockResolvedValueOnce(response(payload())).mockResolvedValueOnce(response(progress({ period: `${priorMonth(2)}-01` })));
  fireEvent.change(screen.getByLabelText('Mes del informe'), { target: { value: priorMonth(2) } });
  await screen.findByText('3 de 4 cumplidos');
  await act(async () => resolveEarlier(response(progress({ complete: true, period: `${priorMonth(1)}-01` }))));
  expect(screen.queryByText('USD 17 proyectados')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Mes del informe')).toHaveValue(priorMonth(2));
});

test.each(['pricing-v2', 'activity-v3-four-goals-15-matches'])('no interpreta la versión antigua %s como cuatro metas', async version => {
  const old = payload(progress({ complete: true }), { reglas_version: version });
  old.policy = { ...policy, rulesVersion: version };
  const fetch = fetchMock(old);
  render(<AdminIncentivosSection accessToken="token" sedeId={7} isSuperAdmin />);
  expect(await screen.findByText('Actualización de objetivos pendiente')).toBeInTheDocument();
  expect(screen.queryByText('USD 17 proyectados')).not.toBeInTheDocument();
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('un dato nulo sigue no disponible y no fabrica cero ni confirma el beneficio', async () => {
  fetchMock(payload(progress({ complete: true, unavailable: true })));
  render(<AdminIncentivosSection accessToken="token" sedeId={7} />);
  expect(await screen.findByText('Cumplimiento no disponible')).toBeInTheDocument();
  const reservations = screen.getByRole('listitem', { name: 'Reservas verificadas' });
  expect(within(reservations).getByText('Reservas válidas: No disponible')).toBeInTheDocument();
  expect(within(reservations).getByText('Dato no disponible')).toBeInTheDocument();
  expect(screen.queryByText('USD 17 proyectados')).not.toBeInTheDocument();
});

test('no asigna la tarifa exclusiva Padbol a una sede mixta', async () => {
  fetchMock(payload(progress({ complete: true, mixed: true })));
  render(<AdminIncentivosSection accessToken="token" sedeId={7} />);
  expect(await screen.findByText('Cotización pendiente')).toBeInTheDocument();
  expect(screen.queryByText(/USD (17|34)/)).not.toBeInTheDocument();
});

test('rechaza un período distinto al consultado', async () => {
  const fetch = fetchMock(payload());
  render(<AdminIncentivosSection accessToken="token" sedeId={7} />);
  await screen.findByText('3 de 4 cumplidos');
  fetch.mockResolvedValueOnce(response(payload())).mockResolvedValueOnce(response(progress({ complete: true })));
  fireEvent.change(screen.getByLabelText('Mes del informe'), { target: { value: priorMonth(1) } });
  expect(await screen.findByRole('alert')).toHaveTextContent('El servidor devolvió otro período');
  expect(screen.queryByText('USD 17 proyectados')).not.toBeInTheDocument();
});

test('un cambio de sede elimina el informe anterior y no acepta datos de otra sede', async () => {
  const fetch = fetchMock(payload(progress({ complete: true })));
  const { rerender } = render(<AdminIncentivosSection accessToken="token" sedeId={7} />);
  await screen.findByText('USD 17 proyectados');
  rerender(<AdminIncentivosSection accessToken="token" sedeId={8} />);
  expect(screen.queryByText('USD 17 proyectados')).not.toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se recibió el informe de la sede seleccionada');
  expect(fetch.mock.calls.at(-1)[0]).toContain('sede_id=8');
});

test('superadmin configura sólo un borrador V4 mediante una acción explícita y parámetros exactos', async () => {
  const fetch = fetchMock(payload(undefined, { reglas_version: 'pricing-v2', legacy_configuration: true }));
  render(<AdminIncentivosSection accessToken="token" sedeId={7} isSuperAdmin />);
  await screen.findByText('Actualización de objetivos pendiente');
  expect(fetch).toHaveBeenCalledTimes(1);
  const button = screen.getByRole('button', { name: 'Guardar objetivos del borrador' });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fetch.mockResolvedValueOnce(response({ configuracion: rules })).mockResolvedValueOnce(response(payload()));
  fireEvent.click(button);
  expect(await screen.findByText(/Los cuatro objetivos se guardaron en un borrador/i)).toBeInTheDocument();
  expect(fetch.mock.calls.find(([, options]) => options.method === 'PATCH')[1].body).toBe(JSON.stringify({ reglas_version: VERSION, configuracion: rules }));
});

test('crear programa requiere backend V4 y confirmación, sin activar cobros', async () => {
  const fetch = fetchMock({ policy, programs: [] });
  render(<AdminIncentivosSection accessToken="token" sedeId={7} isSuperAdmin />);
  await screen.findByText('Programa pendiente de configuración');
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('checkbox'));
  fetch.mockResolvedValueOnce(response({ estado: 'borrador' })).mockResolvedValueOnce(response(payload()));
  fireEvent.click(screen.getByRole('button', { name: 'Crear borrador sin activar cobros' }));
  await screen.findByText(/No se activaron cobros/i);
  const write = fetch.mock.calls.find(([, options]) => options.method === 'POST');
  expect(write[0]).toMatch(/\/7\/activar$/);
  expect(JSON.parse(write[1].body)).toEqual({ reglas_version: VERSION, configuracion: rules });
});

test('no ofrece cambiar las reglas de un programa activo', async () => {
  fetchMock(payload(undefined, { estado: 'activo' }));
  render(<AdminIncentivosSection accessToken="token" sedeId={7} isSuperAdmin />);
  await screen.findByText('3 de 4 cumplidos');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

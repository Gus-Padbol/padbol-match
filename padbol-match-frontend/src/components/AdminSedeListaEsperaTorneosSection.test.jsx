import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import AdminSedeListaEsperaTorneosSection from './AdminSedeListaEsperaTorneosSection';
import { fetchAdminListaEsperaGeneral } from '../utils/listaEsperaAdminApi';

jest.mock('../utils/listaEsperaAdminApi', () => ({ fetchAdminListaEsperaGeneral: jest.fn() }));
const translate = key => key;
jest.mock('../i18n/adminTranslation', () => ({ useSafeTranslation: () => ({ t: translate, i18n: { language: 'es' } }) }));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
const row = name => ({ id: 1, nombre: name, deporte: 'padbol', waitlistSource: 'venue' });
afterEach(() => jest.resetAllMocks());

test('descarta respuestas tardías de otra sede y no muestra datos tras perder sesión', async () => {
  const old = deferred(), current = deferred();
  fetchAdminListaEsperaGeneral.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const { rerender } = render(<AdminSedeListaEsperaTorneosSection sedeId={1} accessToken="session-a" />);
  const oldSignal = fetchAdminListaEsperaGeneral.mock.calls[0][0].signal;
  rerender(<AdminSedeListaEsperaTorneosSection sedeId={2} accessToken="session-b" />);
  expect(oldSignal.aborted).toBe(true);
  await act(async () => current.resolve({ items: [row('Sede B')] }));
  expect(screen.getByText('Sede B')).toBeInTheDocument();
  await act(async () => old.resolve({ items: [row('Sede A')] }));
  expect(screen.queryByText('Sede A')).not.toBeInTheDocument();
  expect(screen.getByText('Sede B')).toBeInTheDocument();
  rerender(<AdminSedeListaEsperaTorneosSection sedeId={2} accessToken="" />);
  expect(screen.queryByText('Sede B')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});

test('una respuesta antigua no termina la carga de la sede nueva', async () => {
  const old = deferred(), current = deferred();
  fetchAdminListaEsperaGeneral.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const { rerender } = render(<AdminSedeListaEsperaTorneosSection sedeId={1} accessToken="session" />);
  rerender(<AdminSedeListaEsperaTorneosSection sedeId={2} accessToken="session" />);
  await act(async () => old.resolve({ items: [row('Sede A')] }));
  expect(screen.queryByText('Sede A')).not.toBeInTheDocument();
  expect(screen.getByText('admin.common.loadingEllipsis')).toBeInTheDocument();
  await act(async () => current.resolve({ items: [row('Sede B')] }));
  expect(screen.getByText('Sede B')).toBeInTheDocument();
});

test('al cambiar de sede oculta inmediatamente los datos ya cargados', async () => {
  const next = deferred();
  fetchAdminListaEsperaGeneral.mockResolvedValueOnce({ items: [row('Sede A')] }).mockReturnValueOnce(next.promise);
  const { rerender } = render(<AdminSedeListaEsperaTorneosSection sedeId={1} accessToken="session" />);
  expect(await screen.findByText('Sede A')).toBeInTheDocument();
  rerender(<AdminSedeListaEsperaTorneosSection sedeId={2} accessToken="session" />);
  expect(screen.queryByText('Sede A')).not.toBeInTheDocument();
  await act(async () => next.resolve({ items: [] }));
});

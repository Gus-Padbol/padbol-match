import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminWhatsappSection from './AdminWhatsappSection';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const inboxItem = { id: 'm1', from_wa_id: '5491123456789', text_body: 'Hola, ¿hay cancha?' };

function mockFetch(handler) {
  global.fetch = jest.fn((url, options = {}) => Promise.resolve(handler(String(url), options)));
  return global.fetch;
}

afterEach(() => jest.restoreAllMocks());

test('operador ve la bandeja y no la auditoría', async () => {
  mockFetch((url) => {
    if (url.includes('/permissions')) return ok({ role: 'operator', canOperate: true, canAudit: false });
    if (url.includes('/inbox')) return ok({ items: [inboxItem] });
    throw new Error(`unexpected ${url}`);
  });
  render(<AdminWhatsappSection accessToken="tok" />);
  expect(await screen.findByText('5491123456789')).toBeInTheDocument();
  expect(screen.queryByText(/Entrantes:/)).not.toBeInTheDocument();
});

test('superadmin ve la auditoría y no la bandeja', async () => {
  mockFetch((url) => {
    if (url.includes('/permissions')) return ok({ role: 'superadmin', canOperate: false, canAudit: true });
    if (url.includes('/audit')) return ok({ inbound: [], outbox: [], classifications: [], operators: [], config: [] });
    throw new Error(`unexpected ${url}`);
  });
  render(<AdminWhatsappSection accessToken="tok" />);
  expect(await screen.findByText(/Entrantes:/)).toBeInTheDocument();
  expect(screen.queryByText('Registrar respuesta')).not.toBeInTheDocument();
});

test('sin permisos muestra acceso denegado', async () => {
  mockFetch(() => ok({ role: 'none', canOperate: false, canAudit: false }));
  render(<AdminWhatsappSection accessToken="tok" />);
  expect(await screen.findByText('No tienes acceso a esta sección.')).toBeInTheDocument();
});

test('muestra estado de carga mientras resuelve permisos', () => {
  mockFetch(() => new Promise(() => {}));
  render(<AdminWhatsappSection accessToken="tok" />);
  expect(screen.getByText('Cargando…')).toBeInTheDocument();
});

test('error 403 muestra mensaje específico', async () => {
  mockFetch(() => ({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) }));
  render(<AdminWhatsappSection accessToken="tok" />);
  expect(await screen.findByText('No tienes acceso a WhatsApp.')).toBeInTheDocument();
});

test('respuesta exitosa muestra "Respuesta registrada — envío desactivado"', async () => {
  mockFetch((url) => {
    if (url.includes('/permissions')) return ok({ role: 'operator', canOperate: true, canAudit: false });
    if (url.includes('/reply')) return ok({ ok: true });
    if (url.includes('/inbox')) return ok({ items: [inboxItem] });
    throw new Error(`unexpected ${url}`);
  });
  render(<AdminWhatsappSection accessToken="tok" />);
  await screen.findByText('5491123456789');
  fireEvent.click(screen.getByRole('button'));
  fireEvent.change(screen.getByPlaceholderText('Escribe la respuesta…'), { target: { value: 'Gracias' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar respuesta' }));
  expect(await screen.findByText('Respuesta registrada — envío desactivado')).toBeInTheDocument();
});

test('previene doble envío mientras está pendiente', async () => {
  let resolveReply;
  const replyPromise = new Promise((res) => { resolveReply = res; });
  mockFetch((url) => {
    if (url.includes('/permissions')) return ok({ role: 'operator', canOperate: true, canAudit: false });
    if (url.includes('/reply')) return replyPromise;
    if (url.includes('/inbox')) return ok({ items: [inboxItem] });
    throw new Error(`unexpected ${url}`);
  });
  render(<AdminWhatsappSection accessToken="tok" />);
  await screen.findByText('5491123456789');
  fireEvent.click(screen.getByRole('button'));
  fireEvent.change(screen.getByPlaceholderText('Escribe la respuesta…'), { target: { value: 'Gracias' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar respuesta' }));
  const sending = screen.getByRole('button', { name: 'Enviando…' });
  expect(sending).toBeDisabled();
  fireEvent.click(sending);
  await act(async () => { resolveReply(ok({ ok: true })); });
  await waitFor(() => {
    const replyCalls = global.fetch.mock.calls.filter(([u]) => String(u).includes('/reply'));
    expect(replyCalls).toHaveLength(1);
  });
});

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import AdminHelpPage from './AdminHelpPage';
import { adminHelpApi } from '../../utils/adminHelpApi';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'qa' }, access_token: 'fixture' } }) }));
jest.mock('../../context/PadbolI18nContext', () => ({ usePadbolI18n: () => ({ language: 'es' }) }));
jest.mock('../../utils/adminHelpApi', () => ({ adminHelpApi: { search: jest.fn(), getArticle: jest.fn() } }));

const results = [
  { id: 'admin-panel-by-role', module: 'administracion', slug: 'panel-por-rol', title: 'Panel por rol', snippet: 'Revisa tu panel.', status: 'reviewed', verification: 'reviewed' },
  { id: 'admin-soporte', module: 'soporte', slug: 'gestionar-tickets', title: 'Tickets', snippet: 'Revisa tickets.', status: 'reviewed', verification: 'reviewed' },
];
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const renderPage = () => render(<MemoryRouter initialEntries={['/ayuda/administracion']}><Routes><Route path="/ayuda/administracion" element={<AdminHelpPage />} /></Routes></MemoryRouter>);

beforeEach(() => { jest.clearAllMocks(); adminHelpApi.search.mockResolvedValue({ results, total: results.length, lang: 'es' }); });
afterEach(() => { jest.restoreAllMocks(); });

test('routes: protected center renders searchable categories and safe article links', async () => {
  renderPage();
  expect(await screen.findByText('Panel por rol')).toBeInTheDocument();
  expect(screen.getByText('Tickets')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Panel por rol/ })).toHaveAttribute('href', '/ayuda/administracion/administracion/panel-por-rol?lang=es');
  expect(adminHelpApi.search).toHaveBeenCalledWith('fixture', expect.objectContaining({ q: '', lang: 'es' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tickets' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() => expect(adminHelpApi.search).toHaveBeenCalledWith('fixture', expect.objectContaining({ q: 'tickets' })));
});

test('categories filter results and language change refetches', async () => {
  renderPage();
  await screen.findByText('Panel por rol');
  fireEvent.click(screen.getByRole('button', { name: 'Soporte' }));
  expect(screen.getByText('Tickets')).toBeInTheDocument();
  expect(screen.queryByText('Panel por rol')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  await waitFor(() => expect(adminHelpApi.search).toHaveBeenLastCalledWith('fixture', expect.objectContaining({ lang: 'en' })));
});

test('401/403/409 fail closed with visible state and no private content', async () => {
  for (const status of [401, 403, 409]) {
    adminHelpApi.search.mockRejectedValueOnce(Object.assign(new Error('denied'), { status, code: `HELP_${status}` }));
    const { unmount } = renderPage();
    await screen.findByRole('alert');
    expect(screen.queryByText('Panel por rol')).toBeNull();
    unmount();
  }
});

test('role revocation on refetch removes prior content and shows denied state', async () => {
  renderPage();
  await screen.findByText('Panel por rol');
  adminHelpApi.search.mockRejectedValueOnce(Object.assign(new Error('revoked'), { status: 403, code: 'HELP_FORBIDDEN' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'after-revoke' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/permiso/i));
  expect(screen.queryByText('Panel por rol')).toBeNull();
});

test('category/search/language are encoded in the protected article link', async () => {
  render(<MemoryRouter initialEntries={['/ayuda/administracion?lang=en&q=tickets&category=soporte']}>
    <Routes><Route path="/ayuda/administracion" element={<AdminHelpPage />} /></Routes>
  </MemoryRouter>);
  await screen.findByText('Tickets');
  expect(screen.getByRole('link', { name: /Tickets/ })).toHaveAttribute('href', '/ayuda/administracion/soporte/gestionar-tickets?lang=en&q=tickets&category=soporte');
});

test('browser query navigation updates language, search and category state', async () => {
  function Harness() {
    const navigate = useNavigate();
    return <><button type="button" onClick={() => navigate('/ayuda/administracion?lang=en&q=tickets&category=soporte')}>nav</button><AdminHelpPage /></>;
  }
  render(<MemoryRouter initialEntries={['/ayuda/administracion']}><Routes><Route path="/ayuda/administracion" element={<Harness />} /></Routes></MemoryRouter>);
  await screen.findByText('Panel por rol');
  fireEvent.click(screen.getByRole('button', { name: 'nav' }));
  await waitFor(() => expect(adminHelpApi.search).toHaveBeenLastCalledWith('fixture', expect.objectContaining({ lang: 'en', q: 'tickets' })));
  expect(screen.getByRole('searchbox')).toHaveValue('tickets');
  expect(screen.getByRole('button', { name: 'Support' })).toHaveAttribute('aria-pressed', 'true');
});

test('role/scope storage change invalidates and reloads authorized results', async () => {
  window.localStorage.setItem('user_role_data', JSON.stringify({ rol: 'admin_club', sedeId: 7, pais: 'AR', organizacionId: null }));
  renderPage();
  await screen.findByText('Panel por rol');
  expect(adminHelpApi.search).toHaveBeenCalledTimes(1);
  window.localStorage.setItem('user_role_data', JSON.stringify({ rol: 'super_admin', sedeId: null, pais: null, organizacionId: null }));
  await act(async () => { window.dispatchEvent(new Event('storage')); });
  await waitFor(() => expect(adminHelpApi.search).toHaveBeenCalledTimes(2));
  window.localStorage.clear();
});

test('focus forces a 403 revalidation even when session storage is unchanged', async () => {
  renderPage();
  await screen.findByText('Panel por rol');
  adminHelpApi.search.mockRejectedValueOnce(Object.assign(new Error('revoked'), { status: 403, code: 'HELP_FORBIDDEN' }));
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/permiso/i));
  expect(screen.queryByText('Panel por rol')).toBeNull();
});

test('503 then 200 retries the same query via Reintentar', async () => {
  adminHelpApi.search.mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 })).mockResolvedValueOnce({ results, total: results.length, lang: 'es' });
  renderPage();
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/No se pudo cargar/);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Panel por rol')).toBeInTheDocument();
  expect(adminHelpApi.search).toHaveBeenCalledTimes(2);
  expect(adminHelpApi.search.mock.calls[0][1].q).toBe('');
  expect(adminHelpApi.search.mock.calls[1][1].q).toBe('');
});

test('submitting the same query after 503 reloads without changing text', async () => {
  adminHelpApi.search.mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 })).mockResolvedValueOnce({ results, total: results.length, lang: 'es' });
  renderPage();
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  expect(await screen.findByText('Panel por rol')).toBeInTheDocument();
  expect(adminHelpApi.search).toHaveBeenCalledTimes(2);
  expect(adminHelpApi.search.mock.calls[1][1].q).toBe('');
});

test('late response after language/session change is discarded', async () => {
  const first = deferred(); const second = deferred();
  adminHelpApi.search.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  renderPage();
  await waitFor(() => expect(adminHelpApi.search).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  await waitFor(() => expect(adminHelpApi.search).toHaveBeenCalledTimes(2));
  second.resolve({ results: [{ ...results[0], title: 'New EN' }], total: 1, lang: 'en' });
  await screen.findByText('New EN');
  first.resolve({ results: [{ ...results[0], title: 'Old ES' }], total: 1, lang: 'es' });
  await Promise.resolve();
  await Promise.resolve();
  expect(screen.queryByText('Old ES')).toBeNull();
});


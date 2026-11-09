import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminHelpArticlePage from './AdminHelpArticlePage';
import { adminHelpApi } from '../../utils/adminHelpApi';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'qa' }, access_token: 'fixture' } }) }));
jest.mock('../../context/PadbolI18nContext', () => ({ usePadbolI18n: () => ({ language: 'es' }) }));
jest.mock('../../utils/adminHelpApi', () => ({ adminHelpApi: { search: jest.fn(), getArticle: jest.fn() } }));

const article = {
  id: 'admin-soporte', module: 'soporte', slug: 'gestionar-tickets', lang: 'es', title: 'Revisar tickets',
  status: 'reviewed', verification: 'reviewed', sourceVersion: { frontend: 'WEB798', backend: 'backend42' },
  requirements: ['Sesión válida con super_admin.'],
  steps: ['Abre /admin/soporte.', 'Selecciona un ticket.'],
  limit: 'Revisa con soporte si una opción no aparece.',
};
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const renderAt = (path = '/ayuda/administracion/soporte/gestionar-tickets') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/ayuda/administracion/:module/:slug" element={<AdminHelpArticlePage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => { jest.clearAllMocks(); adminHelpApi.getArticle.mockResolvedValue({ article }); });
afterEach(() => jest.restoreAllMocks());

test('protected article renders requirements, steps, source limit and safe back link', async () => {
  renderAt();
  expect(await screen.findByRole('heading', { name: 'Revisar tickets' })).toBeInTheDocument();
  expect(screen.getByText('Sesión válida con super_admin.')).toBeInTheDocument();
  expect(screen.getByText('Abre /admin/soporte.')).toBeInTheDocument();
  expect(screen.getByText(/Revisa con soporte/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Volver a la guía/ })).toHaveAttribute('href', '/ayuda/administracion?lang=es');
  expect(adminHelpApi.getArticle).toHaveBeenCalledWith('fixture', 'soporte', 'gestionar-tickets', expect.objectContaining({ lang: 'es' }));
});

test('language PT 409 shows localized unavailable and never falls back', async () => {
  renderAt();
  await screen.findByRole('heading', { name: 'Revisar tickets' });
  adminHelpApi.getArticle.mockRejectedValueOnce(Object.assign(new Error('missing'), { status: 409, code: 'HELP_LOCALIZATION_UNAVAILABLE' }));
  fireEvent.click(screen.getByRole('button', { name: 'PT' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('não está disponível'));
  expect(screen.queryByText('Abre /admin/soporte.')).toBeNull();
});

test('back link preserves language, search and category', async () => {
  renderAt('/ayuda/administracion/soporte/gestionar-tickets?lang=en&q=tickets&category=soporte');
  await screen.findByRole('heading', { name: 'Revisar tickets' });
  expect(screen.getByRole('link', { name: /Back to guide/ })).toHaveAttribute('href', '/ayuda/administracion?lang=en&q=tickets&category=soporte');
});

test('403 hides content and 404 hides unknown article', async () => {
  adminHelpApi.getArticle.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status: 403 }));
  renderAt();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/permiso/i));
  expect(screen.queryByText('Abre /admin/soporte.')).toBeNull();
});

test('503 then 200 article offers Reintentar and recovers', async () => {
  adminHelpApi.getArticle.mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 })).mockResolvedValueOnce({ article });
  renderAt();
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('heading', { name: 'Revisar tickets' })).toBeInTheDocument();
  expect(adminHelpApi.getArticle).toHaveBeenCalledTimes(2);
});

test('late detail response after language change is discarded', async () => {
  const first = deferred(); const second = deferred();
  adminHelpApi.getArticle.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  renderAt();
  await waitFor(() => expect(adminHelpApi.getArticle).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  await waitFor(() => expect(adminHelpApi.getArticle).toHaveBeenCalledTimes(2));
  second.resolve({ article: { ...article, title: 'New detail', lang: 'en' } });
  await screen.findByRole('heading', { name: 'New detail' });
  first.resolve({ article: { ...article, title: 'Old detail', lang: 'es' } });
  await Promise.resolve(); await Promise.resolve();
  expect(screen.queryByText('Old detail')).toBeNull();
});

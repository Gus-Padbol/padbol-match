import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import HelpCenterPage from './HelpCenterPage';
import HelpCenterArticlePage from './HelpCenterArticlePage';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/ayuda" element={<HelpCenterPage />} />
        <Route path="/ayuda/:module/:slug" element={<HelpCenterArticlePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('public help center UI', () => {
  test('lists only the verified article and exposes the login-gated support link', () => {
    renderAt('/ayuda');
    expect(screen.getByRole('heading', {name: 'Help center'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Open the account creation form/})).toHaveAttribute(
      'href',
      '/ayuda/cuenta/abrir-registro',
    );
    const support = screen.getByRole('link', {name: 'Contact support'});
    expect(support).toHaveAttribute('href', '/soporte');
    expect(support).toHaveStyle({color: '#0f172a'});
    expect(screen.getByRole('heading', {name: 'Opening a ticket requires signing in.'})).toHaveStyle({color: '#fff'});
    expect(screen.getByText('Opening a ticket requires signing in.')).toBeInTheDocument();
    expect(screen.getByText('No ticket is sent from this page.')).toBeInTheDocument();
  });

  test('search without matches shows support and never falls back to the first article', async () => {
    renderAt('/ayuda?q=qqqq-sin-resultado');
    await waitFor(() => {
      expect(screen.getByText('No verified content matches that search.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', {name: /Open the account creation form/})).toBeNull();
    expect(screen.getByRole('link', {name: 'Contact support'})).toBeInTheDocument();
  });

  test('search finds the article, opens its deep link, shows the verified scope and the not-verified note', async () => {
    renderAt('/ayuda');
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, {target: {value: 'create account'}});
    fireEvent.click(screen.getByRole('button', {name: 'Search'}));
    const link = await screen.findByRole('link', {name: /Open the account creation form/});
    fireEvent.click(link);
    expect(await screen.findByRole('heading', {name: 'Open the account creation form'})).toBeInTheDocument();
    expect(screen.getByText(/NOT VERIFIED/)).toBeInTheDocument();
    expect(screen.getByText(/Only opening the account creation form/)).toBeInTheDocument();
    expect(screen.getByText(/Article · Account/)).toBeInTheDocument();
    expect(screen.getByText(/Spanish interface/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Contact support'})).toHaveAttribute('href', '/soporte');
  });

  test('unknown article slugs render a 404-style view and no article content', () => {
    renderAt('/ayuda/cuenta/inexistente');
    expect(screen.getByRole('heading', {name: '404 · Article not found'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Open the account creation form'})).toBeNull();
    expect(screen.getByRole('link', {name: 'Go to the help center'})).toHaveAttribute('href', '/ayuda');
  });

  test('the article back link returns to the help center', async () => {
    renderAt('/ayuda/cuenta/abrir-registro');
    fireEvent.click(screen.getByRole('link', {name: 'Back to the help center'}));
    expect(await screen.findByRole('heading', {name: 'Help center'})).toBeInTheDocument();
  });

  test('the help heading receives focus on entry', async () => {
    renderAt('/ayuda');
    const heading = screen.getByRole('heading', {name: 'Help center'});
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });
});

import { act, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

jest.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    loading: false,
    session: null,
    signOutAndClear: jest.fn(),
    userProfile: null,
  }),
}));

jest.mock('./pages/AdminDashboard', () => function AdminDashboardMock() {
  return <div>Admin dashboard</div>;
});

jest.mock('./pages/LandingPage', () => function LandingPageMock() {
  return <main>Padbol Match</main>;
});

jest.mock('./pages/publicSite/PublicSitePage', () => function PublicSitePageMock() {
  return <main>Padbol Match</main>;
});

jest.mock('./pages/AccesoCuenta', () => function AccesoCuentaMock() {
  return <main>Ingreso canónico</main>;
});

async function renderAppAt(path) {
  window.history.replaceState({}, '', path);
  await act(async () => {
    render(<ThemeProvider><AuthProvider><App /></AuthProvider></ThemeProvider>);
  });
}

test('monta la aplicación', async () => {
  let container;
  await act(async () => {
    ({ container } = render(
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    ));
  });
  expect(container).toBeTruthy();
});

test('login histórico redirige a auth y conserva redirect', async () => {
  await renderAppAt('/login?redirect=%2Fadmin%3Ftab%3Dwhatsapp');
  await waitFor(() => expect(window.location.pathname).toBe('/auth'));
  expect(window.location.search).toBe('?redirect=%2Fadmin%3Ftab%3Dwhatsapp');
  expect(await screen.findByText('Ingreso canónico')).toBeInTheDocument();
});

test('admin sin sesión termina en auth preservando la ruta completa', async () => {
  await renderAppAt('/admin?tab=whatsapp');
  await waitFor(() => expect(window.location.pathname).toBe('/auth'));
  expect(new URLSearchParams(window.location.search).get('redirect')).toBe('/admin?tab=whatsapp');
  expect(await screen.findByText('Ingreso canónico')).toBeInTheDocument();
});

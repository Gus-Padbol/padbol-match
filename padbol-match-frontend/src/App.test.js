import { act, render } from '@testing-library/react';
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

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';

const mockSignOut = jest.fn();
const mockSession = { user: { email: 'admin@example.test' } };
const mockProfile = { nombre: 'Rodrigo' };
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ session: mockSession, signOutAndClear: mockSignOut, userProfile: mockProfile, loading: false }) }));
jest.mock('../hooks/useUserRole', () => () => ({ rol: 'admin_club', sedeId: null, loading: false }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../i18n/tSafe', () => ({ useSafeTranslation: () => ({ t: key => key }) }));
jest.mock('../hooks/usePadbolLang', () => ({ usePadbolLangVersion: () => 0 }));
jest.mock('../supabaseClient', () => ({ supabase: {} }));
jest.mock('./HubThemeSettingsButton', () => () => null);
jest.mock('./LanguageSwitcher', () => () => null);
function Path() { return <div data-testid="path">{useLocation().pathname}</div>; }
test('volver al hub mantiene la sesión del administrador', () => {
  window.scrollTo = jest.fn();
  render(<MemoryRouter initialEntries={['/admin']}><AppHeader adminPanelMinimalHeader /><Path /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'hub.backToHub' }));
  expect(screen.getByTestId('path')).toHaveTextContent('/hub');
  expect(mockSignOut).not.toHaveBeenCalled();
});

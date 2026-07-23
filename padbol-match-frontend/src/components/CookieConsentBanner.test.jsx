import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { HubNavLayoutProvider } from '../context/HubNavLayoutContext';
import CookieConsentBanner, {
  COOKIES_CONSENT_ACCEPTED,
  COOKIES_CONSENT_ESSENTIAL,
  COOKIES_CONSENT_STORAGE_KEY,
} from './CookieConsentBanner';

function renderBanner() {
  return render(
    <MemoryRouter>
      <HubNavLayoutProvider>
        <CookieConsentBanner />
      </HubNavLayoutProvider>
    </MemoryRouter>,
  );
}

describe('CookieConsentBanner', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
  });

  it('respeta el idioma activo y permite aceptar todas las cookies', () => {
    renderBanner();

    expect(screen.getByText('We use cookies to improve your experience.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(localStorage.getItem(COOKIES_CONSENT_STORAGE_KEY)).toBe(COOKIES_CONSENT_ACCEPTED);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('permite conservar solamente las cookies esenciales', () => {
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: 'Essential only' }));

    expect(localStorage.getItem(COOKIES_CONSENT_STORAGE_KEY)).toBe(COOKIES_CONSENT_ESSENTIAL);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

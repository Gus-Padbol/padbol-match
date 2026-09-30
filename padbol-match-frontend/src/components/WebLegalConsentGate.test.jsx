import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WebLegalConsentGate from './WebLegalConsentGate';
import {
  acceptCurrentLegalDocuments,
  fetchCurrentLegalAcceptance,
} from '../utils/legalDocuments';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    session: { user: { id: 'user-super-admin' } },
    signOutAndClear: jest.fn(),
  }),
}));

jest.mock('../i18n/tSafe', () => ({
  useSafeTranslation: () => ({ t: (key) => key }),
}));

jest.mock('../utils/legalDocuments', () => ({
  LEGAL_DOCUMENTS: {
    terms: { version: '2026-09-05', url: '/terminos' },
    privacy: { version: '2026-09-10', url: '/privacidad' },
  },
  acceptCurrentLegalDocuments: jest.fn(),
  fetchCurrentLegalAcceptance: jest.fn(),
  hasCurrentLegalAcceptance: (data) => Boolean(data?.current),
}));

function renderAdminGate() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <WebLegalConsentGate><div>ADMIN LISTO</div></WebLegalConsentGate>
    </MemoryRouter>,
  );
}

describe('WebLegalConsentGate en el ingreso al panel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('abre admin cuando la versión legal vigente ya está aceptada', async () => {
    fetchCurrentLegalAcceptance.mockResolvedValue({ current: true });
    renderAdminGate();
    expect(await screen.findByText('ADMIN LISTO')).toBeInTheDocument();
  });

  it('registra la aceptación real antes de abrir admin', async () => {
    fetchCurrentLegalAcceptance.mockResolvedValue({ current: false });
    acceptCurrentLegalDocuments.mockResolvedValue({ current: true });
    renderAdminGate();

    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'auth.legalGateAccept' }));

    await waitFor(() => expect(acceptCurrentLegalDocuments).toHaveBeenCalledWith('web_gate'));
    expect(await screen.findByText('ADMIN LISTO')).toBeInTheDocument();
  });

  it('muestra un error recuperable y revalida sin saltarse consentimiento', async () => {
    fetchCurrentLegalAcceptance
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ current: true });
    renderAdminGate();

    expect(await screen.findByText('auth.legalGateCheckError')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'general.retry' }));

    expect(await screen.findByText('ADMIN LISTO')).toBeInTheDocument();
    expect(fetchCurrentLegalAcceptance).toHaveBeenCalledTimes(2);
    expect(acceptCurrentLegalDocuments).not.toHaveBeenCalled();
  });
});

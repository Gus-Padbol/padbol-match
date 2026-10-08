import { render, screen, waitFor } from '@testing-library/react';
import AdminWhatsappSection from './AdminWhatsappSection';
import { whatsappAdminApi } from '../utils/whatsappAdminApi';

jest.mock('../utils/whatsappAdminApi', () => ({
  whatsappAdminApi: {
    permissions: jest.fn(),
    inbox: jest.fn(),
    audit: jest.fn(),
  },
}));

describe('workspace Atención / CRM', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renderiza la bandeja real cuando el backend está disponible', async () => {
    whatsappAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: true });
    whatsappAdminApi.inbox.mockResolvedValue({
      items: [{ id: 'crm-1', from_wa_id: '+5491100000000', text_body: 'Consulta de inscripción' }],
    });

    render(<AdminWhatsappSection accessToken="token" onBack={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Atención / CRM' })).toBeInTheDocument();
    expect(await screen.findByText('+5491100000000')).toBeInTheDocument();
    expect(screen.queryByText('Ruta no encontrada')).not.toBeInTheDocument();
  });

  it('convierte un 404 del backend en un estado operativo claro, sin mostrar la ruta cruda', async () => {
    const routeError = new Error('Ruta no encontrada');
    routeError.status = 404;
    whatsappAdminApi.permissions.mockRejectedValue(routeError);

    render(<AdminWhatsappSection accessToken="token" onBack={jest.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Bandeja no conectada' })).toBeInTheDocument();
    expect(screen.getByText(/backend de esta preview/i)).toBeInTheDocument();
    expect(screen.queryByText('Ruta no encontrada')).not.toBeInTheDocument();
    await waitFor(() => expect(whatsappAdminApi.permissions).toHaveBeenCalledWith('token'));
  });
});

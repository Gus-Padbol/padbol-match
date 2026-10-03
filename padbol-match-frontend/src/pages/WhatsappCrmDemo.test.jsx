import { render, screen, waitFor } from '@testing-library/react';
import WhatsappCrmDemo from './WhatsappCrmDemo';
import { crmAdminApi } from '../utils/crmAdminApi';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    session: {
      access_token: 'qa-token',
      user: { email: 'superadmin@example.test' },
    },
  }),
}));

jest.mock('../utils/crmAdminApi', () => ({
  crmAdminApi: {
    permissions: jest.fn(),
    inbox: jest.fn(),
    audit: jest.fn(),
    activities: jest.fn(),
    reply: jest.fn(),
    handoff: jest.fn(),
    addActivity: jest.fn(),
  },
}));

describe('CRM histórico unificado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    crmAdminApi.permissions.mockResolvedValue({
      role: 'superadmin',
      canOperate: false,
      canAudit: true,
      whatsappSendEnabled: false,
    });
    crmAdminApi.audit.mockResolvedValue({
      conversations: [{
        id: 'conv-prueba-23',
        estado: 'nuevo',
        source_channel: 'email',
        origin: 'web_form:contacto',
        identity_used: 'prueba@example.test',
        subject: 'Prueba 23',
        inbound_body: 'Nombre: Prueba 23\nAsunto: Consulta de sede',
        created_at: '2026-10-02T12:00:00.000Z',
      }],
    });
  });

  it('muestra la auditoría histórica y mantiene apagadas las salidas', async () => {
    render(<WhatsappCrmDemo />);

    expect((await screen.findAllByText('Prueba 23')).length).toBeGreaterThan(0);
    expect(screen.getByText('CONECTADO A QA')).toBeInTheDocument();
    expect(screen.getByText('DESACTIVADO')).toBeInTheDocument();
    expect(screen.getByText('PENDIENTE META')).toBeInTheDocument();
    expect(crmAdminApi.audit).toHaveBeenCalledWith('qa-token');
    expect(crmAdminApi.inbox).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByText(/Prueba 23/i).length).toBeGreaterThan(0));
  });

  it('acepta la bandeja operativa envuelta en items', async () => {
    crmAdminApi.permissions.mockResolvedValue({
      role: 'operator',
      canOperate: true,
      canAudit: false,
      whatsappSendEnabled: false,
    });
    crmAdminApi.inbox.mockResolvedValue({
      items: [{
        id: 'conv-operador',
        estado: 'nuevo',
        source_channel: 'whatsapp',
        origin: 'whatsapp',
        identity_used: '+5491100000000',
        subject: 'Consulta operativa',
        inbound_body: 'Necesito información',
        created_at: '2026-10-02T13:00:00.000Z',
      }],
    });
    crmAdminApi.activities.mockResolvedValue([]);

    render(<WhatsappCrmDemo />);

    expect(await screen.findAllByText('Consulta operativa')).not.toHaveLength(0);
    expect(crmAdminApi.inbox).toHaveBeenCalledWith('qa-token', { channel: '', estado: '' });
    expect(crmAdminApi.audit).not.toHaveBeenCalled();
  });
});

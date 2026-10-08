import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    sedes: jest.fn(),
    nextGenerationOverview: jest.fn(),
    createNextGenerationRegistration: jest.fn(),
    createNextGenerationVenueApplication: jest.fn(),
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
    crmAdminApi.inbox.mockResolvedValue({
      items: [{
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
    crmAdminApi.sedes.mockResolvedValue([]);
    crmAdminApi.nextGenerationOverview.mockResolvedValue({ sedes: [], jornadas: [] });
    crmAdminApi.createNextGenerationRegistration.mockResolvedValue({ id: 'ng-reg-1', estado: 'borrador' });
    crmAdminApi.createNextGenerationVenueApplication.mockResolvedValue({ venueApplication: { id: 'venue-app-1' }, created: true });
  });

  it('muestra la auditoría histórica y mantiene apagadas las salidas', async () => {
    render(<WhatsappCrmDemo />);

    expect((await screen.findAllByText('Prueba 23')).length).toBeGreaterThan(0);
    expect(screen.getByText('CONECTADO')).toBeInTheDocument();
    expect(screen.getByText('DESACTIVADO')).toBeInTheDocument();
    expect(screen.getByText('PENDIENTE META')).toBeInTheDocument();
    expect(crmAdminApi.inbox).toHaveBeenCalledWith('qa-token', { channel: '', estado: '' });
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

  it('convierte un lead participante en borrador sin confundirlo con lista de espera', async () => {
    crmAdminApi.permissions.mockResolvedValue({ role: 'superadmin', canOperate: true, canAudit: true, whatsappSendEnabled: false });
    crmAdminApi.inbox.mockResolvedValue({ items: [{
      id: 'conv-ng-1', estado: 'nuevo', source_channel: 'email', origin: 'web_form:next-generation',
      identity_used: 'familia@example.test', subject: 'Next Generation participante', created_at: '2026-10-02T12:00:00.000Z',
      contact: { nombre: 'Familia Prueba' },
      qualification_data: { form_submission: { fields: { workflow: 'program_registration', participantType: 'youth_interest', Nombre: 'Juan Prueba' } } },
    }] });
    crmAdminApi.nextGenerationOverview.mockResolvedValue({
      sedes: [{ id: 'venue-1', sede_club: 'Sede Centro' }],
      jornadas: [{ id: 'session-1', sede_id: 'venue-1', nombre_publico: 'Jornada U14', categoria: 'U14' }],
    });
    crmAdminApi.activities.mockResolvedValue([]);

    render(<WhatsappCrmDemo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Preparar inscripción deportiva' }));
    fireEvent.change(screen.getByLabelText('Sede Next Generation'), { target: { value: 'venue-1' } });
    fireEvent.change(screen.getByLabelText('Jornada Next Generation'), { target: { value: 'session-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear como borrador' }));

    await waitFor(() => expect(crmAdminApi.createNextGenerationRegistration).toHaveBeenCalledWith('qa-token', expect.objectContaining({
      conversation_id: 'conv-ng-1', sede_id: 'venue-1', sesion_id: 'session-1', categoria: 'U14',
      participants: [{ nombre: 'Juan Prueba', categoria: 'U14' }],
    })));
    expect(await screen.findByText(/Todavía no ocupa un cupo/)).toBeInTheDocument();
    expect(screen.queryByText(/lista de espera deportiva/i)).not.toBeInTheDocument();
  });

  it('crea una postulación formal de sede desde un lead Next Generation', async () => {
    crmAdminApi.permissions.mockResolvedValue({ role: 'superadmin', canOperate: true, canAudit: true, whatsappSendEnabled: false });
    crmAdminApi.inbox.mockResolvedValue({ items: [{
      id: 'conv-venue-1', estado: 'nuevo', source_channel: 'email', origin: 'web_form:next-generation-venue',
      identity_used: 'club@example.test', subject: 'Next Generation sede', created_at: '2026-10-02T12:00:00.000Z',
      qualification_data: { form_submission: { fields: { workflow: 'next_generation_venue', participantType: 'venue', 'Empresa o club': 'Club Norte', 'Ciudad o región': 'Madrid', País: 'España' } } },
    }] });
    crmAdminApi.activities.mockResolvedValue([]);

    render(<WhatsappCrmDemo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Crear postulación de sede' }));
    expect(screen.getByLabelText('Nombre de sede postulante')).toHaveValue('Club Norte');
    expect(screen.getByLabelText('Ciudad de sede postulante')).toHaveValue('Madrid');
    expect(screen.getByLabelText('País de sede postulante')).toHaveValue('España');
    fireEvent.click(screen.getByRole('button', { name: 'Crear postulación' }));

    await waitFor(() => expect(crmAdminApi.createNextGenerationVenueApplication).toHaveBeenCalledWith('qa-token', {
      conversation_id: 'conv-venue-1', sede_club: 'Club Norte', ciudad: 'Madrid', pais: 'España',
    }));
    expect(await screen.findByText(/Ya puede evaluarse en Next Generation/)).toBeInTheDocument();
  });
});

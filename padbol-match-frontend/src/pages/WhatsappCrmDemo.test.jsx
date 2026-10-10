import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WhatsappCrmDemo, { compactDateTime, formatCrmEventText, leadAnalysisNotice } from './WhatsappCrmDemo';
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
    createManual: jest.fn(),
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
    global.crypto = require('crypto').webcrypto;
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

  it('presenta eventos internos como inscripciones comprensibles sin exponer sus claves', async () => {
    crmAdminApi.inbox.mockResolvedValue([{
      id: 'ng-event', estado: 'nuevo', source_channel: 'nextgen',
      identity_used: 'participante@example.test', subject: 'nextgen.registration.created',
      inbound_body: 'nextgen.registration.created', created_at: '2026-10-05T15:45:00Z',
    }]);
    render(<WhatsappCrmDemo />);
    expect((await screen.findAllByText(/Nueva inscripción a Next Generation/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/nextgen\.registration\.created/)).not.toBeInTheDocument();
    expect(screen.getByText('Centro de atención')).toBeInTheDocument();
    expect(screen.queryByText(/Backend/)).not.toBeInTheDocument();
  });

  it('muestra las 70 conversaciones históricas del contrato directo sin permisos de envío', async () => {
    crmAdminApi.inbox.mockResolvedValue(Array.from({ length: 70 }, (_, index) => ({
      id: `historical-${index}`, estado: 'nuevo', source_channel: 'email',
      origin: 'web_form:contacto', identity_used: `contact-${index}@example.test`,
      subject: `Consulta histórica ${index}`, inbound_body: `Nombre: Contacto ${index}`,
      created_at: '2026-10-02T12:00:00.000Z',
    })));
    crmAdminApi.activities.mockResolvedValue([]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByRole('heading', { name: 'Conversaciones' })).toBeInTheDocument();
    expect(document.querySelector('.wa-inbox-count')).toHaveTextContent('70');
    expect(screen.queryByText('No hay conversaciones.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Respuesta no habilitada' })).toBeDisabled();
    expect(crmAdminApi.reply).not.toHaveBeenCalled();
    expect(crmAdminApi.handoff).not.toHaveBeenCalled();
  });

  it('ofrece respuesta por email solo cuando el servidor habilita el canal para un operador', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: false, emailSendEnabled: true, whatsappSendEnabled: false });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'email-capability', estado: 'nuevo', source_channel: 'email', origin: 'web_form:contacto', contact: { nombre: 'Contacto fixture', email_normalized: 'contact@example.invalid' }, inbound_body: 'Consulta fixture' }]);
    crmAdminApi.activities.mockResolvedValue([]);
    crmAdminApi.reply.mockResolvedValue({ status: 'sent' });
    const { container } = render(<WhatsappCrmDemo />);
    const send = await screen.findByRole('button', { name: 'Enviar por email' });
    expect(send).toBeDisabled();
    expect(container.querySelector('textarea')).toBeEnabled();
    fireEvent.change(container.querySelector('textarea'), { target: { value: 'Respuesta fixture' } });
    fireEvent.click(send);
    expect(await screen.findByText('Mensaje enviado por email.')).toBeInTheDocument();
    expect(crmAdminApi.reply).toHaveBeenCalledWith('qa-token', 'email-capability', 'Respuesta fixture', expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
    expect(screen.getByText('HABILITADO')).toBeInTheDocument();
  });

  it('conserva la identidad del email tras un error ambiguo y la renueva al editar o completar', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: false, emailSendEnabled: true });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'retry-email', estado: 'nuevo', source_channel: 'email', contact: { email_normalized: 'contact@example.invalid' } }]);
    crmAdminApi.activities.mockResolvedValue([]);
    crmAdminApi.reply.mockRejectedValueOnce(new Error('Envío no confirmado')).mockRejectedValueOnce(new Error('Envío no confirmado')).mockResolvedValue({ status: 'sent' });
    const { container } = render(<WhatsappCrmDemo />);
    const send = await screen.findByRole('button', { name: 'Enviar por email' });
    const compose = container.querySelector('textarea');
    fireEvent.change(compose, { target: { value: 'Consulta original' } });
    fireEvent.click(send);
    await screen.findByText('Envío no confirmado');
    await waitFor(() => expect(send).toBeEnabled());
    const firstId = crmAdminApi.reply.mock.calls[0][3];
    fireEvent.click(send);
    await waitFor(() => expect(crmAdminApi.reply).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(send).toBeEnabled());
    expect(crmAdminApi.reply.mock.calls[1][3]).toBe(firstId);
    fireEvent.change(compose, { target: { value: 'Consulta editada' } });
    fireEvent.click(send);
    await screen.findByText('Mensaje enviado por email.');
    const editedId = crmAdminApi.reply.mock.calls[2][3];
    expect(editedId).not.toBe(firstId);
    expect(compose).toHaveValue('');
    fireEvent.change(compose, { target: { value: 'Consulta editada' } });
    fireEvent.click(send);
    await waitFor(() => expect(crmAdminApi.reply).toHaveBeenCalledTimes(4));
    expect(crmAdminApi.reply.mock.calls[3][3]).not.toBe(editedId);
  });

  it('limpia borrador, aviso y referencia al cambiar de contacto sin reutilizar texto privado', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: false, emailSendEnabled: true });
    crmAdminApi.inbox.mockResolvedValue([
      { id: 'contact-a', estado: 'nuevo', source_channel: 'email', contact: { nombre: 'Ada fixture', email_normalized: 'a@example.invalid' } },
      { id: 'contact-b', estado: 'nuevo', source_channel: 'email', contact: { nombre: 'Ben fixture', email_normalized: 'b@example.invalid' } },
    ]);
    crmAdminApi.activities.mockResolvedValue([]);
    crmAdminApi.reply.mockRejectedValue(new Error('Envío no confirmado'));
    const { container } = render(<WhatsappCrmDemo />);
    const send = await screen.findByRole('button', { name: 'Enviar por email' });
    fireEvent.change(container.querySelector('textarea'), { target: { value: 'Texto privado para Ada' } });
    fireEvent.click(send);
    await screen.findByText('Envío no confirmado');
    expect(container.querySelector('textarea')).toHaveValue('Texto privado para Ada');
    fireEvent.click(container.querySelectorAll('.wa-conversation')[1]);
    expect(container.querySelector('textarea')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Enviar por email' })).toBeDisabled();
    expect(screen.queryByText('Envío no confirmado')).not.toBeInTheDocument();
    fireEvent.click(container.querySelectorAll('.wa-conversation')[0]);
    expect(container.querySelector('textarea')).toHaveValue('');
    fireEvent.change(container.querySelector('textarea'), { target: { value: 'Texto privado para Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar por email' }));
    await waitFor(() => expect(crmAdminApi.reply).toHaveBeenCalledTimes(2));
    expect(crmAdminApi.reply.mock.calls[1][3]).not.toBe(crmAdminApi.reply.mock.calls[0][3]);
  });

  it('permite al auditor abrir el alta manual para consultar sin guardar ni llamar a la API', async () => {
    const { container } = render(<WhatsappCrmDemo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar contacto manual' }));
    fireEvent.change(screen.getByLabelText('Nombre del contacto'), { target: { value: 'Contacto fixture' } });
    fireEvent.change(screen.getByLabelText('Correo del contacto'), { target: { value: 'fixture@example.invalid' } });
    expect(screen.getByRole('button', { name: 'Guardar sin enviar mensajes' })).toBeDisabled();
    fireEvent.submit(container.querySelector('form'));
    expect(crmAdminApi.createManual).not.toHaveBeenCalled();
  });

  it('un error de alta manual no anuncia un guardado y conserva los datos del operador', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: false });
    crmAdminApi.createManual.mockRejectedValue(new Error('Alta manual no disponible'));
    const { container } = render(<WhatsappCrmDemo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar contacto manual' }));
    fireEvent.change(screen.getByLabelText('Nombre del contacto'), { target: { value: 'Contacto fixture' } });
    fireEvent.change(screen.getByLabelText('Correo del contacto'), { target: { value: 'fixture@example.invalid' } });
    fireEvent.submit(container.querySelector('form'));
    await screen.findByText('Alta manual no disponible');
    expect(screen.getByLabelText('Nombre del contacto')).toHaveValue('Contacto fixture');
    expect(screen.queryByText('Contacto registrado en la sede, sin enviar comunicaciones.')).not.toBeInTheDocument();
    expect(crmAdminApi.createManual).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('confirma el contacto separado de la bandeja sin proveedor saliente (existing=%s)', async (existing) => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: false, emailSendEnabled: false, whatsappSendEnabled: false });
    crmAdminApi.createManual.mockResolvedValue({ ok: true, existing, contact: { id: 'local-contact-receipt', nombre: 'Registro confirmado', email_normalized: 'fixture@example.invalid', phone_normalized: null } });
    render(<WhatsappCrmDemo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar contacto manual' }));
    expect(screen.getByText('Solo se registran nombre, correo y teléfono. Este alta no crea conversaciones ni guarda notas, origen o sede.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Origen del contacto')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sede canónica')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre del contacto'), { target: { value: 'Nombre solicitado' } });
    fireEvent.change(screen.getByLabelText('Correo del contacto'), { target: { value: 'fixture@example.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin enviar mensajes' }));
    await screen.findByText('Contacto registrado: Registro confirmado');
    expect(screen.getByText('ID del contacto: local-contact-receipt')).toBeInTheDocument();
    expect(screen.getByText(existing ? 'El contacto ya existía; no se modificaron sus datos.' : 'Contacto registrado, sin enviar comunicaciones.')).toBeInTheDocument();
    expect(crmAdminApi.createManual).toHaveBeenCalledWith('qa-token', { name: 'Nombre solicitado', email: 'fixture@example.invalid', phone: '' });
    expect(crmAdminApi.reply).not.toHaveBeenCalled();
  });

  it('una capacidad email habilitada no otorga permisos de operación al auditor', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: false, canAudit: true, emailSendEnabled: true });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'audit-email', estado: 'nuevo', source_channel: 'email', contact: { email_normalized: 'contact@example.invalid' } }]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByRole('button', { name: 'Enviar por email' })).toBeDisabled();
    expect(crmAdminApi.reply).not.toHaveBeenCalled();
  });

  it('no ofrece email si falta la capacidad del servidor o el destinatario registrado', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: false, emailSendEnabled: true });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'no-address', estado: 'nuevo', source_channel: 'email', contact: {} }]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByRole('button', { name: 'Respuesta no habilitada' })).toBeDisabled();
    expect(crmAdminApi.reply).not.toHaveBeenCalled();
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

test('una misma hora local y argentina se muestra una sola vez aunque la zona tenga otro nombre', () => {
  const result = compactDateTime('2026-10-05T15:45:00Z', 'America/Buenos_Aires');
  expect(result).toBe('05/10/2026 · 12:45 h');
  expect(result.match(/05\/10\/2026/g)).toHaveLength(1);
});

test('una zona con otra hora conserva la referencia argentina con nombre legible', () => {
  const result = compactDateTime('2026-10-05T15:45:00Z', 'Europe/Madrid');
  expect(result).toContain('17:45 h');
  expect(result).toContain('Argentina: 05/10/2026 · 12:45 h');
});

test('las consultas escritas por personas se conservan y los nuevos eventos se describen sin códigos', () => {
  expect(formatCrmEventText('Consulta sobre clases')).toBe('Consulta sobre clases');
  expect(formatCrmEventText('nextgen.registration.waitlisted')).toBe('Actualización de Next Generation');
});

test('the CRM keeps an explicit exit to the general panel without sending messages', async () => {
  const onBack = jest.fn();
  const scroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<WhatsappCrmDemo onBack={onBack} />);
  await waitFor(() => expect(screen.queryByText('Cargando bandeja…')).not.toBeInTheDocument());
  const exit = screen.getByRole('button', { name: 'Volver al panel general' });
  expect(exit.closest('.wa-panel-exit')).toBeInTheDocument();
  fireEvent.click(exit);
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(scroll).toHaveBeenCalledWith(0, 0);
  scroll.mockRestore();
});


describe('estado honesto del análisis automático', () => {
  test.each([['pending', false, 'Análisis automático desactivado'], ['disabled', true, 'Análisis automático desactivado'], ['pending', true, 'Análisis solicitado, sin resultado confirmado'], ['pending', undefined, 'Análisis solicitado, sin resultado confirmado'], ['failed', true, 'No se pudo completar el análisis'], [null, true, 'Sin análisis solicitado']])('estado %s con capacidad %s', (status, enabled, title) => {
    const notice = leadAnalysisNotice(status, enabled);
    expect(notice.title).toBe(title);
    expect(notice.title).not.toMatch(/Analizando/);
    expect(notice.badge).not.toBe('EN PROCESO');
  });
  test('lead histórico pending y servidor desactivado muestra revisión manual sin progreso falso', async () => {
    jest.clearAllMocks();
    crmAdminApi.sedes.mockResolvedValue([]);
    crmAdminApi.activities.mockResolvedValue([]);
    crmAdminApi.nextGenerationOverview.mockResolvedValue({ sedes: [], jornadas: [] });
    crmAdminApi.permissions.mockResolvedValue({ canAudit: true, canOperate: false, leadAnalysisEnabled: false });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'analysis-fixture', source_channel: 'email', subject: 'Fixture análisis', qualification_data: { lead_analysis_request: { status: 'pending' } } }]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByText('Análisis automático desactivado')).toBeInTheDocument();
    expect(screen.getByText(/consulta permanece disponible para revisión manual/)).toBeInTheDocument();
    expect(screen.queryByText('EN PROCESO')).not.toBeInTheDocument();
    expect(crmAdminApi.reply).not.toHaveBeenCalled();
  });
});

test('un resultado histórico confirmado se conserva aunque hoy el análisis esté desactivado', async () => {
  jest.clearAllMocks();
  crmAdminApi.permissions.mockResolvedValue({ canAudit: true, canOperate: false, leadAnalysisEnabled: false });
  crmAdminApi.sedes.mockResolvedValue([]); crmAdminApi.activities.mockResolvedValue([]);
  crmAdminApi.nextGenerationOverview.mockResolvedValue({ sedes: [], jornadas: [] });
  crmAdminApi.inbox.mockResolvedValue([{ id: 'saved-analysis', source_channel: 'email', subject: 'Fixture resultado', qualification_data: { lead_analysis: { score: 50, priority: 'B', summary: 'Resultado histórico simulado' }, lead_analysis_request: { status: 'pending' } } }]);
  render(<WhatsappCrmDemo />);
  expect(await screen.findByText('Resultado histórico simulado')).toBeInTheDocument();
  expect(screen.queryByText('Análisis automático desactivado')).not.toBeInTheDocument();
});

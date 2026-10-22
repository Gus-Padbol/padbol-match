import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WhatsappCrmDemo, { compactDateTime, conversationDisplayDate, formatCrmEventText, leadAnalysisNotice, crmOriginLabel } from './WhatsappCrmDemo';
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
    setTestVisibility: jest.fn(),
    audit: jest.fn(),
    activities: jest.fn(),
    whatsappMediaList: jest.fn(),
    whatsappHistory: jest.fn(),
    reviewWhatsappDelivery: jest.fn(),
    resumeWhatsappAutomation: jest.fn(),
    whatsappMedia: jest.fn(),
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
        updated_at: '2026-10-02T12:00:01.000Z', test_visibility_version: 0,
      }],
    });
    crmAdminApi.whatsappMediaList.mockResolvedValue({ attachments: [] });
    crmAdminApi.whatsappHistory.mockResolvedValue({ messages: [] });
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
    expect(screen.getByLabelText('Respuesta')).toBeDisabled();
    expect(screen.getByRole('region', { name: 'Listado de conversaciones' })).toHaveAttribute('tabindex', '0');
    expect(screen.queryByText('web_form:contacto')).not.toBeInTheDocument();
    expect(screen.getByText('NO HABILITADO')).toBeInTheDocument();
    expect(crmAdminApi.inbox).toHaveBeenCalledWith('qa-token', { channel: '', estado: '' });
    await waitFor(() => expect(screen.getAllByText(/Prueba 23/i).length).toBeGreaterThan(0));
  });

  it('busca el ticket completo en el servidor y lo muestra en lista y ficha', async () => {
    const reference = 'PB-0123456789ABCDEF0123456789ABCDEF';
    crmAdminApi.inbox.mockImplementation(async (_token, filters) => filters.ticketReference
      ? { items: [{ id: 'older', ticket_reference: reference, estado: 'cerrado', source_channel: 'email', subject: 'Caso anterior' }] }
      : { items: [] });
    render(<WhatsappCrmDemo />);
    fireEvent.change(await screen.findByLabelText('Buscar por número de ticket'), { target: { value: reference.toLowerCase() } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect((await screen.findAllByText(/Caso anterior/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(reference))).toHaveLength(2);
    expect(crmAdminApi.inbox).toHaveBeenCalledWith('qa-token', { channel: '', estado: '', ticketReference: reference });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todos' }));
    expect(await screen.findByText('No hay conversaciones.')).toBeInTheDocument();
  });

  it('busca y muestra el ticket corto para una conversación cerrada', async () => {
    const shortReference = 'PB-100001';
    crmAdminApi.inbox.mockImplementation(async (_token, filters) => filters.ticketReference
      ? { items: [{ id: 'older', ticket_reference: 'PB-0123456789ABCDEF0123456789ABCDEF', short_ticket_reference: shortReference, estado: 'cerrado', source_channel: 'email', subject: 'Caso anterior' }] }
      : { items: [] });
    render(<WhatsappCrmDemo />);
    fireEvent.change(await screen.findByLabelText('Buscar por número de ticket'), { target: { value: 'pb-100001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect((await screen.findAllByText(new RegExp(shortReference))).length).toBe(2);
    expect(crmAdminApi.inbox).toHaveBeenCalledWith('qa-token', { channel: '', estado: '', ticketReference: shortReference });
    expect(screen.queryByText(/PB-0123456789ABCDEF0123456789ABCDEF/)).not.toBeInTheDocument();
  });

  it('rechaza una referencia incompleta sin ejecutar una búsqueda ambigua', async () => {
    render(<WhatsappCrmDemo />);
    fireEvent.change(await screen.findByLabelText('Buscar por número de ticket'), { target: { value: 'PB-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('referencia completa');
    expect(crmAdminApi.inbox).not.toHaveBeenCalledWith('qa-token', expect.objectContaining({ ticketReference: expect.anything() }));
  });

  it('permite ocultar solo con confirmación y restaurar pruebas', async () => {
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => false);
    crmAdminApi.setTestVisibility.mockResolvedValue({changed:true});
    render(<WhatsappCrmDemo />);
    fireEvent.click(await screen.findByText('Administración'));
    fireEvent.click(await screen.findByRole('button', {name:'Ocultar prueba'}));
    expect(crmAdminApi.setTestVisibility).not.toHaveBeenCalled();
    window.confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', {name:'Ocultar prueba'}));
    await waitFor(() => expect(crmAdminApi.setTestVisibility).toHaveBeenCalledWith('qa-token', 'conv-prueba-23', true, 0));
    fireEvent.click(await screen.findByRole('button', {name:'Ver pruebas ocultas'}));
    await waitFor(() => expect(crmAdminApi.inbox).toHaveBeenCalledWith('qa-token', expect.objectContaining({hiddenOnly:true})));
    fireEvent.click(await screen.findByText('Administración'));
    fireEvent.click(await screen.findByRole('button', {name:'Restaurar conversación'}));
    await waitFor(() => expect(crmAdminApi.setTestVisibility).toHaveBeenCalledWith('qa-token', 'conv-prueba-23', false, 0));
    window.confirm = originalConfirm;
  });

  it('muestra en lista y ficha la fecha del último WhatsApp recibido', async () => {
    crmAdminApi.inbox.mockResolvedValue({items:[{ id:'wa-date', estado:'nuevo', source_channel:'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear', origin:'whatsapp:1376102838911694', identity_used:'Remitente de prueba', inbound_body:'Hola', created_at:'2026-09-23T12:00:00Z', received_at:'2026-10-21T12:00:00Z' }]});
    render(<WhatsappCrmDemo />);
    expect(await screen.findByText(/MENSAJE RECIBIDO · 21\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name:/Remitente de prueba/}).querySelector('time')).toHaveAttribute('datetime','2026-10-21T12:00:00Z');
  });

  it('muestra mensajes entrantes y respuesta enviada con su estado', async () => {
    crmAdminApi.inbox.mockResolvedValue([{id:'history-wa',source_channel:'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear',identity_used:'15555550123',inbound_body:'Último',estado:'nuevo'}]);
    crmAdminApi.whatsappHistory.mockResolvedValue({truncated:true,messages:[{id:'in-1',direction:'inbound',body:'Primer mensaje',at:'2026-10-21T10:00:00Z'},{id:'out-1',direction:'outbound',body:'Respuesta enviada',at:'2026-10-21T10:01:00Z',status:'sent'}]});
    render(<WhatsappCrmDemo />);
    expect(await screen.findByText('Primer mensaje')).toBeInTheDocument();
    expect(screen.getByText('Respuesta enviada')).toBeInTheDocument();
    expect(screen.getByText(/Enviado/)).toBeInTheDocument();
    expect(screen.getByText(/hay mensajes anteriores/)).toBeInTheDocument();
  });

  it('muestra el contexto de WhatsApp y los textos originales sin cambiar asignaciones', async () => {
    crmAdminApi.inbox.mockResolvedValue([{ id:'wa-context', source_channel:'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear', identity_used:'15555550123', estado:'en_atencion', operador:'Equipo humano', sede_id:'sede-1', qualification_data:{ whatsapp_menu:{ topic:'sede', subtopic:'Comprar una cancha', initialMessage:'Hola, quiero\nuna cancha.', detailMessage:'Para Miami.' } } }]);
    crmAdminApi.activities.mockResolvedValue([]);
    render(<WhatsappCrmDemo />);
    const context = await screen.findByRole('region', { name:'Contexto de WhatsApp' });
    expect(context).toHaveTextContent('Abrir una sede / comprar una cancha');
    expect(context).toHaveTextContent('Comprar una cancha');
    expect(context).toHaveTextContent('Hola, quiero una cancha.');
    expect(context.querySelector('.wa-context-original').textContent).toBe('Hola, quiero\nuna cancha.');
    expect(screen.getByText('Equipo humano')).toBeInTheDocument();
    expect(crmAdminApi.handoff).not.toHaveBeenCalled();
    expect(crmAdminApi.addActivity).not.toHaveBeenCalled();
  });

  it.each([
    { whatsapp_order_review:{required:true,reason:'ambiguous_message_order'} },
    { whatsapp_menu:{topic:'sede',needs_review:true,initialMessage:'Texto original'} },
  ])('advierte cuando el orden requiere revisión y no afirma el tema anterior', async (data) => {
    const menu = { topic:'sede', subtopic:'Comprar una cancha', initialMessage:'Texto original', ...data.whatsapp_menu };
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-uncertain',source_channel:'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear',identity_used:'15555550123',estado:'derivado',operador:'Persona asignada',qualification_data:{...data,whatsapp_menu:menu}}]);
    crmAdminApi.whatsappHistory.mockResolvedValue({messages:[{id:'in-1',direction:'inbound',body:'Texto original',at:'2026-10-21T10:00:00Z'}]});
    render(<WhatsappCrmDemo />);
    expect(await screen.findByText('Revisión humana necesaria')).toBeInTheDocument();
    expect(screen.getByText(/El orden de algunos mensajes no está confirmado/)).toBeInTheDocument();
    expect(screen.queryByText('Abrir una sede / comprar una cancha')).not.toBeInTheDocument();
    expect(screen.queryByText('Comprar una cancha')).not.toBeInTheDocument();
    expect((await screen.findAllByText('Texto original')).length).toBeGreaterThan(0);
    expect(screen.getByText('Persona asignada')).toBeInTheDocument();
    expect(crmAdminApi.handoff).not.toHaveBeenCalled();
    expect(crmAdminApi.addActivity).not.toHaveBeenCalled();
  });

  it('muestra atención humana en inglés pendiente en lista y detalle sin afectar respuesta', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate:true, whatsappSendEnabled:true });
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-en',source_channel:'whatsapp',estado:'nuevo',identity_used:'English fixture',qualification_status:'needs_review',next_step:'advisor_handoff',whatsapp_delivery_review:'clear',whatsapp_message_order_review:'clear',qualification_data:{whatsapp_menu:{humanLanguage:'en',stage:'selected'}}}]);
    render(<WhatsappCrmDemo />);
    expect((await screen.findAllByText('Atención humana en inglés pendiente'))).toHaveLength(2);
    expect(screen.getByLabelText('Respuesta')).toBeEnabled();
    expect(screen.queryByText(/ya se asignó/i)).not.toBeInTheDocument();
  });

  it.each([
    {source_channel:'email',qualification_status:'needs_review',next_step:'advisor_handoff'},
    {source_channel:'whatsapp',qualification_status:'pending',next_step:'advisor_handoff'},
    {source_channel:'whatsapp',qualification_status:'needs_review',next_step:'other'},
    {source_channel:'whatsapp',qualification_status:'needs_review',next_step:'advisor_handoff',estado:'cerrado'},
  ])('no muestra falso aviso de atención inglesa en ficha ajena o finalizada', async (partial) => {
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-other',estado:'nuevo',whatsapp_delivery_review:'clear',whatsapp_message_order_review:'clear',qualification_data:{whatsapp_menu:{humanLanguage:'en'}},...partial}]);
    render(<WhatsappCrmDemo />);
    await screen.findByLabelText('Listado de conversaciones');
    expect(screen.queryByText('Atención humana en inglés pendiente')).not.toBeInTheDocument();
  });

  it('requiere confirmación explícita antes de solicitar reanudación y no envía mensajes', async () => {
    crmAdminApi.permissions.mockResolvedValue({canOperate:true,whatsappAutomationResumeEnabled:true});
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-resume',source_channel:'whatsapp',estado:'nuevo',whatsapp_delivery_review:'clear',whatsapp_message_order_review:'clear'}]);
    crmAdminApi.resumeWhatsappAutomation.mockResolvedValue({ok:true});
    const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<WhatsappCrmDemo />);
    fireEvent.click(await screen.findByText('Administración'));
    const button = await screen.findByRole('button',{name:'Reanudar respuestas automáticas'});
    fireEvent.click(button);
    expect(crmAdminApi.resumeWhatsappAutomation).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(crmAdminApi.resumeWhatsappAutomation).toHaveBeenCalledWith('qa-token','wa-resume'));
    expect(crmAdminApi.reply).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('muestra error del servidor al no poder reanudar', async () => {
    crmAdminApi.permissions.mockResolvedValue({canOperate:true,whatsappAutomationResumeEnabled:true});
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-resume-error',source_channel:'whatsapp',estado:'nuevo',whatsapp_delivery_review:'clear'}]);
    crmAdminApi.resumeWhatsappAutomation.mockRejectedValueOnce(new Error('Hay atención humana en curso'));
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WhatsappCrmDemo />);
    fireEvent.click(await screen.findByText('Administración'));
    fireEvent.click(await screen.findByRole('button',{name:'Reanudar respuestas automáticas'}));
    expect(await screen.findByText('Hay atención humana en curso')).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('bloquea reanudación con entrega incierta', async () => {
    crmAdminApi.permissions.mockResolvedValue({canOperate:true,whatsappAutomationResumeEnabled:true});
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-resume',source_channel:'whatsapp',estado:'nuevo',whatsapp_delivery_review:'required'}]);
    render(<WhatsappCrmDemo />);
    fireEvent.click(await screen.findByText('Administración'));
    expect(await screen.findByRole('button',{name:'Reanudar respuestas automáticas'})).toBeDisabled();
    expect(crmAdminApi.resumeWhatsappAutomation).not.toHaveBeenCalled();
  });

  it('no ofrece reanudación sin capacidad habilitada', async () => {
    crmAdminApi.permissions.mockResolvedValue({canOperate:true});
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-old',source_channel:'whatsapp',estado:'nuevo'}]);
    render(<WhatsappCrmDemo />);
    await screen.findByLabelText('Listado de conversaciones');
    expect(screen.queryByRole('button',{name:'Reanudar respuestas automáticas'})).not.toBeInTheDocument();
  });

  it('advierte entrega automática incierta y bloquea otro envío hasta revisión', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate:true, whatsappSendEnabled:true });
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-uncertain-delivery',source_channel:'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear',estado:'nuevo',identity_used:'15555550123',qualification_data:{whatsapp_order_review:{required:true,reason:'uncertain_automated_delivery'}}}]);
    crmAdminApi.whatsappHistory.mockResolvedValue({messages:[]});
    render(<WhatsappCrmDemo />);
    expect(await screen.findByText(/No se pudo confirmar si llegó una respuesta automática/)).toBeInTheDocument();
    expect(screen.queryByText(/El orden de algunos mensajes no está confirmado/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Respuesta')).toBeDisabled();
    expect(screen.getByRole('button', {name:'Enviar por WhatsApp'})).toBeDisabled();
    expect(crmAdminApi.reply).not.toHaveBeenCalled();
  });

  it('bloquea un envío automático en curso informado por el servidor', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate:true, whatsappSendEnabled:true });
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-inflight',source_channel:'whatsapp',whatsapp_delivery_review:'required',estado:'nuevo'}]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByText(/No se pudo confirmar si llegó una respuesta automática/)).toBeInTheDocument();
    expect(screen.getByLabelText('Respuesta')).toBeDisabled();
  });

  it('bloquea el envío si no se puede comprobar el estado automático', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate:true, whatsappSendEnabled:true });
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-unknown',source_channel:'whatsapp',whatsapp_delivery_review:'unknown',estado:'nuevo'}]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByText(/No se pudo comprobar el estado de las respuestas automáticas/)).toBeInTheDocument();
    expect(screen.getByLabelText('Respuesta')).toBeDisabled();
  });

  it('mantiene disponible la respuesta ante un servidor anterior sin estados de revisión', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate:true, whatsappSendEnabled:true });
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-legacy',source_channel:'whatsapp',estado:'nuevo'}]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByLabelText('Respuesta')).toBeEnabled();
    expect(screen.queryByText(/No se pudo comprobar el estado de las respuestas automáticas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No se pudo comprobar el orden de los mensajes/)).not.toBeInTheDocument();
  });

  it('solo el superadmin registra una revisión con evidencia y confirmación', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canAudit:true, canOperate:true, whatsappSendEnabled:true });
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-review',source_channel:'whatsapp',whatsapp_delivery_review:'required',estado:'nuevo'}]);
    crmAdminApi.reviewWhatsappDelivery.mockResolvedValue({ok:true});
    render(<WhatsappCrmDemo />);
    const submit = await screen.findByRole('button', { name:'Registrar revisión' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Resultado comprobado'), {target:{value:'delivered'}});
    fireEvent.change(screen.getByLabelText('Evidencia comprobada'), {target:{value:'Confirmado con recibo de Meta'}});
    fireEvent.click(screen.getByLabelText('Revisé la evidencia y confirmo este resultado.'));
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Identificador de Meta'), {target:{value:'wamid.test'}});
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Revisé la evidencia y confirmo este resultado.'));
    fireEvent.click(submit);
    await waitFor(() => expect(crmAdminApi.reviewWhatsappDelivery).toHaveBeenCalledWith('qa-token','wa-review',{outcome:'delivered',evidence:'Confirmado con recibo de Meta',providerId:'wamid.test'}));
    expect(crmAdminApi.reply).not.toHaveBeenCalled();
  });

  it.each(['required', 'unknown'])('avisa orden %s sin bloquear respuesta humana ni ofrecer conciliación', async (order) => {
    crmAdminApi.permissions.mockResolvedValue({ canAudit:true, canOperate:true, whatsappSendEnabled:true });
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-order',source_channel:'whatsapp',whatsapp_delivery_review:'clear',whatsapp_message_order_review:order,estado:'nuevo'}]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByText(order === 'required' ? /El orden de algunos mensajes no está confirmado/ : /No se pudo comprobar el orden de los mensajes/)).toBeInTheDocument();
    expect(screen.getByLabelText('Respuesta')).toBeEnabled();
    expect(screen.queryByRole('form',{name:'Revisar entrega automática'})).not.toBeInTheDocument();
  });

  it('tras revisar no entregado consulta el servidor y solo desbloquea si informa clear', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canAudit:true, canOperate:true, whatsappSendEnabled:true });
    crmAdminApi.inbox.mockResolvedValueOnce([{id:'wa-reviewed',source_channel:'whatsapp',whatsapp_delivery_review:'required',whatsapp_message_order_review:'clear',estado:'nuevo'}]).mockResolvedValue([{id:'wa-reviewed',source_channel:'whatsapp',whatsapp_delivery_review:'clear',whatsapp_message_order_review:'clear',estado:'nuevo'}]);
    crmAdminApi.reviewWhatsappDelivery.mockResolvedValue({ok:true});
    render(<WhatsappCrmDemo />);
    fireEvent.change(await screen.findByLabelText('Resultado comprobado'), {target:{value:'not_delivered'}});
    fireEvent.change(screen.getByLabelText('Evidencia comprobada'), {target:{value:'Registro de Meta revisado'}});
    fireEvent.click(screen.getByLabelText('Revisé la evidencia y confirmo este resultado.'));
    fireEvent.click(screen.getByRole('button',{name:'Registrar revisión'}));
    await waitFor(() => expect(crmAdminApi.reviewWhatsappDelivery).toHaveBeenCalledWith('qa-token','wa-reviewed',{outcome:'not_delivered',evidence:'Registro de Meta revisado'}));
    await waitFor(() => expect(screen.getByLabelText('Respuesta')).toBeEnabled());
    expect(crmAdminApi.reply).not.toHaveBeenCalled();
  });

  it('un operador sin auditoría no puede registrar conciliación', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canAudit:false, canOperate:true, whatsappSendEnabled:true });
    crmAdminApi.inbox.mockResolvedValue([{id:'wa-review',source_channel:'whatsapp',whatsapp_delivery_review:'required',estado:'nuevo'}]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByText(/No se pudo confirmar si llegó una respuesta automática/)).toBeInTheDocument();
    expect(screen.queryByRole('form',{name:'Revisar entrega automática'})).not.toBeInTheDocument();
  });

  it('permite WhatsApp solo con capacidad del servidor y permiso de operador, y muestra el rechazo real', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: false, whatsappSendEnabled: true, emailSendEnabled: false });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'wa-qa', estado: 'nuevo', source_channel: 'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear', identity_used: '15555550123', inbound_body: 'Prueba QA' }]);
    crmAdminApi.activities.mockResolvedValue([]);
    crmAdminApi.reply.mockRejectedValue(new Error('Meta no aceptó la respuesta de WhatsApp (código 131042).'));
    render(<WhatsappCrmDemo />);
    const send = await screen.findByRole('button', { name: 'Enviar por WhatsApp' });
    expect(screen.queryByText('PENDIENTE META')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Respuesta'), { target: { value: 'Respuesta de prueba' } });
    expect(send).toBeEnabled();
    fireEvent.click(send);
    expect(await screen.findByText('Meta no aceptó la respuesta de WhatsApp (código 131042).')).toBeInTheDocument();
    expect(crmAdminApi.reply).toHaveBeenCalledTimes(1);
    expect(crmAdminApi.reply.mock.calls[0][3]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('conserva la referencia WhatsApp al reintentar un resultado incierto', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: false, whatsappSendEnabled: true });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'wa-retry', estado: 'nuevo', source_channel: 'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear', identity_used: '15555550123', inbound_body: 'Prueba QA' }]);
    crmAdminApi.activities.mockResolvedValue([]);
    crmAdminApi.reply.mockRejectedValue(new Error('Envío no confirmado'));
    render(<WhatsappCrmDemo />);
    const send = await screen.findByRole('button', { name: 'Enviar por WhatsApp' });
    fireEvent.change(screen.getByLabelText('Respuesta'), { target: { value: 'Respuesta de prueba' } });
    fireEvent.click(send);
    expect(await screen.findByText('Envío no confirmado')).toBeInTheDocument();
    fireEvent.click(send);
    await waitFor(() => expect(crmAdminApi.reply).toHaveBeenCalledTimes(2));
    expect(crmAdminApi.reply.mock.calls[1][3]).toBe(crmAdminApi.reply.mock.calls[0][3]);
  });

  it('muestra imágenes autorizadas y libera su URL al cerrar la conversación', async () => {
    const create = jest.fn(() => 'blob:imagen');
    const revoke = jest.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    crmAdminApi.inbox.mockResolvedValue([{ id: 'wa-image', source_channel: 'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear', identity_used: '15555550123', inbound_body: 'Imagen' }]);
    crmAdminApi.activities.mockResolvedValue([]);
    crmAdminApi.whatsappMediaList.mockResolvedValue({ attachments: [{ eventId: 'image-1', mediaType: 'image' }, { eventId: 'audio-1', mediaType: 'audio' }] });
    crmAdminApi.whatsappMedia.mockResolvedValue({ blob: { slice: () => ({ arrayBuffer: async () => Uint8Array.from([255, 216, 255, 0]).buffer }) }, filename: 'foto.jpg' });
    const view = render(<WhatsappCrmDemo />);
    expect(await screen.findByRole('img', { name: 'Imagen recibida 1' })).toHaveAttribute('src', 'blob:imagen');
    expect(crmAdminApi.whatsappMedia).toHaveBeenCalledTimes(1);
    expect(crmAdminApi.whatsappMedia).toHaveBeenCalledWith('qa-token', 'wa-image', 'image-1');
    view.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:imagen');
  });

  it('permite solicitar un adjunto del evento autorizado y muestra fallos', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: false });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'wa-attachment', source_channel: 'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear', identity_used: '15555550123', inbound_body: 'Imagen' }]);
    crmAdminApi.activities.mockResolvedValue([]);
    crmAdminApi.whatsappMediaList.mockResolvedValue({ attachments: [{ eventId: 'event-1', mediaType: 'image' }] });
    crmAdminApi.whatsappMedia.mockRejectedValue(new Error('unavailable'));
    render(<WhatsappCrmDemo />);
    fireEvent.click(await screen.findByRole('button', { name: '↓ Descargar imagen' }));
    expect(await screen.findByText('No se pudo descargar el archivo. Inténtalo nuevamente.')).toBeInTheDocument();
    expect(crmAdminApi.whatsappMedia).toHaveBeenCalledWith('qa-token', 'wa-attachment', 'event-1');
  });

  it('habilita al operador limitado solo para el número WhatsApp autorizado', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: false, canAudit: true, canOperateWhatsapp: true, whatsappSendEnabled: true });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'wa-approved', source_channel: 'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear', origin: 'whatsapp:1376102838911694', identity_used: '15555550123', inbound_body: 'Hola' }, { id: 'wa-other', source_channel: 'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear', origin: 'whatsapp:other', identity_used: '15555550124', inbound_body: 'Otro' }]);
    crmAdminApi.activities.mockResolvedValue([]);
    render(<WhatsappCrmDemo />);
    fireEvent.change(await screen.findByLabelText('Respuesta'), { target: { value: 'Hola' } });
    expect(screen.getByRole('button', { name: 'Enviar por WhatsApp' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /15555550124/ }));
    expect(screen.getByLabelText('Respuesta')).toBeDisabled();
  });

  it('mantiene WhatsApp sin envío para auditor aun cuando el servidor ofrece el canal', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: false, canAudit: true, whatsappSendEnabled: true });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'wa-audit', estado: 'nuevo', source_channel: 'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear', identity_used: '15555550123', inbound_body: 'Prueba QA' }]);
    crmAdminApi.activities.mockResolvedValue([]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByRole('button', { name: 'Enviar por WhatsApp' })).toBeDisabled();
    expect(screen.getByLabelText('Respuesta')).toBeDisabled();
    expect(crmAdminApi.reply).not.toHaveBeenCalled();
  });

  it('entrada comercial conserva informes y seguimiento sin áreas de WhatsApp, soporte o alta manual', async () => {
    crmAdminApi.permissions.mockResolvedValue({ role: 'commercial_operator', canOperate: true, canAudit: false, commercialOnly: true, allowedAreas: ['commercial'], canCreateManual: false, emailSendEnabled: true, whatsappSendEnabled: false });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'commercial', source_channel: 'email', origin: 'web_form:Consulta Padbol · Quiero una cancha Padbol', contact: { nombre: 'Lead comercial', email_normalized: 'lead@example.invalid' }, qualification_data: { routing: { workflow: 'commercial_lead' } }, inbound_body: 'Proyecto comercial' }]);
    crmAdminApi.activities.mockResolvedValue([]);
    render(<WhatsappCrmDemo requiredScope="commercial" />);
    expect((await screen.findAllByText('Lead comercial')).length).toBeGreaterThan(0);
    expect(screen.getByText('Consultas comerciales')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Soporte y reclamos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next Generation/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar contacto manual' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar por email' })).toBeInTheDocument();
    expect(screen.getByText('Registrar seguimiento')).toBeInTheDocument();
    expect(crmAdminApi.nextGenerationOverview).not.toHaveBeenCalled();
    expect(crmAdminApi.audit).not.toHaveBeenCalled();
    expect(crmAdminApi.sedes).not.toHaveBeenCalled();
  });

  it('guarda estado real y próximo paso al registrar seguimiento comercial y recarga la bandeja', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, commercialOnly: true, canAudit: false });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'lead-state', estado: 'nuevo', source_channel: 'email', contact: { nombre: 'Lead estado' } }]);
    crmAdminApi.activities.mockResolvedValue([]);
    crmAdminApi.addActivity.mockResolvedValue({id: 'saved'});
    render(<WhatsappCrmDemo requiredScope="commercial" />);
    await screen.findByText('Registrar seguimiento');
    const topic = screen.getByLabelText('Motivo');
    fireEvent.change(topic, {target:{value: topic.options[1].value}});
    const states = screen.getAllByRole('combobox', {name: /^Estado/});
    fireEvent.change(states[states.length - 1], {target:{value:'cerrado'}});
    const next = screen.getByRole('combobox', {name: /^Próximo paso/});
    fireEvent.change(next, {target:{value:next.options[1].value}});
    fireEvent.click(screen.getByRole('button',{name:'Guardar seguimiento'}));
    await waitFor(() => expect(crmAdminApi.addActivity).toHaveBeenCalledWith('qa-token','lead-state',expect.objectContaining({conversation_state:'cerrado', next_step:next.options[1].value})));
    await waitFor(() => expect(crmAdminApi.inbox.mock.calls.length).toBeGreaterThan(1));
  });

  it('entrada comercial exige capacidad del servidor incluso para una sesión superadmin', async () => {
    render(<WhatsappCrmDemo requiredScope="commercial" />);
    expect(await screen.findByText('No tienes acceso a esta sección.')).toBeInTheDocument();
    expect(crmAdminApi.inbox).not.toHaveBeenCalled();
    expect(crmAdminApi.nextGenerationOverview).not.toHaveBeenCalled();
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

  it('clasifica support en Soporte y permite responder al operador autorizado con el canal de soporte habilitado', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: false, canAudit: true, canOperateSupport: true, emailSendEnabled: false, supportEmailSendEnabled: true });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'support-1', estado: 'nuevo', source_channel: 'email', origin: 'support_email', qualification_data: { mailbox: { address: 'support@padbol.com' } }, subject: 'Prueba 1', contact: { nombre: 'Contacto fixture', email_normalized: 'contact@example.invalid' }, inbound_body: 'Consulta fixture' }]);
    crmAdminApi.activities.mockResolvedValue([]);
    crmAdminApi.reply.mockResolvedValue({ status: 'sent' });
    render(<WhatsappCrmDemo />);
    const send = await screen.findByRole('button', { name: 'Enviar por email' });
    expect(screen.getByText('support@padbol.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Soporte y reclamos/ }));
    expect(screen.getAllByText('Prueba 1').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Respuesta'), { target: { value: 'Respuesta fixture' } });
    fireEvent.click(send);
    expect(await screen.findByText('Mensaje enviado por email.')).toBeInTheDocument();
    expect(crmAdminApi.reply).toHaveBeenCalledWith('qa-token', 'support-1', 'Respuesta fixture', expect.any(String));
  });

  it('no habilita soporte con el canal comercial o con datos de buzón incompletos', async () => {
    crmAdminApi.permissions.mockResolvedValue({ canOperate: true, canAudit: true, emailSendEnabled: true, supportEmailSendEnabled: false });
    crmAdminApi.inbox.mockResolvedValue([{ id: 'support-incomplete', source_channel: 'email', origin: 'support_email', contact: { email_normalized: 'contact@example.invalid' } }]);
    render(<WhatsappCrmDemo />);
    expect(await screen.findByRole('button', { name: 'Respuesta no habilitada' })).toBeDisabled();
    expect(screen.getByLabelText('Respuesta')).toBeDisabled();
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
        source_channel: 'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear',
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

  it('muestra datos reales de participantes sin usar campos ni análisis comerciales', async () => {
    crmAdminApi.inbox.mockResolvedValue({items:[{id:'ng-display',estado:'nuevo',source_channel:'email',origin:'web_form:next-generation',subject:'Next Generation participante',inbound_body:'Quiero participar',contact:{nombre:'Familia'},qualification_data:{form_submission:{fields:{workflow:'program_registration',participantType:'youth_interest',Nombre:'Lucía',Categoría:'U14',País:'Uruguay'}},lead_analysis:{score:75,verdict:'Venta de canchas'}}}]});
    render(<WhatsappCrmDemo/>);
    expect(await screen.findByText('Datos de Next Generation')).toBeInTheDocument();
    expect(screen.getByText('U14')).toBeInTheDocument();
    expect(screen.queryByText('Cantidad de canchas')).not.toBeInTheDocument();
    expect(screen.queryByText('Venta de canchas')).not.toBeInTheDocument();
    expect(screen.getByText('Análisis pendiente de validación para Next Generation')).toBeInTheDocument();
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

test('la fecha de WhatsApp usa el último mensaje y mantiene alternativas para otros canales', () => {
  const row = { source_channel: 'whatsapp', whatsapp_delivery_review:'clear', whatsapp_message_order_review:'clear', created_at: '2026-09-23T12:00:00Z', received_at: '2026-10-21T12:00:00Z' };
  expect(conversationDisplayDate(row)).toBe(row.received_at);
  expect(conversationDisplayDate({ ...row, received_at: null })).toBe(row.created_at);
  expect(conversationDisplayDate({ ...row, source_channel: 'email' })).toBe(row.created_at);
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
  expect(formatCrmEventText('[WhatsApp: imagen recibido.] Mensaje de prueba desde 🇺🇸')).toBe('Mensaje de prueba desde 🇺🇸');
  expect(formatCrmEventText('[WhatsApp: imagen recibido.]')).toBe('Imagen recibida');
  expect(formatCrmEventText('[WhatsApp: imagen recibido. Archivo aún no disponible.]\nFoto de cancha')).toBe('Foto de cancha');
  expect(formatCrmEventText('[WhatsApp: audio recibido. Archivo aún no disponible.]')).toBe('Audio recibido');
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


test('origins are human readable without revealing transport keys', () => {
  expect(crmOriginLabel({origin:'web_form:Next Generation · Sede',source_channel:'email'})).toBe('Formulario Next Generation · Sedes');
  expect(crmOriginLabel({origin:'web_form:contacto',source_channel:'email'})).toBe('Formulario web');
  expect(crmOriginLabel({origin:'internal:opaque-key',source_channel:'email'})).toBe('Email');
  expect(crmOriginLabel({origin:'manual_contact',source_channel:'email'})).toBe('Registro manual');
});

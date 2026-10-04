import { resolveWhatsappPermissions } from './whatsappAssistant.js';
import { createHash, randomUUID } from 'node:crypto';
import { normalizeEmail, normalizePhone } from './crmContact.js';

function crmError(message, status = 403, code = 'CRM_ADMIN_FORBIDDEN') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

const ACTIVITY_TYPES = new Set(['note', 'phone_call', 'zoom_meeting', 'in_person_meeting']);
const MANUAL_ORIGINS = new Set(['in_person', 'phone', 'whatsapp', 'email', 'other']);

function optionalText(value, max = 2000) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function optionalDate(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw crmError('Fecha de seguimiento inválida.', 400, 'CRM_ACTIVITY_INVALID');
  }
  return date.toISOString();
}

export function createCrmAdminService({
  repository,
  operators = new Set(),
  superAdminEmails = new Set(),
  resolvePermissions = resolveWhatsappPermissions,
  sendWhatsappReply = null,
} = {}) {
  if (!repository) throw crmError('El repositorio CRM no está configurado.', 503, 'CRM_ADMIN_UNAVAILABLE');

  function permissionsFor(email, role) {
    const permissions = resolvePermissions({ email, role, operators, superAdminEmails });
    const venueAdmin = ['admin_club', 'empleado'].includes(String(role || '').toLowerCase());
    return { ...permissions, venueAdmin, canOperate: permissions.canOperate || venueAdmin };
  }

  function requireOperator(email, role) {
    const permissions = permissionsFor(email, role);
    if (!permissions.canOperate) throw crmError('Solo el operador autorizado puede atender o derivar.');
    return permissions;
  }

  function requireAudit(email, role) {
    const permissions = permissionsFor(email, role);
    if (!permissions.canAudit) throw crmError('Solo el superadmin puede auditar.');
    return permissions;
  }

  function requireRead(email, role, sedeId) {
    const permissions = permissionsFor(email, role);
    if (!permissions.canOperate && !permissions.canAudit) {
      throw crmError('No tienes acceso a la bandeja CRM.');
    }
    if (permissions.venueAdmin && !Number.isFinite(Number(sedeId))) {
      throw crmError('La cuenta no tiene una sede canónica asignada.', 403, 'CRM_SEDE_REQUIRED');
    }
    return permissions;
  }

  function scopedSede({ email, role, sedeId }, requestedSedeId = null) {
    const permissions = requireRead(email, role, sedeId);
    if (permissions.venueAdmin) return Number(sedeId);
    const requested = requestedSedeId == null || requestedSedeId === '' ? null : Number(requestedSedeId);
    if (requested != null && (!Number.isInteger(requested) || requested <= 0)) {
      throw crmError('Sede inválida.', 400, 'CRM_SEDE_INVALID');
    }
    return requested;
  }

  function assertRowScope(context, permissions, conversation) {
    if (permissions.venueAdmin && Number(conversation?.sede_id) !== Number(context.sedeId)) {
      throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
    }
  }

  return {
    getPermissions({ email, role, sedeId }) {
      const permissions = permissionsFor(email, role);
      return {
        role: permissions.role,
        canOperate: permissions.canOperate,
        canAudit: permissions.canAudit,
        whatsappSendEnabled: typeof sendWhatsappReply === 'function',
        sede_id: permissions.venueAdmin ? Number(sedeId) || null : null,
      };
    },

    async listInbox(context) {
      const permissions = requireRead(context.email, context.role, context.sedeId);
      const filters = { ...(context.filters || {}) };
      if (permissions.venueAdmin) filters.sedeId = Number(context.sedeId);
      return repository.listConversations(filters);
    },

    async getInbox(context) {
      const permissions = requireRead(context.email, context.role, context.sedeId);
      const { id } = context;
      const conversation = await repository.getConversation(id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
      assertRowScope(context, permissions, conversation);
      return conversation;
    },

    async reply(context) {
      const { email, role, sedeId, id, body } = context;
      const permissions = requireOperator(email, role);
      const text = String(body ?? '').trim();
      if (!text) throw crmError('La respuesta no puede estar vacía.', 400, 'CRM_REPLY_INVALID');
      const conversation = await repository.getConversation(id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
      assertRowScope({ email, role, sedeId }, permissions, conversation);
      if (conversation.source_channel !== 'whatsapp') {
        throw crmError(
          'Esta consulta llegó por formulario web. La respuesta por email todavía no está habilitada.',
          409,
          'CRM_REPLY_CHANNEL_DISABLED',
        );
      }
      const reply = await repository.createReply({
        conversationId: conversation.id,
        body: text,
        operador: email,
        status: 'pending',
      });
      if (typeof sendWhatsappReply !== 'function') {
        return { ok: true, status: 'pending', replyId: reply.id };
      }
      try {
        const sent = await sendWhatsappReply({ conversation, body: text, operador: email });
        await repository.updateReplyStatus(reply.id, 'sent', sent?.providerMessageId || null);
        return {
          ok: true,
          status: 'sent',
          replyId: reply.id,
          providerMessageId: sent?.providerMessageId || null,
        };
      } catch (error) {
        await repository.updateReplyStatus(reply.id, 'cancelled', null);
        throw error;
      }
    },

    async handoff(context) {
      const { email, role, sedeId, id } = context;
      const permissions = requireOperator(email, role);
      const conversation = await repository.getConversation(id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
      assertRowScope({ email, role, sedeId }, permissions, conversation);
      if (conversation.handoff_ready !== true || conversation.qualification_status !== 'qualified') {
        throw crmError('El contacto todavía no completó la calificación guiada.', 409, 'CRM_HANDOFF_NOT_READY');
      }
      await repository.markHandoff({ conversationId: conversation.id, operador: email });
      return { ok: true, disposition: 'handoff' };
    },

    async listActivities(context) {
      const permissions = requireRead(context.email, context.role, context.sedeId);
      const { id } = context;
      const conversation = await repository.getConversation(id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
      assertRowScope(context, permissions, conversation);
      return repository.listActivities(conversation.id);
    },

    async assignSede(context) {
      requireAudit(context.email, context.role);
      const sedeId = scopedSede(context, context.requestedSedeId);
      if (!sedeId || !(await repository.sedeExists(sedeId))) {
        throw crmError('La sede canónica no existe.', 400, 'CRM_SEDE_INVALID');
      }
      const conversation = await repository.getConversation(context.id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
      return repository.assignSede(context.id, sedeId, context.email);
    },

    async createManual(context) {
      const permissions = requireRead(context.email, context.role, context.sedeId);
      const sedeId = scopedSede(context, context.requestedSedeId);
      if (!sedeId || !(await repository.sedeExists(sedeId))) {
        throw crmError('La sede canónica no existe.', 400, 'CRM_SEDE_INVALID');
      }
      if (!permissions.venueAdmin && !permissions.canAudit && !permissions.canOperate) {
        throw crmError('No autorizado.');
      }
      const origin = String(context.origin || '').trim().toLowerCase();
      if (!MANUAL_ORIGINS.has(origin)) throw crmError('Origen manual inválido.', 400, 'CRM_ORIGIN_INVALID');
      const email = normalizeEmail(context.emailAddress);
      const phone = normalizePhone(context.phone);
      const name = optionalText(context.name, 160);
      if (!email && !phone) throw crmError('Ingresá un correo o teléfono válido.', 400, 'CRM_CONTACT_INVALID');
      const sourceRef = `manual:${sedeId}:${randomUUID()}`;
      return repository.createManualConversation({
        sedeId, email, phone, name, origin: `manual:${origin}`,
        sourceChannel: origin === 'whatsapp' ? 'whatsapp' : 'email',
        sourceRef, attemptId: createHash('sha256').update(sourceRef).digest('hex'),
        subject: optionalText(context.subject, 512) || 'Contacto cargado manualmente',
        body: optionalText(context.body, 4000), author: context.email,
      });
    },

    async createActivity(context) {
      const { email, role, sedeId, id, activityType, summary, outcome, nextStep, followUpAt } = context;
      const permissions = requireOperator(email, role);
      const type = String(activityType ?? '').trim();
      const text = optionalText(summary);
      if (!ACTIVITY_TYPES.has(type) || !text) {
        throw crmError('Tipo y resumen de seguimiento son obligatorios.', 400, 'CRM_ACTIVITY_INVALID');
      }
      const conversation = await repository.getConversation(id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
      assertRowScope({ email, role, sedeId }, permissions, conversation);
      return repository.createActivity({
        contact_id: conversation.contact_id,
        conversation_id: conversation.id,
        activity_type: type,
        summary: text,
        outcome: optionalText(outcome),
        next_step: optionalText(nextStep),
        follow_up_at: optionalDate(followUpAt),
        author: String(email).trim().toLowerCase(),
      });
    },

    async audit({ email, role }) {
      requireAudit(email, role);
      return repository.listAuditActivity();
    },
  };
}

export function createSupabaseCrmAdminRepository(supabaseAdmin) {
  if (!supabaseAdmin?.from) return null;

  async function query(builder, message = 'No se pudo operar el CRM.') {
    const { data, error } = await builder;
    if (error) throw crmError(message, 503, 'CRM_ADMIN_UNAVAILABLE');
    return data;
  }

  return {
    async listConversations(filters = {}) {
      let builder = supabaseAdmin
        .from('crm_conversations')
        .select('*, contact:crm_contacts(id, nombre, email_normalized, phone_normalized, review_needed)')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (filters.sourceChannel) builder = builder.eq('source_channel', filters.sourceChannel);
      if (filters.estado) builder = builder.eq('estado', filters.estado);
      if (filters.sedeId != null) builder = builder.eq('sede_id', Number(filters.sedeId));
      return query(builder, 'No se pudo cargar la bandeja CRM.');
    },

    async getConversation(id) {
      const { data, error } = await supabaseAdmin
        .from('crm_conversations')
        .select('*, contact:crm_contacts(id, nombre, email_normalized, phone_normalized, review_needed)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw crmError('No se pudo cargar la conversación.', 503, 'CRM_ADMIN_UNAVAILABLE');
      return data || null;
    },

    async sedeExists(id) {
      const { data, error } = await supabaseAdmin.from('sedes').select('id').eq('id', Number(id)).maybeSingle();
      if (error) throw crmError('No se pudo validar la sede.', 503, 'CRM_ADMIN_UNAVAILABLE');
      return Boolean(data);
    },

    async assignSede(id, sedeId, author) {
      const { data, error } = await supabaseAdmin.from('crm_conversations').update({
        sede_id: Number(sedeId), assigned_by: String(author).trim().toLowerCase(),
        assigned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', id).select('*').single();
      if (error) throw crmError('No se pudo asignar la sede.', 503, 'CRM_ADMIN_UNAVAILABLE');
      return data;
    },

    async createManualConversation(payload) {
      let contact = null;
      if (payload.email) {
        const result = await supabaseAdmin.from('crm_contacts').select('*').eq('email_normalized', payload.email).maybeSingle();
        contact = result.data || null;
      }
      if (!contact && payload.phone) {
        const result = await supabaseAdmin.from('crm_contacts').select('*').eq('phone_normalized', payload.phone).maybeSingle();
        contact = result.data || null;
      }
      if (!contact) {
        const result = await supabaseAdmin.from('crm_contacts').insert({
          email_normalized: payload.email, phone_normalized: payload.phone, nombre: payload.name,
        }).select('*').single();
        if (result.error) throw crmError('No se pudo crear el contacto.', 503, 'CRM_ADMIN_UNAVAILABLE');
        contact = result.data;
      }
      const now = new Date().toISOString();
      const result = await supabaseAdmin.from('crm_conversations').insert({
        contact_id: contact.id, source_channel: payload.sourceChannel, source_ref: payload.sourceRef,
        attempt_id: payload.attemptId, identity_used: payload.email || payload.phone,
        origin: payload.origin, subject: payload.subject, inbound_body: payload.body,
        received_at: now, sede_id: payload.sedeId, assigned_by: payload.author,
        assigned_at: now, estado: 'nuevo',
      }).select('*, contact:crm_contacts(id, nombre, email_normalized, phone_normalized, review_needed)').single();
      if (result.error) throw crmError('No se pudo registrar el contacto manual.', 503, 'CRM_ADMIN_UNAVAILABLE');
      return result.data;
    },

    async createReply({ conversationId, body, operador, status }) {
      const { data, error } = await supabaseAdmin
        .from('crm_replies')
        .insert({ conversation_id: conversationId, body, operador, status })
        .select('*')
        .single();
      if (error) throw crmError('No se pudo registrar la respuesta.', 503, 'CRM_ADMIN_UNAVAILABLE');
      return data;
    },

    async updateReplyStatus(id, status, providerMessageId = null) {
      const payload = { status };
      if (providerMessageId) payload.provider_message_id = providerMessageId;
      const { error } = await supabaseAdmin.from('crm_replies').update(payload).eq('id', id);
      if (error) throw crmError('No se pudo actualizar la respuesta.', 503, 'CRM_ADMIN_UNAVAILABLE');
    },

    async listActivities(conversationId) {
      return query(
        supabaseAdmin
          .from('crm_activities')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(200),
        'No se pudo cargar el seguimiento.',
      );
    },

    async createActivity(payload) {
      const { data, error } = await supabaseAdmin.from('crm_activities').insert(payload).select('*').single();
      if (error) throw crmError('No se pudo registrar el seguimiento.', 503, 'CRM_ADMIN_UNAVAILABLE');
      return data;
    },

    async markHandoff({ conversationId, operador }) {
      const { error } = await supabaseAdmin
        .from('crm_conversations')
        .update({ estado: 'derivado', derivado: true, operador, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      if (error) throw crmError('No se pudo derivar.', 503, 'CRM_ADMIN_UNAVAILABLE');
    },

    async listAuditActivity() {
      const [contacts, conversations, attempts, replies, activities] = await Promise.all([
        query(supabaseAdmin.from('crm_contacts').select('id, email_normalized, phone_normalized, nombre, review_needed, created_at')),
        query(supabaseAdmin.from('crm_conversations').select('*').order('created_at', { ascending: false }).limit(200)),
        query(supabaseAdmin.from('crm_channel_attempts').select('*')),
        query(supabaseAdmin.from('crm_replies').select('*').order('created_at', { ascending: false }).limit(200)),
        query(supabaseAdmin.from('crm_activities').select('*').order('created_at', { ascending: false }).limit(500)),
      ]);
      return { contacts, conversations, attempts, replies, activities };
    },
  };
}

export function registerCrmAdminRoutes(app, {
  crmAdminService,
  authUserFromBearer,
  fetchUserRoleRow,
  fetchUserRoleRowForAuthUser,
  logger = console,
} = {}) {
  if (!crmAdminService) return;

  async function adminContext(req) {
    const user = await authUserFromBearer(req);
    if (!user?.email) throw crmError('No autorizado.', 401, 'CRM_ADMIN_UNAUTHENTICATED');
    const row = typeof fetchUserRoleRowForAuthUser === 'function'
      ? await fetchUserRoleRowForAuthUser(user)
      : await fetchUserRoleRow(user.email);
    const sedeId = row?.sede_id == null || row.sede_id === '' ? null : Number(row.sede_id);
    return { email: user.email, role: row?.role ?? null, sedeId: Number.isFinite(sedeId) ? sedeId : null };
  }

  function handle(res, error) {
    const status = Number(error?.status) || 503;
    logger?.error?.('[crm-admin] request failed', { code: error?.code || 'CRM_ADMIN_UNAVAILABLE' });
    return res.status(status).json({
      error: error?.message || 'No disponible.',
      code: error?.code || 'CRM_ADMIN_UNAVAILABLE',
    });
  }

  app.get('/api/admin/crm/permissions', async (req, res) => {
    try { return res.json(crmAdminService.getPermissions(await adminContext(req))); }
    catch (error) { return handle(res, error); }
  });
  app.get('/api/admin/crm/inbox', async (req, res) => {
    try {
      const context = await adminContext(req);
      const items = await crmAdminService.listInbox({
        ...context,
        filters: { sourceChannel: req.query.channel, estado: req.query.estado },
      });
      return res.json({ items });
    } catch (error) { return handle(res, error); }
  });
  app.get('/api/admin/crm/inbox/:id', async (req, res) => {
    try { return res.json(await crmAdminService.getInbox({ ...(await adminContext(req)), id: req.params.id })); }
    catch (error) { return handle(res, error); }
  });
  app.post('/api/admin/crm/inbox/:id/reply', async (req, res) => {
    try {
      return res.json(await crmAdminService.reply({
        ...(await adminContext(req)), id: req.params.id, body: req.body?.body,
      }));
    } catch (error) { return handle(res, error); }
  });
  app.post('/api/admin/crm/inbox/:id/handoff', async (req, res) => {
    try { return res.json(await crmAdminService.handoff({ ...(await adminContext(req)), id: req.params.id })); }
    catch (error) { return handle(res, error); }
  });
  app.get('/api/admin/crm/inbox/:id/activities', async (req, res) => {
    try { return res.json(await crmAdminService.listActivities({ ...(await adminContext(req)), id: req.params.id })); }
    catch (error) { return handle(res, error); }
  });
  app.post('/api/admin/crm/inbox/:id/activities', async (req, res) => {
    try {
      return res.status(201).json(await crmAdminService.createActivity({
        ...(await adminContext(req)),
        id: req.params.id,
        activityType: req.body?.type,
        summary: req.body?.summary,
        outcome: req.body?.outcome,
        nextStep: req.body?.next_step,
        followUpAt: req.body?.follow_up_at,
      }));
    } catch (error) { return handle(res, error); }
  });
  app.patch('/api/admin/crm/inbox/:id/sede', async (req, res) => {
    try {
      return res.json(await crmAdminService.assignSede({
        ...(await adminContext(req)), id: req.params.id, requestedSedeId: req.body?.sede_id,
      }));
    } catch (error) { return handle(res, error); }
  });
  app.post('/api/admin/crm/manual', async (req, res) => {
    try {
      return res.status(201).json(await crmAdminService.createManual({
        ...(await adminContext(req)), requestedSedeId: req.body?.sede_id,
        origin: req.body?.origin, name: req.body?.name, emailAddress: req.body?.email,
        phone: req.body?.phone, subject: req.body?.subject, body: req.body?.body,
      }));
    } catch (error) { return handle(res, error); }
  });
  app.get('/api/admin/crm/audit', async (req, res) => {
    try { return res.json(await crmAdminService.audit(await adminContext(req))); }
    catch (error) { return handle(res, error); }
  });
}

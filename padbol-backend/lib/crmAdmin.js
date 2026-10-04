import { resolveWhatsappPermissions } from './whatsappAssistant.js';

function crmError(message, status = 403, code = 'CRM_ADMIN_FORBIDDEN') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

const ACTIVITY_TYPES = new Set(['note', 'phone_call', 'zoom_meeting', 'in_person_meeting']);

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
    return resolvePermissions({ email, role, operators, superAdminEmails });
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

  function requireRead(email, role) {
    const permissions = permissionsFor(email, role);
    if (!permissions.canOperate && !permissions.canAudit) {
      throw crmError('No tienes acceso a la bandeja CRM.');
    }
    return permissions;
  }

  return {
    getPermissions({ email, role }) {
      const permissions = permissionsFor(email, role);
      return {
        role: permissions.role,
        canOperate: permissions.canOperate,
        canAudit: permissions.canAudit,
        whatsappSendEnabled: typeof sendWhatsappReply === 'function',
      };
    },

    async listInbox({ email, role, filters = {} }) {
      requireRead(email, role);
      return repository.listConversations(filters);
    },

    async getInbox({ email, role, id }) {
      requireRead(email, role);
      const conversation = await repository.getConversation(id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
      return conversation;
    },

    async reply({ email, role, id, body }) {
      requireOperator(email, role);
      const text = String(body ?? '').trim();
      if (!text) throw crmError('La respuesta no puede estar vacía.', 400, 'CRM_REPLY_INVALID');
      const conversation = await repository.getConversation(id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
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

    async handoff({ email, role, id }) {
      requireOperator(email, role);
      const conversation = await repository.getConversation(id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
      if (conversation.handoff_ready !== true || conversation.qualification_status !== 'qualified') {
        throw crmError('El contacto todavía no completó la calificación guiada.', 409, 'CRM_HANDOFF_NOT_READY');
      }
      await repository.markHandoff({ conversationId: conversation.id, operador: email });
      return { ok: true, disposition: 'handoff' };
    },

    async listActivities({ email, role, id }) {
      requireRead(email, role);
      const conversation = await repository.getConversation(id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
      return repository.listActivities(conversation.id);
    },

    async createActivity({ email, role, id, activityType, summary, outcome, nextStep, followUpAt }) {
      requireOperator(email, role);
      const type = String(activityType ?? '').trim();
      const text = optionalText(summary);
      if (!ACTIVITY_TYPES.has(type) || !text) {
        throw crmError('Tipo y resumen de seguimiento son obligatorios.', 400, 'CRM_ACTIVITY_INVALID');
      }
      const conversation = await repository.getConversation(id);
      if (!conversation) throw crmError('Conversación no encontrada.', 404, 'CRM_NOT_FOUND');
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
    return { email: user.email, role: row?.role ?? null };
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
  app.get('/api/admin/crm/audit', async (req, res) => {
    try { return res.json(await crmAdminService.audit(await adminContext(req))); }
    catch (error) { return handle(res, error); }
  });
}

import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { createCrmAdminService, registerCrmAdminRoutes } from './crmAdmin.js';

function memoryRepository() {
  const contacts = [{ id: 'contact-23', nombre: 'Prueba 23' }];
  const conversations = [{
    id: 'conversation-23',
    contact_id: 'contact-23',
    source_channel: 'whatsapp',
    estado: 'nuevo',
    handoff_ready: true,
    qualification_status: 'qualified',
    subject: 'Prueba 23',
    sede_id: 1,
  }, {
    id: 'conversation-venue-2', contact_id: 'contact-23', source_channel: 'email', estado: 'nuevo',
    handoff_ready: false, qualification_status: 'pending', subject: 'Otra sede', sede_id: 2,
  }];
  const replies = [];
  const activities = [];
  return {
    contacts,
    conversations,
    replies,
    activities,
    async listConversations(filters = {}) {
      return conversations.filter((row) => (
        (!filters.sourceChannel || row.source_channel === filters.sourceChannel)
        && (!filters.estado || row.estado === filters.estado)
        && (filters.sedeId == null || Number(row.sede_id) === Number(filters.sedeId))
      ));
    },
    async getConversation(id) { return conversations.find((row) => row.id === id) || null; },
    async createReply(payload) {
      const row = { id: `reply-${replies.length + 1}`, ...payload };
      replies.push(row);
      return row;
    },
    async updateReplyStatus(id, status, providerMessageId) {
      const row = replies.find((item) => item.id === id);
      if (row) Object.assign(row, { status, provider_message_id: providerMessageId || null });
    },
    async listActivities(conversationId) {
      return activities.filter((row) => row.conversation_id === conversationId);
    },
    async createActivity(payload) {
      const row = { id: `activity-${activities.length + 1}`, ...payload };
      activities.push(row);
      return row;
    },
    async markHandoff({ conversationId, operador }) {
      const row = conversations.find((item) => item.id === conversationId);
      Object.assign(row, { estado: 'derivado', derivado: true, operador });
    },
    async sedeExists(id) { return [1, 2].includes(Number(id)); },
    async assignSede(id, sedeId, author) {
      const row = conversations.find((item) => item.id === id);
      Object.assign(row, { sede_id: Number(sedeId), assigned_by: author });
      return row;
    },
    async createManualConversation(payload) {
      const row = { id: `manual-${conversations.length}`, contact_id: 'contact-23', estado: 'nuevo',
        sede_id: payload.sedeId, origin: payload.origin, subject: payload.subject };
      conversations.push(row); return row;
    },
    async listAuditActivity() {
      return { contacts, conversations, attempts: [], replies, activities };
    },
  };
}

async function withServer(run) {
  const repository = memoryRepository();
  const service = createCrmAdminService({
    repository,
    operators: new Set(['operator@example.test']),
    superAdminEmails: new Set(['superadmin@example.test']),
    sendWhatsappReply: null,
  });
  const app = express();
  app.use(express.json());
  registerCrmAdminRoutes(app, {
    crmAdminService: service,
    authUserFromBearer: async (req) => {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (token === 'super-token') return { id: 'super-id', email: 'superadmin@example.test' };
      if (token === 'operator-token') return { id: 'operator-id', email: 'operator@example.test' };
      if (token === 'venue-1-token') return { id: 'venue-1-id', email: 'venue1@example.test' };
      if (token === 'venue-2-token') return { id: 'venue-2-id', email: 'venue2@example.test' };
      return null;
    },
    fetchUserRoleRowForAuthUser: async (user) => user.id === 'super-id'
      ? { role: 'super_admin', sede_id: null }
      : user.id === 'venue-1-id' ? { role: 'admin_club', sede_id: 1 }
        : user.id === 'venue-2-id' ? { role: 'admin_club', sede_id: 2 }
          : { role: null, sede_id: null },
    logger: { error() {} },
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    const address = server.address();
    await run({ repository, baseUrl: `http://127.0.0.1:${address.port}` });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

test('contrato HTTP CRM registra auditoría y acciones reales con salidas externas apagadas', async () => {
  await withServer(async ({ repository, baseUrl }) => {
    const auditResponse = await fetch(`${baseUrl}/api/admin/crm/audit`, { headers: auth('super-token') });
    assert.equal(auditResponse.status, 200);
    const audit = await auditResponse.json();
    assert.equal(audit.conversations[0].subject, 'Prueba 23');

    const superInboxResponse = await fetch(`${baseUrl}/api/admin/crm/inbox`, {
      headers: auth('super-token'),
    });
    assert.equal(superInboxResponse.status, 200);
    assert.equal((await superInboxResponse.json()).items[0].subject, 'Prueba 23');

    const superActivitiesResponse = await fetch(`${baseUrl}/api/admin/crm/inbox/conversation-23/activities`, {
      headers: auth('super-token'),
    });
    assert.equal(superActivitiesResponse.status, 200);

    const permissionsResponse = await fetch(`${baseUrl}/api/admin/crm/permissions`, {
      headers: auth('operator-token'),
    });
    assert.equal(permissionsResponse.status, 200);
    assert.deepEqual(await permissionsResponse.json(), {
      role: 'operator',
      canOperate: true,
      canAudit: false,
      whatsappSendEnabled: false,
      sede_id: null,
    });

    const activityResponse = await fetch(`${baseUrl}/api/admin/crm/inbox/conversation-23/activities`, {
      method: 'POST',
      headers: auth('operator-token'),
      body: JSON.stringify({ type: 'note', summary: 'Seguimiento E2E', next_step: 'Llamar mañana' }),
    });
    assert.equal(activityResponse.status, 201);
    const activity = await activityResponse.json();
    assert.equal(activity.author, 'operator@example.test');
    assert.equal(repository.activities.length, 1);

    const replyResponse = await fetch(`${baseUrl}/api/admin/crm/inbox/conversation-23/reply`, {
      method: 'POST',
      headers: auth('operator-token'),
      body: JSON.stringify({ body: 'Respuesta retenida en QA' }),
    });
    assert.equal(replyResponse.status, 200);
    assert.equal((await replyResponse.json()).status, 'pending');
    assert.equal(repository.replies[0].status, 'pending');

    const handoffResponse = await fetch(`${baseUrl}/api/admin/crm/inbox/conversation-23/handoff`, {
      method: 'POST',
      headers: auth('operator-token'),
      body: '{}',
    });
    assert.equal(handoffResponse.status, 200);
    assert.equal(repository.conversations[0].estado, 'derivado');
  });
});

test('el contrato HTTP CRM falla cerrado para sesión ausente', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/admin/crm/audit`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'CRM_ADMIN_UNAUTHENTICATED');
  });
});

test('multi-sede: cada admin ve y modifica sólo su sede; Super Admin asigna por ID canónico', async () => {
  await withServer(async ({ baseUrl }) => {
    const venue1 = await fetch(`${baseUrl}/api/admin/crm/inbox`, { headers: auth('venue-1-token') });
    assert.equal(venue1.status, 200);
    assert.deepEqual((await venue1.json()).items.map((row) => row.id), ['conversation-23']);

    const venue2 = await fetch(`${baseUrl}/api/admin/crm/inbox`, { headers: auth('venue-2-token') });
    assert.equal(venue2.status, 200);
    assert.deepEqual((await venue2.json()).items.map((row) => row.id), ['conversation-venue-2']);

    const crossTenant = await fetch(`${baseUrl}/api/admin/crm/inbox/conversation-venue-2`, {
      headers: auth('venue-1-token'),
    });
    assert.equal(crossTenant.status, 404);

    const manual = await fetch(`${baseUrl}/api/admin/crm/manual`, {
      method: 'POST', headers: auth('venue-1-token'),
      body: JSON.stringify({ sede_id: 2, origin: 'phone', name: 'Contacto manual', phone: '+54 221 555 0101' }),
    });
    assert.equal(manual.status, 201);
    const manualRow = await manual.json();
    assert.equal(manualRow.sede_id, 1);
    assert.equal(manualRow.origin, 'manual:phone');

    const assigned = await fetch(`${baseUrl}/api/admin/crm/inbox/conversation-venue-2/sede`, {
      method: 'PATCH', headers: auth('super-token'), body: JSON.stringify({ sede_id: 1 }),
    });
    assert.equal(assigned.status, 200);
    assert.equal((await assigned.json()).sede_id, 1);

    const forbiddenAssignment = await fetch(`${baseUrl}/api/admin/crm/inbox/conversation-23/sede`, {
      method: 'PATCH', headers: auth('venue-1-token'), body: JSON.stringify({ sede_id: 2 }),
    });
    assert.equal(forbiddenAssignment.status, 403);
  });
});

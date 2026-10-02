import assert from 'node:assert/strict';
import pg from 'pg';
import {
  CRM_DELEGATION_ENABLED,
  CRM_DISPATCH_ALLOWED,
  createWhatsappCrmService,
} from '../lib/whatsappCrm.js';

const connectionString = String(process.env.DATABASE_URL || '').trim();
const projectRef = String(process.env.QA_SUPABASE_PROJECT_REF || '').trim();

if (!connectionString || !projectRef) {
  throw new Error('DATABASE_URL y QA_SUPABASE_PROJECT_REF son obligatorios.');
}
if (!connectionString.includes(projectRef)) {
  throw new Error('La conexión no pertenece al proyecto QA declarado.');
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

const counts = async () => {
  const { rows } = await pool.query(`select
    (select count(*)::int from public.whatsapp_crm_contacts) contacts,
    (select count(*)::int from public.whatsapp_crm_contact_origins) origins,
    (select count(*)::int from public.whatsapp_crm_timeline) timeline`);
  return rows[0];
};

let contactId = null;
try {
  assert.equal(CRM_DELEGATION_ENABLED, false);
  assert.equal(CRM_DISPATCH_ALLOWED, false);

  const baseline = await counts();
  const roleResult = await pool.query(`select user_id from public.user_roles
    where role = 'super_admin' and user_id is not null order by user_id limit 1`);
  const superAdminId = roleResult.rows[0]?.user_id;
  assert.ok(superAdminId, 'QA necesita al menos un super_admin con user_id.');

  const stamp = String(Date.now()).slice(-7);
  const phone = `549221${stamp}`;
  const sourceRef = `qa:crm-backend:${Date.now()}`;
  const inserted = await pool.query(`select contact_id from public.whatsapp_crm_upsert_contact(
    $1, 'QA Backend CRM', 'AR', null, 'manual', $2, $3::uuid, now(), now())`,
  [phone, sourceRef, superAdminId]);
  contactId = inserted.rows[0]?.contact_id;
  assert.ok(contactId);

  const service = createWhatsappCrmService({ pgPool: pool });
  const inbox = await service.listContacts(superAdminId, { query: 'QA Backend CRM' });
  assert.equal(inbox.dispatchAllowed, false);
  assert.equal(inbox.contacts.length, 1);
  assert.equal(inbox.contacts[0].id, contactId);

  const detail = await service.readContact(superAdminId, contactId);
  assert.equal(detail.dispatchAllowed, false);
  assert.equal(detail.contact.id, contactId);

  const noted = await service.applyAction(superAdminId, contactId, 'nota', {
    text: 'Verificación backend QA sin envíos.',
  });
  assert.match(noted.contact.notes, /sin envíos/);
  assert.ok(noted.timeline.some((event) => event.kind === 'nota'));

  const consent = await service.applyAction(superAdminId, contactId, 'consentimiento', {
    status: 'granted', version: 'qa-backend-v1', source: 'qa:backend',
  });
  assert.equal(consent.contact.consentStatus, 'granted');
  assert.equal(consent.dispatchAllowed, false);

  await assert.rejects(
    service.listContacts('11111111-1111-4111-8111-111111111111'),
    (error) => error?.status === 403 && error?.code === 'CRM_FORBIDDEN',
  );

  console.log(JSON.stringify({
    ok: true,
    projectRef,
    routesContract: ['list', 'detail', 'timeline', 'actions'],
    dispatchAllowed: false,
    authorization: ['super_admin:allowed', 'unknown-role:forbidden'],
  }));

  await pool.query('delete from public.whatsapp_crm_contacts where id = $1::uuid', [contactId]);
  contactId = null;
  assert.deepEqual(await counts(), baseline, 'La verificación debe restaurar los conteos de QA.');
} finally {
  if (contactId) {
    await pool.query('delete from public.whatsapp_crm_contacts where id = $1::uuid', [contactId]).catch(() => {});
  }
  await pool.end();
}

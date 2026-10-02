/**
 * ════════════════════════════════════════════════════════════════════════════════════════
 * H3 · LA DELEGACIÓN NO PUEDE FALLAR ABIERTA (regresión)
 * ════════════════════════════════════════════════════════════════════════════════════════
 *
 * DECISIÓN DEL USUARIO (ya tomada, no se elige acá): **la delegación se mantiene APAGADA**.
 * No se habilita la delegación real. Lo que esta prueba exige es que **no pueda quedar
 * habilitada sin una política válida**: el flag por sí solo NO alcanza.
 *
 * ── EL FALLO ABIERTO QUE FIJA ESTA PRUEBA ───────────────────────────────────────────────
 * Había DOS implementaciones del alcance:
 *   · `lib/whatsappCrmDelegacion.js` → `buildDelegationScope()`: exige el flag **y** una
 *     política completa y válida; sin ella deniega (falla cerrado).
 *   · `lib/whatsappCrm.js` → `resolveCrmScope()`: chequeaba **sólo el flag** (+ rol + sede).
 * Y el SERVICIO usaba la segunda. Consecuencia: con `delegationEnabled: true` inyectado, un
 * `admin_club` operaba su sede **sin las 4 decisiones P1–P4**, o sea que el camino real del
 * producto era más permisivo que el componente que decía gobernarlo.
 *
 * ── LA CORRECCIÓN ESPERADA (estructural, no un parche de la prueba) ─────────────────────
 * El camino del flag pasa a **delegar en el componente**: `resolveCrmScope` exige y valida la
 * política a través de `buildDelegationScope`. Con el flag encendido y sin política válida, el
 * acceso delegado se **deniega**. El valor por defecto sigue apagado.
 *
 * ── POLITICA_PRUEBA_* · DATOS FICTICIOS ─────────────────────────────────────────────────
 * Las tres políticas de abajo son **datos de prueba inventados** para ejercitar el fail-closed.
 * **No son una decisión comercial** ni eligen P1–P4: sólo existen dentro de este archivo para
 * probar que el mecanismo acepta una política completa y rechaza las incompletas o inválidas.
 * Nadie debe tomarlas como la política del producto.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CRM_DELEGATION_ENABLED, createWhatsappCrmService, resolveCrmScope,
} from './whatsappCrm.js';
import { DELEGATION_CODES } from './whatsappCrmDelegacion.js';

// ── POLITICA_PRUEBA_* · FICTICIAS, sólo para esta prueba ─────────────────────────────────
/** Completa: las 4 decisiones presentes (ficticias). */
const POLITICA_PRUEBA_COMPLETA = Object.freeze({
  ownerOnly: false, regionScoped: false,
  roles: ['admin_club', 'operador_whatsapp'], writeAllowed: false,
});
/** Incompleta: falta P2, P3 y P4. */
const POLITICA_PRUEBA_INCOMPLETA = Object.freeze({ ownerOnly: false });
/** Inválida: tipos y lista mal. */
const POLITICA_PRUEBA_INVALIDA = Object.freeze({
  ownerOnly: 'sí', regionScoped: false, roles: [], writeAllowed: 1,
});

const userId = '11111111-1111-4111-8111-111111111111';
const contactId = '22222222-2222-4222-8222-222222222222';
const contacto = {
  id: contactId, identity_key: 'tel:542215550101', phone_normalized: '542215550101',
  phone_original: '+54 9 221 555 0101', display_name: 'Ficticia Demo', country: 'AR',
  sede_id: 1, market: '', interest: '', first_contact_at: null, last_contact_at: null,
  owner_user_id: null, status: 'nuevo', next_action: '', next_action_at: null, notes: '',
  consent_status: 'unknown', consent_version: null, consent_source: null, consent_at: null,
  consent_revoked_at: null, needs_review: false, review_reason: '', phone_pais: 'AR',
};

const superAdmin = { role: 'super_admin', alcance: 'global', sede_id: null };
const adminClub = { role: 'admin_club', alcance: 'sede', sede_id: 1,
  user_id: '33333333-3333-4333-8333-333333333333' };

/** Doble de pool: registra cada consulta y jamás abre una conexión. */
function fakePool({ roleRow, contacts = [contacto] }) {
  const calls = [];
  const client = {
    query: async (sql, params = []) => {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ text, params });
      if (/^(begin|commit|rollback)/i.test(text) || /statement_timeout/.test(text)) return { rows: [] };
      if (/from public\.user_roles/.test(text)) return { rows: roleRow ? [roleRow] : [] };
      if (/^insert into public\.whatsapp_crm_timeline/.test(text)) return { rows: [] };
      if (/^update public\.whatsapp_crm_contacts/.test(text)) return { rows: [] };
      // El orden importa: la consulta de la bandeja lleva una subconsulta sobre `origins`.
      if (/from public\.whatsapp_crm_contacts/.test(text)) {
        const sede = params[1];
        const visibles = sede == null ? contacts : contacts.filter(c => String(c.sede_id) === String(sede));
        return { rows: /limit 1/.test(text) ? visibles.slice(0, 1) : visibles };
      }
      if (/whatsapp_crm_contact_origins/.test(text)) return { rows: [] };
      if (/from public\.whatsapp_crm_timeline/.test(text)) return { rows: [] };
      return { rows: [] };
    },
    release: () => {},
  };
  return { pool: { connect: async () => client }, calls };
}

// ══ 1. El valor por defecto sigue APAGADO y no se prende por entorno ════════════════════
test('H3 · CRM_DELEGATION_ENABLED sigue en false', () => {
  assert.equal(CRM_DELEGATION_ENABLED, false, 'la delegación se mantiene apagada');
});

test('H3 · ninguna variable de entorno puede encender la delegación', () => {
  // El flag es una constante congelada del módulo: no se lee del entorno. Se comprueba sobre
  // el FUENTE, no sobre `process.env` (que en ESM ya estaría leído al importar el módulo).
  const fuente = readFileSync(new URL('./whatsappCrm.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /process\.env\.CRM_DELEGATION_ENABLED/,
    'no debe existir una variable de entorno que active la delegación en producto');
  assert.match(fuente, /export const CRM_DELEGATION_ENABLED = false;/);
  // Con la variable puesta en el proceso, el valor del módulo NO cambia.
  const previo = process.env.CRM_DELEGATION_ENABLED;
  process.env.CRM_DELEGATION_ENABLED = 'true';
  assert.equal(CRM_DELEGATION_ENABLED, false, 'el entorno no puede cambiar el flag');
  if (previo === undefined) delete process.env.CRM_DELEGATION_ENABLED;
  else process.env.CRM_DELEGATION_ENABLED = previo;
});

// ══ 2. Flag APAGADO · comportamiento actual INTACTO ═════════════════════════════════════
test('H3 · con el flag APAGADO el rol delegado sigue denegado (sin cambios)', async () => {
  assert.deepEqual(resolveCrmScope(adminClub), { allowed: false, reason: 'delegation_closed' });
  // Y tampoco alcanza con pasar una política completa si el flag está apagado.
  assert.deepEqual(
    resolveCrmScope(adminClub, { delegationEnabled: false, policy: POLITICA_PRUEBA_COMPLETA }),
    { allowed: false, reason: 'delegation_closed' });

  const { pool } = fakePool({ roleRow: adminClub });
  await assert.rejects(
    createWhatsappCrmService({ pgPool: pool }).listContacts(userId),
    { status: 403, code: 'CRM_FORBIDDEN' });
});

// ══ 3. EL FALLO ABIERTO · flag encendido SIN política ⇒ DENEGADO ════════════════════════
test('H3 · flag ENCENDIDO sin política ⇒ DENEGADO (falla cerrado)', () => {
  const scope = resolveCrmScope(adminClub, { delegationEnabled: true });
  assert.equal(scope.allowed, false,
    'el flag por sí solo NO puede habilitar la delegación: falta la política P1–P4');
  assert.equal(scope.reason, DELEGATION_CODES.POLICY_REQUIRED);
});

test('H3 · el SERVICIO con el flag encendido y sin política responde 403', async () => {
  const { pool, calls } = fakePool({ roleRow: adminClub });
  const service = createWhatsappCrmService({ pgPool: pool, delegationEnabled: true });
  await assert.rejects(service.listContacts(userId), { status: 403, code: 'CRM_FORBIDDEN' });
  // Y no llega a tocar la tabla de contactos: la decisión es ANTES de la consulta.
  assert.equal(calls.some(c => /from public\.whatsapp_crm_contacts/.test(c.text)), false,
    'no debe consultar la bandeja si el alcance no está resuelto');
});

// ══ 4. Política INCOMPLETA o INVÁLIDA ⇒ DENEGADO ════════════════════════════════════════
test('H3 · flag encendido con política INCOMPLETA ⇒ DENEGADO', async () => {
  const scope = resolveCrmScope(adminClub, { delegationEnabled: true, policy: POLITICA_PRUEBA_INCOMPLETA });
  assert.equal(scope.allowed, false);
  assert.equal(scope.reason, DELEGATION_CODES.POLICY_REQUIRED);

  const { pool } = fakePool({ roleRow: adminClub });
  await assert.rejects(
    createWhatsappCrmService({ pgPool: pool, delegationEnabled: true, delegationPolicy: POLITICA_PRUEBA_INCOMPLETA })
      .listContacts(userId),
    { status: 403, code: 'CRM_FORBIDDEN' });
});

test('H3 · flag encendido con política INVÁLIDA ⇒ DENEGADO', async () => {
  const scope = resolveCrmScope(adminClub, { delegationEnabled: true, policy: POLITICA_PRUEBA_INVALIDA });
  assert.equal(scope.allowed, false);
  assert.equal(scope.reason, DELEGATION_CODES.POLICY_INVALID);

  const { pool } = fakePool({ roleRow: adminClub });
  await assert.rejects(
    createWhatsappCrmService({ pgPool: pool, delegationEnabled: true, delegationPolicy: POLITICA_PRUEBA_INVALIDA })
      .listContacts(userId),
    { status: 403, code: 'CRM_FORBIDDEN' });
});

test('H3 · una política con tipos basura no habilita nada', () => {
  for (const basura of [null, undefined, 0, '', 'completa', [], { ownerOnly: true }]) {
    const scope = resolveCrmScope(adminClub, { delegationEnabled: true, policy: basura });
    assert.equal(scope.allowed, false, `política ${JSON.stringify(basura)} no puede permitir`);
  }
});

// ══ 5. Política COMPLETA (ficticia) ⇒ permitido SÓLO dentro del alcance ═════════════════
test('H3 · con política completa y el flag encendido, el operador entra a SU sede', async () => {
  const scope = resolveCrmScope(adminClub, { delegationEnabled: true, policy: POLITICA_PRUEBA_COMPLETA });
  assert.equal(scope.allowed, true);
  assert.equal(scope.global, false, 'el alcance delegado NUNCA es global');
  assert.equal(scope.sedeId, 1);

  const { pool, calls } = fakePool({ roleRow: adminClub });
  const bandeja = await createWhatsappCrmService({
    pgPool: pool, delegationEnabled: true, delegationPolicy: POLITICA_PRUEBA_COMPLETA,
  }).listContacts(userId);
  assert.equal(bandeja.contacts.length, 1);
  const consulta = calls.find(c => /from public\.whatsapp_crm_contacts c/.test(c.text));
  assert.equal(consulta.params[1], 1, 'la sede del alcance manda');
  assert.equal(bandeja.dispatchAllowed, false, 'la delegación no habilita envíos');
});

test('H3 · el alcance delegado NO se amplía aunque el query string pida otra sede', async () => {
  const { pool, calls } = fakePool({ roleRow: adminClub });
  await createWhatsappCrmService({
    pgPool: pool, delegationEnabled: true, delegationPolicy: POLITICA_PRUEBA_COMPLETA,
  }).listContacts(userId, { sedeId: 99 });
  const consulta = calls.find(c => /from public\.whatsapp_crm_contacts c/.test(c.text));
  assert.equal(consulta.params[1], 1, 'no puede pedir una sede ajena por query string');
});

test('H3 · un rol fuera de la política sigue denegado aunque el flag esté encendido', async () => {
  const scope = resolveCrmScope({ role: 'jugador', alcance: null, sede_id: 1 },
    { delegationEnabled: true, policy: POLITICA_PRUEBA_COMPLETA });
  assert.equal(scope.allowed, false);
  assert.equal(scope.reason, DELEGATION_CODES.ROLE_NOT_DELEGABLE);
});

test('H3 · un operador sin sede válida sigue denegado con el flag encendido', () => {
  const scope = resolveCrmScope({ ...adminClub, sede_id: null },
    { delegationEnabled: true, policy: POLITICA_PRUEBA_COMPLETA });
  assert.equal(scope.allowed, false);
  assert.equal(scope.reason, DELEGATION_CODES.SEDE_REQUIRED);
});

// ══ 6. El superadministrador global no depende del flag ni de la política ═══════════════
test('H3 · el superadmin global sigue entrando, con el flag apagado o encendido', async () => {
  for (const opciones of [{}, { delegationEnabled: true }, { delegationEnabled: true, policy: POLITICA_PRUEBA_COMPLETA }]) {
    const scope = resolveCrmScope(superAdmin, opciones);
    assert.equal(scope.allowed, true, JSON.stringify(opciones));
    assert.equal(scope.global, true);
    assert.equal(scope.sedeId, null, 'global no lleva filtro de sede');
  }
  const { pool } = fakePool({ roleRow: superAdmin });
  const bandeja = await createWhatsappCrmService({ pgPool: pool }).listContacts(userId);
  assert.equal(bandeja.contacts.length, 1);
});

// ══ 7. Estructural: una sola fuente de verdad para el alcance ═══════════════════════════
test('H3 · el servicio ya no tiene una implementación propia del alcance delegado', () => {
  const fuente = readFileSync(new URL('./whatsappCrm.js', import.meta.url), 'utf8');
  assert.match(fuente, /import\s*\{[^}]*buildDelegationScope[^}]*\}\s*from\s*'\.\/whatsappCrmDelegacion\.js'/,
    'resolveCrmScope debe delegar en el componente, no reimplementar la regla');
  // No debe quedar la rama vieja que concedía con el flag solo.
  assert.doesNotMatch(fuente, /delegationEnabled && \['admin_club', 'operador_whatsapp'\]\.includes\(role\)/,
    'la rama que concedía con el flag y sin política debe desaparecer');
});

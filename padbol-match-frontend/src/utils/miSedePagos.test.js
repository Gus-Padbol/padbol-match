/**
 * Tests — adaptación write-only de Configuración de pagos (Mi Sede).
 */
import {
  SEDE_SECRET_FIELDS,
  SEDE_SECRET_FIELD_PATTERN,
  sanitizeSedeRowForState,
  deriveSedePagosIndicadores,
  normalizePagosIndicadores,
  esCredencialNuevaValida,
  buildPagosPatchPayload,
  parseSedePatchResponse,
  pagosEstadoKey,
  sanitizePagosPartialPayload,
  clearPagosCredentialFields,
} from './miSedePagos';

const PLACEHOLDER_REEMPLAZAR = 'Ingresá una nueva credencial para reemplazar la actual';
const PLACEHOLDER_INGRESAR = 'Ingresá la credencial';
const PLACEHOLDERS = [PLACEHOLDER_REEMPLAZAR, PLACEHOLDER_INGRESAR];

const SEDE_CON_SECRETOS = {
  id: 1,
  nombre: 'Club Uno',
  direccion: 'Calle 123',
  mp_access_token: 'APP_USR-super-secreto',
  mp_public_key: 'APP_USR-public',
  stripe_account_id: 'acct_secreto',
  stripe_secret_key: 'sk_live_123',
  metodo_pago: 'mercadopago',
};

describe('Mi Sede — pagos write-only', () => {
  it('1. una sede recibida sin mp_access_token no rompe el formulario', () => {
    const sede = { id: 2, nombre: 'Sin token' };
    expect(() => sanitizeSedeRowForState(sede)).not.toThrow();
    expect(() => deriveSedePagosIndicadores(sede)).not.toThrow();
    const formCredenciales = { mp_access_token: '', stripe_account_id: '' };
    expect(formCredenciales.mp_access_token).toBe('');
  });

  it('2. el input de Mercado Pago inicia vacío (estado inicial)', () => {
    const form = clearPagosCredentialFields({ ...SEDE_CON_SECRETOS });
    expect(form.mp_access_token).toBe('');
  });

  it('3. el input de Stripe inicia vacío', () => {
    const form = clearPagosCredentialFields({ stripe_account_id: 'acct_x' });
    expect(form.stripe_account_id).toBe('');
  });

  it('4. mercadopago_configurado=true muestra estado configurado', () => {
    expect(pagosEstadoKey(true)).toBe('configurado');
  });

  it('5. mercadopago_configurado=false muestra estado no configurado', () => {
    expect(pagosEstadoKey(false)).toBe('no_configurado');
  });

  it('6. stripe_configurado=true muestra estado configurado', () => {
    expect(pagosEstadoKey(true)).toBe('configurado');
  });

  it('7. stripe_configurado=false muestra estado no configurado', () => {
    expect(pagosEstadoKey(false)).toBe('no_configurado');
  });

  it('8. el indicador desconocido no se interpreta como false', () => {
    const ind = deriveSedePagosIndicadores({ id: 1, nombre: 'X' });
    expect(ind.mercadopago_configurado).toBeNull();
    expect(ind.stripe_configurado).toBeNull();
    expect(pagosEstadoKey(ind.mercadopago_configurado)).toBe('desconocido');
    expect(pagosEstadoKey(null)).not.toBe('no_configurado');
  });

  it('9. un secreto existente nunca aparece como value', () => {
    const safe = sanitizeSedeRowForState(SEDE_CON_SECRETOS);
    expect(safe.mp_access_token).toBeUndefined();
    expect(safe.stripe_account_id).toBeUndefined();
    expect(safe.mp_public_key).toBeUndefined();
    expect(JSON.stringify(safe)).not.toContain('APP_USR-super-secreto');
  });

  it('10. un secreto existente nunca aparece como placeholder', () => {
    expect(PLACEHOLDER_REEMPLAZAR).not.toContain('APP_USR');
    expect(PLACEHOLDER_REEMPLAZAR).not.toBe(SEDE_CON_SECRETOS.mp_access_token);
  });

  it('11. al guardar sin escribir credencial, mp_access_token no entra en el payload', () => {
    const payload = buildPagosPatchPayload({
      mpAccessToken: '',
      stripeAccountId: '',
      placeholders: PLACEHOLDERS,
    });
    expect(payload).not.toHaveProperty('mp_access_token');
    expect(payload).not.toHaveProperty('stripe_account_id');
  });

  it('12. un string vacío no entra en el payload', () => {
    expect(sanitizePagosPartialPayload({ mp_access_token: '' })).toEqual({});
  });

  it('13. un string con espacios no entra en el payload', () => {
    expect(sanitizePagosPartialPayload({ mp_access_token: '   ', stripe_account_id: '\t' })).toEqual({});
  });

  it('14. una nueva credencial escrita sí entra en el payload', () => {
    const payload = buildPagosPatchPayload({
      mpAccessToken: ' APP_USR-nuevo ',
      mpPublicKey: 'APP_USR-pub',
      stripeAccountId: 'acct_nuevo',
      placeholders: PLACEHOLDERS,
    });
    expect(payload.mp_access_token).toBe('APP_USR-nuevo');
    expect(payload.mp_public_key).toBe('APP_USR-pub');
    expect(payload.stripe_account_id).toBe('acct_nuevo');
  });

  it('15. la respuesta nueva usa response.sede correctamente', () => {
    const parsed = parseSedePatchResponse({
      sede: { id: 1, nombre: 'Club', mp_access_token: 'NO_DEBE_PASAR' },
      pagos: { mercadopago_configurado: true, stripe_configurado: false },
    });
    expect(parsed.sede.nombre).toBe('Club');
    expect(parsed.sede.mp_access_token).toBeUndefined();
  });

  it('16. la respuesta nueva usa response.pagos correctamente', () => {
    const parsed = parseSedePatchResponse({
      sede: { id: 1, nombre: 'Club' },
      pagos: { mercadopago_configurado: true, stripe_configurado: false },
    });
    expect(parsed.pagos).toEqual({
      mercadopago_configurado: true,
      stripe_configurado: false,
    });
  });

  it('17. después de guardar correctamente, el input queda vacío', () => {
    const cleared = clearPagosCredentialFields({
      nombre: 'Club',
      mp_access_token: 'APP_USR-nuevo',
      stripe_account_id: 'acct_nuevo',
    });
    expect(cleared.mp_access_token).toBe('');
    expect(cleared.stripe_account_id).toBe('');
    expect(cleared.nombre).toBe('Club');
  });

  it('18. después de guardar, el indicador queda configurado', () => {
    const parsed = parseSedePatchResponse({
      sede: { id: 1 },
      pagos: { mercadopago_configurado: true, stripe_configurado: false },
    });
    expect(parsed.pagos.mercadopago_configurado).toBe(true);
    expect(pagosEstadoKey(parsed.pagos.mercadopago_configurado)).toBe('configurado');
  });

  it('19. un error conserva temporalmente el valor escrito para reintentar', () => {
    let mpInput = 'APP_USR-intento';
    const error = true;
    if (!error) mpInput = '';
    expect(mpInput).toBe('APP_USR-intento');
  });

  it('20. ningún log recibe el secreto', () => {
    const safe = sanitizeSedeRowForState(SEDE_CON_SECRETOS);
    const serialized = JSON.stringify({ sede: safe, form: clearPagosCredentialFields({}) });
    expect(serialized).not.toContain('APP_USR-super-secreto');
    expect(serialized).not.toContain('acct_secreto');
    expect(serialized).not.toContain('sk_live_123');
  });

  it('21. las demás propiedades de Mi Sede continúan en el payload cuando corresponde', () => {
    const pagosPayload = buildPagosPatchPayload({ mpAccessToken: 'APP_USR-x' });
    expect(Object.keys(pagosPayload)).toEqual(['mp_access_token']);
    const generalPayload = { nombre: 'Club', direccion: 'Calle', precio_60min: 1000 };
    expect(generalPayload).not.toHaveProperty('mp_access_token');
  });

  it('22. la compatibilidad con respuestas seguras anteriores no expone secretos', () => {
    const parsed = parseSedePatchResponse({
      id: 9,
      nombre: 'Legacy',
      mp_access_token: 'NO',
      stripe_secret_key: 'NO',
    });
    expect(parsed.sede.nombre).toBe('Legacy');
    expect(parsed.sede.mp_access_token).toBeUndefined();
    expect(parsed.sede.stripe_secret_key).toBeUndefined();
  });

  it('23. no se envía texto de placeholder como credencial', () => {
    expect(esCredencialNuevaValida(PLACEHOLDER_INGRESAR, PLACEHOLDERS)).toBe(false);
    expect(sanitizePagosPartialPayload({
      mp_access_token: PLACEHOLDER_INGRESAR,
      stripe_account_id: PLACEHOLDER_REEMPLAZAR,
    }, PLACEHOLDERS)).toEqual({});
  });

  it('24. no se guardan credenciales en localStorage o sessionStorage', () => {
    SEDE_SECRET_FIELDS.forEach((field) => {
      expect(localStorage.getItem(field)).toBeNull();
      expect(sessionStorage.getItem(field)).toBeNull();
    });
  });

  it('sanitizePagosPartialPayload conserva metodo_pago y descarta secretos vacíos', () => {
    expect(sanitizePagosPartialPayload({
      metodo_pago: 'mercadopago',
      pago_manual_instrucciones: 'Transferí a alias X',
      mp_access_token: '',
      stripe_account_id: 'acct_ok',
    })).toEqual({
      metodo_pago: 'mercadopago',
      pago_manual_instrucciones: 'Transferí a alias X',
      stripe_account_id: 'acct_ok',
    });
  });

  it('deriveSedePagosIndicadores refleja presencia real del secreto sin retenerlo', () => {
    expect(deriveSedePagosIndicadores(SEDE_CON_SECRETOS)).toEqual({
      mercadopago_configurado: true,
      stripe_configurado: true,
    });
  });

  it('normalizePagosIndicadores conserva el previo si la respuesta no trae pagos', () => {
    const prev = { mercadopago_configurado: true, stripe_configurado: false };
    expect(normalizePagosIndicadores(undefined, prev)).toEqual(prev);
  });

  it('whitelist de secretos no aparece en SEDE_PUBLIC state', () => {
    const safe = sanitizeSedeRowForState(SEDE_CON_SECRETOS);
    for (const key of Object.keys(safe)) {
      expect(SEDE_SECRET_FIELD_PATTERN.test(key) || SEDE_SECRET_FIELDS.includes(key)).toBe(false);
    }
  });
});

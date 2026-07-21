import {
  applyPaisChangeToWhatsapp,
  codigoTelefonicoDesdePaisLabel,
  ensureWhatsappPrefixed,
  exampleLocalForCodigo,
  joinWhatsappLocalInput,
  normalizeWhatsappForStorage,
  phoneIsOnlyCountryPrefix,
  phoneStartsWithCountryPrefix,
  sanitizeWhatsappInput,
  splitWhatsappForPhoneField,
  stripCountryPrefix,
} from './sedeWhatsappPais';

describe('sedeWhatsappPais', () => {
  it('resuelve +54 desde Argentina e ISO AR', () => {
    expect(codigoTelefonicoDesdePaisLabel('🇦🇷 Argentina')).toBe('+54');
    expect(codigoTelefonicoDesdePaisLabel('España')).toBe('+34');
    expect(codigoTelefonicoDesdePaisLabel('AR')).toBe('+54');
  });

  it('Argentina vacío → +54', () => {
    expect(applyPaisChangeToWhatsapp({
      prevPaisLabel: '',
      nextPaisLabel: '🇦🇷 Argentina',
      currentPhone: '',
    })).toEqual({ phone: '+54', warning: null });
  });

  it('antepone +54 a número local sin destruirlo', () => {
    expect(applyPaisChangeToWhatsapp({
      prevPaisLabel: '',
      nextPaisLabel: 'Argentina',
      currentPhone: '2213032019',
    })).toEqual({ phone: '+54 2213032019', warning: null });
  });

  it('no duplica prefijo +54', () => {
    expect(phoneStartsWithCountryPrefix('+54 9 11 5555', '+54')).toBe(true);
    expect(applyPaisChangeToWhatsapp({
      prevPaisLabel: 'Argentina',
      nextPaisLabel: 'Argentina',
      currentPhone: '+54 911',
    }).phone).toBe('+54 911');
  });

  it('cambia solo prefijo Argentina→España', () => {
    expect(phoneIsOnlyCountryPrefix('+54', '+54')).toBe(true);
    expect(applyPaisChangeToWhatsapp({
      prevPaisLabel: 'Argentina',
      nextPaisLabel: 'España',
      currentPhone: '+54',
    })).toEqual({ phone: '+34', warning: null });
  });

  it('reemplaza prefijo en número completo al cambiar país', () => {
    const r = applyPaisChangeToWhatsapp({
      prevPaisLabel: 'Argentina',
      nextPaisLabel: 'España',
      currentPhone: '+54 9 11 12345678',
    });
    expect(r.phone).toBe('+34 9 11 12345678');
    expect(r.warning).toBeNull();
  });

  it('conserva otro internacional y advierte', () => {
    const r = applyPaisChangeToWhatsapp({
      prevPaisLabel: 'Argentina',
      nextPaisLabel: 'España',
      currentPhone: '+1 202 555 0123',
    });
    expect(r.phone).toBe('+1 202 555 0123');
    expect(r.warning).toBe('mismatch');
  });

  it('ensureWhatsappPrefixed en carga con país Argentina', () => {
    expect(ensureWhatsappPrefixed('', 'Argentina')).toEqual({ phone: '+54', warning: null });
    expect(ensureWhatsappPrefixed('2213032019', '🇦🇷 Argentina').phone).toBe('+54 2213032019');
    expect(ensureWhatsappPrefixed('+5491112345678', 'Argentina').phone).toBe('+5491112345678');
  });

  it('stripCountryPrefix', () => {
    expect(stripCountryPrefix('+54 9 11', '+54')).toBe('9 11');
  });

  it('sanitiza y normaliza E.164 con país', () => {
    expect(sanitizeWhatsappInput('+54 abc 911')).toBe('+54  911');
    expect(normalizeWhatsappForStorage('+54 9 11 1234 5678')).toBe('+5491112345678');
    expect(normalizeWhatsappForStorage('2213032019', 'Argentina')).toBe('+542213032019');
  });
});

describe('MEJ-04 splitWhatsappForPhoneField', () => {
  it('Argentina: separa prefijo +54 del número local', () => {
    expect(splitWhatsappForPhoneField('+54 221 555 1234', '🇦🇷 Argentina'))
      .toEqual({ mode: 'split', codigo: '+54', local: '221 555 1234' });
  });

  it('otro país: usa el prefijo real sin asumir Argentina', () => {
    expect(splitWhatsappForPhoneField('+34 612 345 678', 'España'))
      .toEqual({ mode: 'split', codigo: '+34', local: '612 345 678' });
  });

  it('histórico E.164 sin espacios: separa por dígitos', () => {
    expect(splitWhatsappForPhoneField('+5492215551234', 'Argentina'))
      .toEqual({ mode: 'split', codigo: '+54', local: '92215551234' });
  });

  it('histórico local sin prefijo: se conserva como local', () => {
    expect(splitWhatsappForPhoneField('2215551234', 'Argentina'))
      .toEqual({ mode: 'split', codigo: '+54', local: '2215551234' });
  });

  it('vacío o solo prefijo: local vacío sin romper', () => {
    expect(splitWhatsappForPhoneField('', 'Argentina'))
      .toEqual({ mode: 'split', codigo: '+54', local: '' });
    expect(splitWhatsappForPhoneField('+54', 'Argentina'))
      .toEqual({ mode: 'split', codigo: '+54', local: '' });
  });

  it('sin código de país aplicable: campo único (modo full)', () => {
    expect(splitWhatsappForPhoneField('123456', 'Atlantis'))
      .toEqual({ mode: 'full', codigo: null, local: '123456' });
    expect(splitWhatsappForPhoneField('+1 202 555 0123', 'Argentina').mode).toBe('full');
  });
});

describe('MEJ-04 joinWhatsappLocalInput', () => {
  it('une local con prefijo sin perder ceros ni espacios', () => {
    expect(joinWhatsappLocalInput('0221 555 1234', '+54')).toBe('+54 0221 555 1234');
  });

  it('local vacío queda solo el prefijo (compatible con contrato actual)', () => {
    expect(joinWhatsappLocalInput('', '+54')).toBe('+54');
  });

  it('no duplica prefijo al pegar un número que ya lo incluye', () => {
    expect(joinWhatsappLocalInput('+54 221 555 1234', '+54')).toBe('+54 221 555 1234');
    expect(joinWhatsappLocalInput('5492215551234', '+54')).toBe('+54 92215551234');
  });

  it('sin dedupDigits: tipeo de dígitos que coinciden con el código no se come caracteres', () => {
    expect(joinWhatsappLocalInput('39', '+39', { dedupDigits: false })).toBe('+39 39');
  });

  it('otro internacional pegado se conserva tal cual', () => {
    expect(joinWhatsappLocalInput('+1 202 555 0123', '+54')).toBe('+1 202 555 0123');
  });

  it('round-trip split→join no altera el valor guardado', () => {
    const stored = '+54 221 555 1234';
    const { codigo, local } = splitWhatsappForPhoneField(stored, 'Argentina');
    expect(joinWhatsappLocalInput(local, codigo)).toBe(stored);
  });

  it('exampleLocalForCodigo devuelve el ejemplo sin prefijo', () => {
    expect(exampleLocalForCodigo('+54')).toBe('9 11 1234-5678');
    expect(exampleLocalForCodigo('+34')).toBe('612 345 678');
  });
});

import {
  applyPaisChangeToWhatsapp,
  codigoTelefonicoDesdePaisLabel,
  ensureWhatsappPrefixed,
  normalizeWhatsappForStorage,
  phoneIsOnlyCountryPrefix,
  phoneStartsWithCountryPrefix,
  sanitizeWhatsappInput,
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

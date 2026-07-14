import {
  applyPaisChangeToWhatsapp,
  codigoTelefonicoDesdePaisLabel,
  normalizeWhatsappForStorage,
  phoneIsOnlyCountryPrefix,
  phoneStartsWithCountryPrefix,
  sanitizeWhatsappInput,
} from './sedeWhatsappPais';

describe('sedeWhatsappPais', () => {
  it('resuelve +54 desde Argentina', () => {
    expect(codigoTelefonicoDesdePaisLabel('🇦🇷 Argentina')).toBe('+54');
    expect(codigoTelefonicoDesdePaisLabel('España')).toBe('+34');
  });

  it('Argentina vacío → +54', () => {
    expect(applyPaisChangeToWhatsapp({
      prevPaisLabel: '',
      nextPaisLabel: '🇦🇷 Argentina',
      currentPhone: '',
    })).toEqual({ phone: '+54', warning: null });
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

  it('conserva número completo y advierte', () => {
    const r = applyPaisChangeToWhatsapp({
      prevPaisLabel: 'Argentina',
      nextPaisLabel: 'España',
      currentPhone: '+54 9 11 12345678',
    });
    expect(r.phone).toBe('+54 9 11 12345678');
    expect(r.warning).toBe('mismatch');
  });

  it('sanitiza y normaliza E.164', () => {
    expect(sanitizeWhatsappInput('+54 abc 911')).toBe('+54  911');
    expect(normalizeWhatsappForStorage('+54 9 11 1234 5678')).toBe('+5491112345678');
  });
});

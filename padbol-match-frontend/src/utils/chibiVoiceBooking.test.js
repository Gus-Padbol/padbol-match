import { buildVoiceBookingCheckoutHref, resolveVoiceBookingConfirmation } from './chibiVoiceBooking';

describe('Chibi voice booking confirmation', () => {
  test.each(['sí', 'Dale', 'confirmar', 'yes', 'Sim'])('recognizes confirmation: %s', (value) => {
    expect(resolveVoiceBookingConfirmation(value)).toBe('confirm');
  });

  test.each(['no', 'Cancelar', 'otro horario', 'not now'])('recognizes cancellation: %s', (value) => {
    expect(resolveVoiceBookingConfirmation(value)).toBe('cancel');
  });

  test('creates the exact ReservaForm deep link only with a concrete court', () => {
    expect(buildVoiceBookingCheckoutHref({ sedeId: 4, fecha: '2026-08-02', hora: '20:30', canchaId: 2, deporte: 'padbol' })).toBe(
      '/reservar?sedeId=4&fecha=2026-08-02&hora=20%3A30&canchaId=2&deporte=padbol',
    );
    expect(buildVoiceBookingCheckoutHref({ sedeId: 4, fecha: '2026-08-02', hora: '20:30' })).toBeNull();
  });
});

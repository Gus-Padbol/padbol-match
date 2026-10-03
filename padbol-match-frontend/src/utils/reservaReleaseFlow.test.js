import {
  clearMpReservaPendingSlot,
  readMpReservaPendingSlot,
  saveMpReservaPendingSlot,
} from './reservaReturnUrl';

describe('capacidad de liberación de reserva', () => {
  afterEach(() => clearMpReservaPendingSlot());

  test('persiste el token opaco junto al slot para sobrevivir el retorno del checkout', () => {
    const pending = {
      sede: 'Padbol Norte',
      fecha: '2026-10-04',
      hora: '18:30',
      cancha: 2,
      releaseToken: 'opaque.signed-capability',
      releaseTokenExpiresAt: '2026-10-03T14:00:00.000Z',
    };
    saveMpReservaPendingSlot(pending);
    expect(readMpReservaPendingSlot()).toEqual(pending);
  });

  test('sin token no fabrica una autorización de liberación', () => {
    saveMpReservaPendingSlot({ sede: 'Padbol Norte', fecha: '2026-10-04', hora: '18:30', cancha: 2 });
    expect(readMpReservaPendingSlot().releaseToken).toBeUndefined();
  });
});

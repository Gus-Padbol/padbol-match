import { JUGADOR_HUB_NAV_ORDER } from './BottomNav';

test('los cinco accesos principales conservan el orden acordado', () => {
  expect(JUGADOR_HUB_NAV_ORDER).toEqual([
    'inicio',
    'jugar',
    'competir',
    'notificaciones',
    'perfil',
  ]);
});

import { resolvePlayerNotificationDestination } from './playerNotificationDestination';

const origin = 'https://www.padbolmatch.com';

test('keeps same-site links in the application including query and fragment', () => {
  expect(resolvePlayerNotificationDestination(`${origin}/torneo/42?tab=equipos#detalle`, origin))
    .toEqual({ external: false, href: '/torneo/42?tab=equipos#detalle' });
});

test('opens published external destinations as full URLs', () => {
  expect(resolvePlayerNotificationDestination('https://dev.padbol.com/mi-academy', origin))
    .toEqual({ external: true, href: 'https://dev.padbol.com/mi-academy' });
});

test.each(['javascript:alert(1)', 'data:text/html,hello', 'https://user:password@padbol.com', ''])
  ('ignores unsafe or empty persisted destination %s', (value) => {
    expect(resolvePlayerNotificationDestination(value, origin)).toBeNull();
  });

import {timezoneOptionsForPais} from './NuevaSedeSuperBottomSheet';

describe('zonas horarias por país', () => {
  test('Italia ofrece Europe/Rome y no cae en UTC', () => {
    const opts = timezoneOptionsForPais('🇮🇹 Italia');
    expect(opts.map((o) => o.value)).toContain('Europe/Rome');
    expect(opts.map((o) => o.value)).not.toContain('Etc/UTC');
  });
  test('Argentina y España conservan sus zonas', () => {
    expect(timezoneOptionsForPais('🇦🇷 Argentina')[0].value).toBe('America/Argentina/Buenos_Aires');
    expect(timezoneOptionsForPais('🇪🇸 España')[0].value).toBe('Europe/Madrid');
  });
  test('país desconocido sigue ofreciendo UTC como respaldo', () => {
    expect(timezoneOptionsForPais('🇳🇿 Nueva Zelanda')[0].value).toBe('Etc/UTC');
  });
});

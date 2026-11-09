import {
  countryFlagFromIso,
  countryLabelFromIso,
  countryNameFromIso,
} from './countryRankingDisplay';

test('builds the flag from the validated two-letter ISO code', () => {
  expect(countryFlagFromIso('AR')).toBe('🇦🇷');
  expect(countryFlagFromIso('it')).toBe('🇮🇹');
  expect(countryFlagFromIso(' AR ')).toBe('🇦🇷');
  expect(countryFlagFromIso('ARG')).toBe('');
  expect(countryFlagFromIso('1A')).toBe('');
  expect(countryFlagFromIso(null)).toBe('');
});

test('localizes the country name from ISO without a parallel country catalog', () => {
  const name = countryNameFromIso('AR', 'es');
  expect(name).toBe('Argentina');
  expect(countryNameFromIso('IT', 'it')).toBe('Italia');
  expect(countryNameFromIso('ar', 'es')).toBe('Argentina');
  expect(countryNameFromIso('')).toBe('');
});

test('country label keeps flag and localized name together', () => {
  const label = countryLabelFromIso('AR', 'es');
  expect(label).toContain('🇦🇷');
  expect(label).toContain('Argentina');
  expect(countryLabelFromIso('', 'es')).toBe('');
});

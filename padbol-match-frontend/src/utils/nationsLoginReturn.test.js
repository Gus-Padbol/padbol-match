import {
  resolvePostLoginNavigatePath,
  resolveSignUpEmailRedirectPath,
  safeNationsInscripcionPathFromLoginRedirect,
} from './reservaReturnUrl';
import {buildSignUpEmailRedirectUrl} from './handleAuthOnce';

const NATIONS = '/nations-cup/nations-cup-napoli-2026/inscripcion';
const searchFor = (path) => `?redirect=${encodeURIComponent(path)}&lang=en`;

test('vuelve a la inscripción Nations exacta tras login, signup y completar perfil', () => {
  expect(safeNationsInscripcionPathFromLoginRedirect(searchFor(NATIONS))).toBe(NATIONS);
  expect(resolvePostLoginNavigatePath(searchFor(NATIONS))).toBe(NATIONS);
  expect(resolveSignUpEmailRedirectPath(searchFor(NATIONS))).toBe(NATIONS);
  expect(buildSignUpEmailRedirectUrl('https://padbolmatch.com/', {
    emailRedirectPath: NATIONS,
  })).toBe(`https://padbolmatch.com/login?redirect=${encodeURIComponent(NATIONS)}`);
});

test('acepta slugs Nations seguros y normaliza la barra final', () => {
  expect(safeNationsInscripcionPathFromLoginRedirect(searchFor('/nations-cup/otro-evento-2026/inscripcion/'))).toBe('/nations-cup/otro-evento-2026/inscripcion');
});

test.each([
  '//evil.example/nations-cup/nations-cup-napoli-2026/inscripcion',
  'https://evil.example/nations-cup/nations-cup-napoli-2026/inscripcion',
  '/nations-cup/../admin',
  '/nations-cup/nations-cup-napoli-2026/otra',
  '/nations-cup//inscripcion',
  '/NATIONS-CUP/nations-cup-napoli-2026/inscripcion',
  '/nations-cup/nations-cup-napoli-2026/inscripcion?next=https://evil.example',
])('rechaza destino no permitido: %s', (path) => {
  expect(safeNationsInscripcionPathFromLoginRedirect(searchFor(path))).toBeNull();
});

test('preserva FIPA y no acepta dominios externos en el email de confirmación', () => {
  expect(resolvePostLoginNavigatePath('?redirect=%2Ffipa%2Fdocumentos%3Fdocument%3Dreglamento-oficial'))
    .toBe('/fipa/documentos?document=reglamento-oficial');
  expect(resolveSignUpEmailRedirectPath('?redirect=%2Ffipa%2Fdocumentos%3Fdocument%3Dreglamento-oficial'))
    .toBe('/fipa/documentos?document=reglamento-oficial');
  expect(resolveSignUpEmailRedirectPath('?redirect=%2Fhub')).toBeNull();
  expect(buildSignUpEmailRedirectUrl('https://padbolmatch.com', {
    emailRedirectPath: '//evil.example/nations-cup/nations-cup-napoli-2026/inscripcion',
  })).toBe('https://padbolmatch.com/login');
});

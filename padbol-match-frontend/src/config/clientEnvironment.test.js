import { getApiBaseUrl, getPublicApiBaseUrl } from '../utils/apiPublicBaseUrl';
const { resolveClientEnvironment, PRODUCTION_API_URL, PRODUCTION_SUPABASE_PUBLIC_KEY } = require('./clientEnvironment.js');

const qa = {
  REACT_APP_APP_VARIANT: 'qa',
  REACT_APP_API_BASE_URL: 'https://api.qa.example',
  REACT_APP_API_URL: 'https://api.qa.example',
  REACT_APP_SUPABASE_URL: 'https://auth.qa.example',
  REACT_APP_SUPABASE_ANON_KEY: 'sb_publishable_qa_fixture_not_a_real_key',
};
const originalEnv = process.env;
afterEach(() => { process.env = originalEnv; });

test('QA resolves both aliases and its own Supabase without fallback', () => {
  expect(resolveClientEnvironment(qa)).toMatchObject({ isQA:true, apiBaseUrl:qa.REACT_APP_API_BASE_URL, apiLegacyUrl:qa.REACT_APP_API_URL, supabaseUrl:qa.REACT_APP_SUPABASE_URL });
  process.env = { ...originalEnv, ...qa };
  expect(getApiBaseUrl()).toBe(qa.REACT_APP_API_BASE_URL);
  expect(getApiBaseUrl({ preferLegacy:true })).toBe(qa.REACT_APP_API_BASE_URL);
  expect(getPublicApiBaseUrl()).toBe(qa.REACT_APP_API_BASE_URL);
});

test.each(['REACT_APP_API_BASE_URL','REACT_APP_API_URL','REACT_APP_SUPABASE_URL','REACT_APP_SUPABASE_ANON_KEY'])('QA refuses missing %s before use', key => {
  expect(() => resolveClientEnvironment({ ...qa, [key]:'' })).toThrow(/QA/);
});

test.each([
  'https://vpldffhsxhgnmitiikof.supabase.co', 'https://vpldffhsxhgnmitiikof.supabase.co.',
  'https://padbol-backend.onrender.com', 'https://padbol-backend.onrender.com.', 'https://auth.padbolmatch.com', 'https://www.padbolmatch.com',
  'https://api.padbolmatch.com', 'https://padbol-match-9abn.vercel.app', 'http://api.qa.example',
  'https://user:password@api.qa.example', 'https://api.qa.example?redirect=prod', 'https://api.qa.example/api', 'not-a-url',
])('QA refuses unsafe origin %s', value => {
  expect(() => resolveClientEnvironment({ ...qa, REACT_APP_API_BASE_URL:value, REACT_APP_API_URL:value })).toThrow(/QA/);
  expect(() => resolveClientEnvironment({ ...qa, REACT_APP_SUPABASE_URL:value })).toThrow(/QA/);
});

test('QA refuses disagreeing aliases and a reused API URL for Supabase', () => {
  expect(() => resolveClientEnvironment({ ...qa, REACT_APP_API_URL:'https://other.qa.example' })).toThrow(/same origin/);
  expect(() => resolveClientEnvironment({ ...qa, REACT_APP_SUPABASE_URL:qa.REACT_APP_API_BASE_URL })).toThrow(/respective isolated/);
});

test('QA accepts legacy anon JWT and rejects service-role, secret and known production public key', () => {
  const productionAnon = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({role:'anon',ref:'vpldffhsxhgnmitiikof'}))}.fixture`;
  expect(() => resolveClientEnvironment({ ...qa, REACT_APP_SUPABASE_ANON_KEY:productionAnon })).toThrow(/public Supabase/);
  const jwt = role => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({role}))}.fixture`;
  expect(resolveClientEnvironment({ ...qa, REACT_APP_SUPABASE_ANON_KEY:jwt('anon') }).isQA).toBe(true);
  for (const key of [jwt('service_role'),'sb_secret_fixture_not_real',PRODUCTION_SUPABASE_PUBLIC_KEY,'malformed']) {
    expect(() => resolveClientEnvironment({ ...qa, REACT_APP_SUPABASE_ANON_KEY:key })).toThrow(/public Supabase/);
  }
});

test('production defaults and relative public APIs keep their existing behavior', () => {
  process.env = {};
  expect(getApiBaseUrl()).toBe(PRODUCTION_API_URL);
  expect(getPublicApiBaseUrl()).toBe('');
  expect(getApiBaseUrl({ fallback:'http://127.0.0.1:3001' })).toBe('http://127.0.0.1:3001');
  expect(resolveClientEnvironment({})).toMatchObject({ variant:'production',isQA:false,supabaseUrl:'',supabaseAnonKey:'' });
});

test('production overrides remain supported, including the scoreboard legacy alias', () => {
  process.env = { REACT_APP_API_BASE_URL:'https://base.example/',REACT_APP_API_URL:'https://legacy.example/' };
  expect(getApiBaseUrl()).toBe('https://base.example');
  expect(getApiBaseUrl({ preferLegacy:true })).toBe('https://legacy.example');
});

test('a misspelled release environment cannot silently become production', () => {
  expect(() => resolveClientEnvironment({ ...qa, REACT_APP_APP_VARIANT:'QA' })).toThrow(/Unknown/);
});

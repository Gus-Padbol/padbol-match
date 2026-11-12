const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, previewOrigin } = require('./qa-preview-proxy.cjs');
const { qaBuildEnvironment } = require('./build-hosted-qa.cjs');
const env = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'candidate/qa-demo-gustavo-20261111', VERCEL_URL: 'padbol-qa-demo-fixture.vercel.app' };
const origin = `https://${env.VERCEL_URL}`;
const jwt = p => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(p)).toString('base64url')}.fixture`;
const token = jwt({ role: 'authenticated', iss: 'https://vxikhdulhuvghfqeutnp.supabase.co/auth/v1', ref: 'vxikhdulhuvghfqeutnp' });
async function run(request, settings = {}) {
 const calls = [];
 const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } };
 const handler = createHandler({ env, fetchImpl: async (url, options) => { calls.push({url, options}); return new Response('{"ok":true}', {status:200, headers:{'content-type':'application/json','set-cookie':'must-not-forward'}}); }, ...settings });
 await handler({method:'GET', url:'/api/torneos/57?public=true', headers:{}, ...request}, res);
 return { res, calls };
}
test('fixed QA target preserves public paths/query and only forwards user bearer/content type', async () => {
 const {res,calls} = await run({method:'POST',body:{value:1},headers:{origin,authorization:`Bearer ${token}`,'content-type':'application/json',cookie:'secret=not-forwarded','x-other':'no'}});
 assert.equal(res.code,200); assert.equal(calls[0].url,'https://padbol-backend-qa.onrender.com/api/torneos/57?public=true');
 assert.deepEqual(calls[0].options.headers,{Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
 assert.equal(calls[0].options.redirect,'error'); assert.equal(res.headers['Cache-Control'],'no-store'); assert.equal(res.headers['set-cookie'],undefined);
});
test('branch and production contexts fail closed before any upstream', async () => {
 for (const changed of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{VERCEL_URL:'padbol-match-9abn.vercel.app'}]) {
  assert.throws(()=>previewOrigin({...env,...changed})); const {calls,res}=await run({}, {env:{...env,...changed}});assert.equal(res.code,503);assert.equal(calls.length,0);
 }
});
test('unsafe origins, production/service-role tokens, open proxy and large bodies never reach upstream', async () => {
 const cases = [
  {method:'POST',headers:{},body:{}},
  {method:'POST',headers:{origin:'https://evil.example'},body:{}},
  {headers:{authorization:`Bearer ${jwt({role:'service_role',iss:'https://vxikhdulhuvghfqeutnp.supabase.co/auth/v1'})}`}},
  {headers:{authorization:`Bearer ${jwt({role:'authenticated',iss:'https://auth.padbolmatch.com/auth/v1'})}`}},
  {url:'https://evil.example/api/foo'}, {url:'/api/%2e%2e/private'}, {url:'/api/%252e%252e/private'},
  {method:'POST',headers:{origin},body:'a'.repeat(1024*1024+1)}
 ];
 for(const request of cases){const {calls,res}=await run(request);assert.ok(res.code>=400);assert.equal(calls.length,0);}
});
test('backend authorization response is preserved; timeout is generic without secrets',async()=>{
 let r=await run({}, {fetchImpl:async()=>new Response('{"code":"AUTH_REQUIRED"}',{status:401})});assert.equal(r.res.code,401);
 r=await run({}, {fetchImpl:async()=>{throw Error('secret detail')}});assert.equal(r.res.code,502);assert.equal(JSON.stringify(r.res.body).includes('secret'),false);
});
test('build sets isolated QA aliases and rejects production branch/key fallback',()=>{
 const key=jwt({role:'anon',ref:'vxikhdulhuvghfqeutnp'});
 const e=qaBuildEnvironment({...env,REACT_APP_SUPABASE_ANON_KEY:'sb_secret_must_be_overridden',REACT_APP_API_URL:'https://padbol-backend.onrender.com'});
 assert.ok(e.REACT_APP_SUPABASE_ANON_KEY.startsWith('eyJ'));
 assert.equal(e.REACT_APP_APP_VARIANT,'qa');assert.equal(e.REACT_APP_API_URL,origin);assert.equal(e.REACT_APP_API_BASE_URL,origin);assert.equal(e.REACT_APP_SUPABASE_URL,'https://vxikhdulhuvghfqeutnp.supabase.co');
 assert.throws(()=>qaBuildEnvironment({...env,VERCEL_ENV:'production'}));
 for(const bad of [{role:'service_role',ref:'vxikhdulhuvghfqeutnp'},{role:'anon',ref:'vpldffhsxhgnmitiikof'}])assert.throws(()=>qaBuildEnvironment(env,{projectRef:'vxikhdulhuvghfqeutnp',anonKey:jwt(bad)}));
 assert.throws(()=>qaBuildEnvironment(env,{projectRef:'vpldffhsxhgnmitiikof',anonKey:key}));
 assert.throws(()=>qaBuildEnvironment(env,{projectRef:'vxikhdulhuvghfqeutnp',anonKey:'sb_secret_never_allowed'}));
});

const { spawnSync } = require('node:child_process');
const { previewOrigin } = require('./qa-preview-proxy.cjs');
const publicQA = require('./qa-demo-public-client.json');
const { resolveClientEnvironment } = require('../src/config/clientEnvironment.js');
function qaBuildEnvironment(env, client = publicQA) {
  const origin = previewOrigin(env);
  const next = { ...env, CI: 'true', REACT_APP_APP_VARIANT: 'qa', REACT_APP_API_BASE_URL: origin, REACT_APP_API_URL: origin,
    REACT_APP_SUPABASE_URL: 'https://vxikhdulhuvghfqeutnp.supabase.co',
    REACT_APP_SUPABASE_ANON_KEY: client.anonKey };
  resolveClientEnvironment(next);
  if (client.projectRef !== 'vxikhdulhuvghfqeutnp') throw new Error('QA_PROJECT_REQUIRED');
  const key = next.REACT_APP_SUPABASE_ANON_KEY;
  if (key.startsWith('eyJ')) {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.ref !== 'vxikhdulhuvghfqeutnp' || payload.role !== 'anon') throw new Error('QA_PUBLIC_KEY_REQUIRED');
  } else throw new Error('QA_PROJECT_ANON_JWT_REQUIRED');
  return next;
}
if (require.main === module) {
  let env;
  try { env = qaBuildEnvironment(process.env); } catch { console.error('Hosted QA requires the exact preview branch and explicit QA public configuration.'); process.exit(1); }
  const result = spawnSync('npm', ['run', 'build'], { env, stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
module.exports = { qaBuildEnvironment };

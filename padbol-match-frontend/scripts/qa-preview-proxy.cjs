const BRANCH = 'candidate/qa-demo-gustavo-20261111';
const QA_REF = 'vxikhdulhuvghfqeutnp';
const TARGET = 'https://padbol-backend-qa.onrender.com';
const LIMIT = 1024 * 1024;
function previewOrigin(env) {
  if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== BRANCH || !/^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL || '') || env.VERCEL_URL === 'padbol-match-9abn.vercel.app') throw new Error('QA_PREVIEW_REQUIRED');
  return `https://${env.VERCEL_URL}`;
}
function validBearer(value) {
  if (!value) return true;
  if (!/^Bearer eyJ[A-Za-z0-9_.-]+$/.test(value)) return false;
  try {
    const token = value.slice(7).split('.');
    if (token.length !== 3) return false;
    const p = JSON.parse(Buffer.from(token[1], 'base64url').toString());
    return p.role === 'authenticated' && p.iss === `https://${QA_REF}.supabase.co/auth/v1` && (!p.ref || p.ref === QA_REF);
  } catch { return false; }
}
function createHandler({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const fail = (status, code) => res.status(status).json({ ok: false, code });
    let origin;
    try { origin = previewOrigin(env); } catch { return fail(503, 'QA_PREVIEW_REQUIRED'); }
    const method = String(req.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)) return fail(405, 'METHOD_NOT_ALLOWED');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site')) return fail(403, 'SAME_ORIGIN_REQUIRED');
    if (req.headers.origin && req.headers.origin !== origin) return fail(403, 'SAME_ORIGIN_REQUIRED');
    const authorization = req.headers.authorization;
    // Scope check only. The QA backend still verifies signature/session/roles.
    if (!validBearer(authorization)) return fail(403, 'QA_USER_TOKEN_REQUIRED');
    const rawPath = String(req.url || '').split('?')[0];
    let decoded;
    try { decoded = decodeURIComponent(rawPath); } catch { return fail(400, 'INVALID_PATH'); }
    if (!decoded.startsWith('/api/') || decoded.includes('\\') || decoded.includes('//') || decoded.split('/').some(s => s === '.' || s === '..') || /[\r\n\0]/.test(decoded) || /%[0-9a-f]{2}/i.test(decoded)) return fail(400, 'INVALID_PATH');
    const url = new URL(req.url, TARGET);
    if (url.origin !== TARGET || !url.pathname.startsWith('/api/')) return fail(400, 'INVALID_PATH');
    let body;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (Number(req.headers['content-length'] || 0) > LIMIT) return fail(413, 'BODY_TOO_LARGE');
      if (req.body !== undefined) body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      else {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > LIMIT) return fail(413, 'BODY_TOO_LARGE'); chunks.push(Buffer.from(chunk)); }
        body = Buffer.concat(chunks);
      }
      if (body.length > LIMIT) return fail(413, 'BODY_TOO_LARGE');
    }
    const headers = {};
    if (authorization) headers.Authorization = authorization;
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    try {
      const upstream = await fetchImpl(url.toString(), { method, headers, body, signal: AbortSignal.timeout(15000), redirect: 'error' });
      const content = Buffer.from(await upstream.arrayBuffer());
      if (content.length > 8 * LIMIT) return fail(502, 'QA_RESPONSE_TOO_LARGE');
      if (upstream.headers.get('content-type')) res.setHeader('Content-Type', upstream.headers.get('content-type'));
      return res.status(upstream.status).send(content);
    } catch { return fail(502, 'QA_UPSTREAM_UNAVAILABLE'); }
  };
}
module.exports = { createHandler, previewOrigin, validBearer };

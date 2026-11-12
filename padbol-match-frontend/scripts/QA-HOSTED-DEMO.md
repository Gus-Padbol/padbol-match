# QA demo only

This branch is an isolated Preview of the same application. Do not merge its Vercel build command or API proxy into main.

The build and proxy require `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=candidate/qa-demo-gustavo-20261111` and an isolated `VERCEL_URL` under vercel.app. The build sets both API aliases to this Preview and Supabase to project vxikhdulhuvghfqeutnp. The explicitly public browser anon key is recorded in qa-demo-public-client.json with its QA project ref; the guarded build validates JWT role anon and exact ref and overrides any inherited project client configuration. It is not a server credential. Service-role or secret keys fail closed.

The explicit static API function plus `/api/:path*` rewrite forwards only validated `/api/` paths to the fixed QA backend. It does not forward cookies, Origin, arbitrary request headers, redirects, credentials, or arbitrary targets. Authenticated calls require a QA user-token scope and the backend remains responsible for actual JWT signature/session/role authorization. Unsafe browser methods require the exact Preview Origin. The API has no public CORS relaxation and uses no-store responses.

Checks: `node --test scripts/qa-preview.test.cjs`. A real CI build can run `node scripts/build-hosted-qa.cjs` only with the explicit Preview context and QA public key. Do not run `--prod`, promote, or assign production aliases. The coordinator alone publishes the branch.

After Git Preview deployment, verify app/deep routes from an unauthenticated internet client without Vercel SSO protection, then sign in normally to QA on that exact origin. Existing localhost authentication does not transfer. Verify public fixture roster/groups and authenticated registration/staff independently; no fixture credentials in source or links.

Socket.IO is bridged only as same-origin Engine.IO4 HTTP polling via `/socket.io/` to fixed QA backend. WebSocket upgrades are rejected; the existing client polling transport remains the supported fallback. Poll requests allow40seconds and the Vercel function maxDuration is60seconds. Session query/body pass through without token logging; backend authenticates the actual Socket.IO session. This is not proof of a live connection until the deployed Preview handshake/update smoke passes.

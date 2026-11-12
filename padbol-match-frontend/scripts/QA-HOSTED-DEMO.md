# QA demo only

This branch is an isolated Preview of the same application. Do not merge its Vercel build command or API proxy into main.

The build and proxy require `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=candidate/qa-demo-gustavo-20261111` and an isolated `VERCEL_URL` under vercel.app. The build sets both API aliases to this Preview and Supabase to project vxikhdulhuvghfqeutnp. Configure the existing QA public anon key as `QA_DEMO_SUPABASE_ANON_KEY` (or the QA legacy anon JWT as `REACT_APP_SUPABASE_ANON_KEY`). Never configure service-role or secret keys. Production defaults fail closed.

The API catch-all forwards only `/api/` paths to the fixed QA backend. It does not forward cookies, Origin, arbitrary request headers, redirects, credentials, or arbitrary targets. Authenticated calls require a QA user-token scope and the backend remains responsible for actual JWT signature/session/role authorization. Unsafe browser methods require the exact Preview Origin. The API has no public CORS relaxation and uses no-store responses.

Checks: `node --test scripts/qa-preview.test.cjs`. A real CI build can run `node scripts/build-hosted-qa.cjs` only with the explicit Preview context and QA public key. Do not run `--prod`, promote, or assign production aliases. The coordinator alone publishes the branch.

After Git Preview deployment, verify app/deep routes from an unauthenticated internet client without Vercel SSO protection, then sign in normally to QA on that exact origin. Existing localhost authentication does not transfer. Verify public fixture roster/groups and authenticated registration/staff independently; no fixture credentials in source or links.

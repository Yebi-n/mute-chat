# Adult Web Flow Setup

Updated: 2026-06-19

## Goal

- Current implementation priority is iOS.
- Android adult-tab behavior is documented for later implementation, not part of the current iOS pass.
- Adult tabs must not appear before adult verification on either platform.
- Adult rooms must never appear in the `프로모션` tab.
- Adult rooms must not be eligible for the free `프로모션` action from the chat-room plus menu.

See the platform-specific source of truth:

- `docs/ADULT_VERIFICATION_PLATFORM_POLICY.md`

## Added pieces

- Static web page: `web/operations-policy/index.html`
  - phone + password login only
  - shows verification status
  - starts adult verification
  - enables iOS adult access after verification
  - should be deployed to a real static host such as Vercel / Cloudflare Pages / Netlify

- Edge function: `operations-policy`
  - redirects to `OPERATIONS_POLICY_PORTAL_URL` when that secret is set
  - keep as fallback/debug artifact only
  - not recommended as the production portal host

- Edge function: `adult-verification-callback`
  - trusted callback endpoint
  - marks user as verified
  - enables iOS adult-content access
  - redirects back to the policy portal

- Migration: `202606190002_verification_status_v2.sql`
  - extends `get_my_verification_status()` to include:
    - `adult_content_web_opted_in`
    - `ios_adult_content_enabled`

## Required secrets

Set these in Supabase Edge Functions secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADULT_VERIFICATION_START_URL`
- `ADULT_VERIFICATION_CALLBACK_SECRET`
- `ADULT_VERIFICATION_CI_SALT` (recommended)
- `OPERATIONS_POLICY_PORTAL_URL`
  - required if anyone opens the Supabase `operations-policy` function URL
  - should point to the static web portal root
- `ADULT_VERIFICATION_TEST_MODE` (optional staging-only fallback)

Optional app env:

- `EXPO_PUBLIC_OPERATIONS_POLICY_URL`
  - required for the real web portal host
  - do not rely on the Supabase `operations-policy` Edge Function as the production page host

## Provider integration reality

This repo now has the web portal and trusted callback shape, but the final provider contract still matters.

The provider must be able to send, directly or through your own broker:

- `user_id`
- adult-verification success state
- optional `ci`
- shared secret or equivalent trusted signature

Current callback expects:

- query or form field `token`
- matching `ADULT_VERIFICATION_CALLBACK_SECRET`

and success via one of:

- `adult_verified=1`
- `verified=1`
- `adult=1`

If your provider uses a different callback/signature format, `adult-verification-callback` must be adapted before production release.

## Staging without provider contract

To keep cost low and still test the full browser-to-app loop before the real provider contract is ready, this repo now supports a staging fallback.

Required for that fallback:

- `ADULT_VERIFICATION_TEST_MODE=true`
- `ADULT_VERIFICATION_CALLBACK_SECRET=<same callback secret>`
- `OPERATIONS_POLICY_PORTAL_URL=https://<your-static-domain>/`

When enabled and `ADULT_VERIFICATION_START_URL` is empty:

- `start-adult-verification` returns a mock success URL
- the browser is redirected into `adult-verification-callback`
- the callback marks:
  - `adult_verified_at`
  - `identity_verified_at`
  - `adult_content_web_opt_in_at`
  - `ios_adult_content_enabled = true`

Use this only for staging and QA. Production must use a real provider.

## Deploy sequence

1. push migration

```bash
npx supabase db push
```

2. deploy edge functions

```bash
npx supabase functions deploy adult-verification-callback
npx supabase functions deploy start-adult-verification
```

3. deploy the static portal

Recommended:

- Vercel
- Cloudflare Pages
- Netlify

Required runtime values in the static page:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

4. verify `get_my_verification_status()` returns 5 fields

5. open the deployed static portal URL

Example:

`https://<your-static-domain>/`

6. log in with phone + password

7. verify callback updates:

- `users.identity_verified_at`
- `users.adult_verified_at`
- `users.identity_provider`
- `users.adult_content_web_opt_in_at`
- `users.ios_adult_content_enabled`

## Review risk

Showing an explicit adult tab on iOS, even after web verification, still increases App Review risk.

Safer variant:

- keep the iOS adult tab hidden entirely
- allow direct adult-room access only after web opt-in
- do not expose in-app bypass guidance

Current implementation follows the product request, not the lowest-risk App Review posture.

## Current platform split to preserve

- iOS build: current implementation target.
- Android build: defer code changes until the Android pass.
- Shared discovery restriction: promotion surfaces must exclude adult rooms entirely.

## Important note about Supabase Edge Functions

In this project, the Edge Function route returned the HTML body but the gateway still served it with `Content-Type: text/plain`. Because of that, browsers displayed raw HTML source instead of rendering the page. For this reason, the production portal should be hosted as a static site, and Supabase Edge Functions should be used only for:

- starting adult verification
- receiving trusted provider callbacks

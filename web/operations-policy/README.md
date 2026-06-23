# Operations Policy Portal

This folder is the production web portal for:

- phone + password login
- adult verification entry
- iOS adult-content opt-in

## Files

- `index.html`
- `config.js` (create from `config.example.js`)
- `vercel.json`

## Local preparation

1. Copy:

```text
config.example.js -> config.js
```

2. Fill in:

- `window.__MUTE_SUPABASE_URL__`
- `window.__MUTE_SUPABASE_ANON_KEY__`

## Recommended hosting

If cost minimization is the first priority, use a static host first:

1. Cloudflare Pages
2. Vercel
3. Netlify

This portal is plain static HTML/CSS/JS, so there is no reason to pay for server-side rendering here.

## Vercel deployment

Deploy this folder itself:

```text
C:\Users\trudy\mute-chat\web\operations-policy
```

After deployment, the portal URL should look like:

```text
https://<your-vercel-domain>/
```

## Cloudflare Pages deployment

Deploy this folder as a static site:

```text
C:\Users\trudy\mute-chat\web\operations-policy
```

The portal root URL should be:

```text
https://<your-pages-domain>/
```

## App env

Set:

```text
EXPO_PUBLIC_OPERATIONS_POLICY_URL=https://<your-vercel-domain>/
```

## Required Supabase functions

- `start-adult-verification`
- `adult-verification-callback`

## Required Supabase secrets

- `ADULT_VERIFICATION_START_URL`
- `ADULT_VERIFICATION_CALLBACK_SECRET`
- `ADULT_VERIFICATION_CI_SALT`
- `OPERATIONS_POLICY_PORTAL_URL`

## Low-cost test mode

Before a real identity-verification provider contract is ready, you can still test the full browser-to-app loop.

Set:

- `ADULT_VERIFICATION_TEST_MODE=true`
- `ADULT_VERIFICATION_CALLBACK_SECRET`
- `OPERATIONS_POLICY_PORTAL_URL=https://<your-static-domain>/`

Behavior:

- `start-adult-verification` returns a mock success URL
- that URL redirects through `adult-verification-callback`
- the callback marks the current user as adult-verified and enables iOS adult access

Use this only for staging and operator QA. Remove test mode before production release.

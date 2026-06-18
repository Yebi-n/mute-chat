# Mute Handoff

Updated: 2026-06-18

This document is for handing the project to another Codex/operator so they can continue immediately without reconstructing context.

## 1. Project identity

- App name: `뮤트`
- English name: `Mute`
- Local workspace: `C:\Users\trudy\mute-chat`
- Current app version: `0.1.0`
- Frontend stack:
  - Expo `~56.0.11`
  - React `19.2.3`
  - React Native `0.85.3`
  - TypeScript `~6.0.3`
- Backend stack:
  - Supabase
  - Supabase Auth
  - Supabase Realtime / Postgres-backed room, story, chat features
- Monetization libraries already installed:
  - `react-native-google-mobile-ads`
  - `react-native-purchases`

## 2. Current architecture reality

The app is still heavily concentrated in one file.

- Main UI file: `App.tsx`
- Theme file: `src/theme.ts`
- Mock room/story seed data: `src/mockData.ts`
- Service layer: `src/services/*`
- Supabase client: `src/lib/supabase`

Practical note:

- A large amount of UI state, navigation state, and dummy behavior still lives in `App.tsx`.
- Before major refactors, stabilize behavior first. This repo is still in feature-integration mode, not cleanup mode.

## 3. Local run commands

From `C:\Users\trudy\mute-chat`:

```bash
npm install
npm run start
npm run web
npm run android
npm run ios
npm run typecheck
```

Preview build commands already defined:

```bash
npm run preview:android
npm run preview:ios
```

These map to:

- `eas build --profile preview --platform android`
- `eas build --profile preview --platform ios`

## 4. Mobile testing reality

### 4.1 Expo Go / web preview

The project has been tested through Expo web tunnel links such as `https://*.exp.direct`.

Important constraints:

- Those links are temporary.
- Old links die and show `ERR_NGROK_3200`.
- If the user says the page is white, first suspect:
  - stale tunnel link
  - stale browser cache
  - a web-only runtime crash in `App.tsx`

Practical workflow:

1. Start Expo again.
2. Use a fresh tunnel link.
3. Ask the tester to close the old tab fully and reopen the new link.

### 4.2 Expo Go compatibility

There was already one failure where Expo Go on iPhone said the project required a newer Expo Go version.

Implication:

- For iPhone testing, do not assume Expo Go will always work.
- Web tunnel is the fastest fallback.
- For realistic device QA, preview builds are the right path once Apple side is ready.

### 4.3 iPhone preview path

TestFlight is not usable until the Apple developer account is active and app signing flow is available.

Current status:

- Apple developer side was described as pending approval / not fully ready yet.
- Treat iOS store/distribution setup as not finalized.

## 5. Backend environment

### 5.1 Supabase

Supabase project is already linked.

- Project ref: `oxanqrmkvyniocxwreia`
- Base URL pattern: `https://oxanqrmkvyniocxwreia.supabase.co`

Previously completed:

```bash
npx supabase link --project-ref oxanqrmkvyniocxwreia
```

If schema changes need to be pushed:

```bash
npx supabase db push
```

### 5.2 Environment handling

Do not expose secrets in code or docs.

Expected model:

- publishable key in app env
- secret/service-role only in server-side or dashboard-side configuration

### 5.3 SMS authentication

Phone auth is implemented with:

- phone number + password login/signup UX in app
- SMS OTP delivery

There was active work using Solapi for SMS delivery.

Important operational fact:

- Solapi credit balance matters
- OTP can appear to fail if credits are exhausted or provider-side delivery is blocked

### 5.4 Auth hook / provider setup

There was a manual setup step involving:

- Solapi API key
- Solapi API secret
- registered sender number
- Supabase Auth hook secret (`whsec_...`)

This means the next operator should verify:

1. Supabase Auth hooks are still configured.
2. Solapi sender number is still registered.
3. SMS balance is available.
4. OTP requests still reach Korean numbers in E.164 format.

## 6. Authentication status

Current auth direction is:

- login: phone number + password
- signup: phone verification first, then password creation
- password recovery: low-cost SMS OTP based reset flow

User-observed behavior that was already addressed during this project:

- phone number normalization
- OTP send/verify flow
- signup reveal UX after SMS request
- already-verified state locking inputs

If auth breaks again, inspect:

- `src/services/auth`
- Supabase auth logs
- Solapi delivery balance and hook state

## 7. Adult verification status

Adult verification is planned and some UI exists, but provider-side operational setup is not finished.

Interpretation:

- UI path exists
- real provider integration is not production-complete
- do not promise live compliance until provider contract/dashboard settings are verified

Related legal/compliance planning already exists in:

- `docs/STORE_COMPLIANCE.md`

## 8. Current product state

The app already contains substantial UI and partial backend integration for:

- phone auth
- room discovery
- room detail
- room create
- room-specific profiles
- chat UI
- story UI
- story comments
- join request flows
- blocked member list
- room moderation entry points
- top space / ranking concepts
- points / wallet screens
- notification drawer

But not all behaviors are production-hard yet. Some are still dummy-data backed.

## 9. Known implementation pattern

A lot of screens switch by local state instead of a formal navigation library.

Examples:

- `screen`
- `bottomTab`
- `panel`
- `selectedRoom`
- `selected` story state

This is workable for now, but easy to break with nested back behavior.

Rule for future edits:

- when adding a new screen path, check the full back-stack manually
- chat -> drawer -> overview -> story list -> story detail is especially easy to regress

## 10. Current high-risk areas

These areas should be treated as fragile:

1. `App.tsx` story navigation and nested back behavior
2. Expo web behavior vs native behavior
3. Image upload / crop / optimization paths
4. OTP timing and resend state
5. Dummy data mixed with live Supabase behavior
6. Chat-specific system messages and visual variants

## 11. Recent UX decisions that should not be silently reverted

- Joined rooms from `내 채팅` should enter chat directly, not room detail.
- Story chat preview `바로가기` should open that story detail, not the story list first.
- In chat-side story flow, back behavior should be:
  - story detail -> story list
  - story list -> chat
- Room detail in chat-side entry should expose profile/story tabs.
- Some panels are intentionally read-only for super-admin observation.
- Default room visuals should stay calm and low-noise.
- Chat long-message collapse rule is documented separately:
  - see `docs/CHAT_MESSAGE_RULES.md`

## 12. Existing docs worth reading first

Start with these:

- `docs/ACTION_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_SPEC.md`
- `docs/IMPLEMENTATION_AUDIT.md`
- `docs/CHAT_MESSAGE_RULES.md`
- `docs/STORE_COMPLIANCE.md`
- `docs/MONETIZATION_SETUP.md`
- `docs/PUSH_OPERATIONS.md`
- `docs/AUTH_PHONE_PASSWORD.md`

Recommended reading order for a new operator:

1. this handoff
2. `ARCHITECTURE`
3. `PRODUCT_SPEC`
4. `IMPLEMENTATION_AUDIT`
5. `AUTH_PHONE_PASSWORD`
6. `STORE_COMPLIANCE`

## 13. What is already decided strategically

These are not open questions anymore unless the owner changes them explicitly:

- product name is `뮤트 / Mute`
- visual direction is simple, light, white-based, soft corners, mint/green accents
- phone number + password is the auth direction
- server cost minimization matters
- iOS and Android both matter
- adult area should be compliance-safe and store-review-safe
- monetization should combine points, ads, and paid cosmetic/features

## 14. Monetization direction

Already discussed and partially scaffolded:

- top space boosting
- paid bubble/text colors
- custom color purchase
- ad-free monthly account
- attendance rewards
- rewarded ads for extra points

Installed libraries suggest intended direction:

- RevenueCat / purchases
- Google mobile ads

Do not assume the store products are fully configured in dashboard just because client code exists.

## 15. Deployment / release reality

Current release mode is still development-preview oriented.

Practical deployment stages:

1. local Expo start / web test
2. Android preview build via EAS
3. iOS preview/TestFlight once Apple developer account is active
4. store submission only after adult verification, moderation, auth, and payment compliance are verified

## 16. What another Codex should do first

If a new Codex session takes over, first actions should be:

1. open `C:\Users\trudy\mute-chat`
2. read this file
3. read `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_AUDIT.md`, `docs/AUTH_PHONE_PASSWORD.md`
4. inspect `App.tsx`
5. run `npm run typecheck`
6. start Expo with a fresh tunnel if live QA is needed
7. verify Supabase project link still points to `oxanqrmkvyniocxwreia`

## 17. If live QA breaks

Use this triage order:

1. Is the tunnel link dead?
2. Is the browser using an old cached bundle?
3. Did `App.tsx` introduce a runtime crash?
4. Is Supabase unavailable?
5. Is Solapi balance / OTP delivery failing?

## 18. Missing confirmations the next operator should verify explicitly

These are important enough to re-check, not assume:

- Apple developer account activation status
- EAS login/build readiness
- RevenueCat/store product dashboard state
- Google Mobile Ads app/unit setup
- Solapi sender-number validity
- Supabase auth hook health
- adult verification provider contract / integration status

## 19. Current working rule for edits

- Prefer targeted patches, not repo-wide refactors.
- Use existing component and state patterns in `App.tsx`.
- Verify nested navigation after every story/chat/detail change.
- Treat user-facing wording changes as product decisions, not cosmetic churn.

## 20. Summary

This repo is not a fresh scaffold. It is an already-iterated product prototype with:

- real Supabase linkage
- real SMS auth work
- substantial UI surface
- mixed production and demo behaviors

A new Codex should continue from `C:\Users\trudy\mute-chat`, preserve the current direction, and stabilize behavior before attempting broad architecture cleanup.

## 21. Current iOS / TestFlight workflow

Important distinction:

- `build` is not the same thing as `TestFlight delivery`
- `build` creates the iOS binary on EAS
- `submit` uploads that built binary to App Store Connect / TestFlight

Current commands:

```powershell
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

Why `production` for TestFlight:

- `eas.json` currently has `preview.distribution = internal`
- that profile triggers device-registration flow for ad hoc/internal installs
- that is why EAS shows the `register-device` link
- for TestFlight, use `production` unless `preview` is explicitly changed to store distribution

Current `eas.json` reality:

- `development`: internal dev client
- `preview`: internal distribution
- `production`: store-style build path

If another operator wants `npm run preview:ios` to behave like TestFlight, they must first change `eas.json`. Do not assume the existing `preview` profile is for TestFlight.

## 22. Current live app state as of 2026-06-18

Recently implemented in `App.tsx`:

- room detail page title / hashtag spacing adjusted
- main header logo size reduced and left spacing adjusted
- create-room cover selector changed to centered circular 1:1 button
- private-room join now requires 6-digit PIN entry
- chat `+` menu now includes owner-only `프로모션`
- promotion has 15-minute cooldown per room
- if cooldown is active, toast shows remaining minutes
- discover/promotion list now sorts by latest promotion timestamp first
- promotion list hides the `[몇 분 전]` activity label
- adult rooms are hidden from promotion list for non-verified users
- adult rooms in discover/promotion list are blurred until opened
- missing style keys added; `npm run typecheck` passes after these changes

Still important:

- EAS build was not run from Codex because external upload actions are policy-blocked in-tool
- operator must run build and submit commands locally
- after build/upload, verify the new binary appears in App Store Connect before expecting it in TestFlight

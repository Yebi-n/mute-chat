# Mute Handoff

Updated: 2026-06-19

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
  - `expo-iap`

## 2. Current architecture reality

The app is still heavily concentrated in one file.

- Main UI file: `App.tsx`
- Theme file: `src/theme.ts`
- Mock room/story seed data: `src/mockData.ts`
- Service layer: `src/services/*`
- Supabase client: `src/lib/supabase`

Practical notes:

- A large amount of UI state, navigation state, and dummy behavior still lives in `App.tsx`.
- Before major refactors, stabilize behavior first.
- This repo is still in feature-integration mode, not cleanup mode.

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

Preview commands already defined:

```bash
npm run preview:android
npm run preview:ios
```

Those scripts map to EAS preview builds, but `preview` is currently `internal` distribution, not TestFlight distribution.

## 4. Mobile testing reality

### 4.1 Web / tunnel preview

The project has been tested through Expo web tunnel links such as `https://*.exp.direct`.

Important constraints:

- those links are temporary
- old links die and can show `ERR_NGROK_3200`
- if the page is white, first suspect:
  - stale tunnel link
  - stale browser cache
  - a web-only runtime crash in `App.tsx`

Practical workflow:

1. start Expo again
2. use a fresh tunnel link
3. close the old browser tab fully
4. reopen the new link

### 4.2 iPhone testing

Expo Go has already failed once because the project required a newer Expo Go version.

Implication:

- do not assume Expo Go is stable enough for iPhone QA
- web tunnel is the fastest fallback
- TestFlight is the real QA path for device testing

### 4.3 Current iOS distribution reality

Apple Developer is active and TestFlight delivery is already being used.

Important distinction:

- `build` creates an iOS binary on EAS
- `submit` uploads that binary to App Store Connect / TestFlight

Current commands:

```powershell
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

Why `production` matters:

- `eas.json` has `preview.distribution = internal`
- that is why `preview` triggers device-registration flow
- for TestFlight, use `production` unless `eas.json` is changed

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

Operational facts:

- Solapi credit balance matters
- sender-number registration matters
- OTP can appear to fail if credits are exhausted or provider-side delivery is blocked
- Supabase Auth hook configuration is part of this path

### 5.4 Auth hook / provider setup

There was a manual setup step involving:

- Solapi API key
- Solapi API secret
- registered sender number
- Supabase Auth hook secret (`whsec_...`)

A new operator should verify:

1. Supabase Auth hooks are still configured
2. Solapi sender number is still registered
3. SMS balance is available
4. OTP requests still reach Korean numbers in E.164 format

## 6. Authentication status

Current auth direction is:

- login: phone number + password
- signup: phone verification first, then password creation
- password recovery: low-cost SMS OTP based reset flow

If auth breaks again, inspect:

- `src/services/auth`
- `src/services/verification.ts`
- Supabase auth logs
- Solapi balance and delivery state

## 7. Adult content / age-gate status

This is now an App Review and operations issue, not just a UI issue.

Current working rule:

- do not expose an explicit adult tab on iOS
- do not expose in-app adult verification on iOS
- do not expose in-app instructions that tell users how to bypass iOS restrictions
- if adult access exists, it should be web-controlled and hidden by default for iOS users
- Android release plan is intentionally separate:
  - before adult verification, keep the adult tab hidden
  - after adult verification, the adult tab may be shown on Android only
  - in room creation, keep the adult category visible but disabled until verification completes
- on both iOS and Android:
  - adult rooms must never appear in the `프로모션` tab
  - adult rooms must not expose the free `프로모션` action in the chat-room plus menu

Why:

- Apple App Review Guidelines `1.1.4` prohibit pornographic or overtly sexual content/apps
- Apple App Review Guidelines `1.2` require objectionable-content filtering, reporting, blocking, and contactability for UGC apps
- Apple also warns that apps used primarily for anonymous chat, Chatroulette-style experiences, or pornographic content may be removed
- Apple allows incidental mature NSFW from a web-based service only when it is hidden by default and enabled on the web

Implementation direction that should be preserved:

- remove explicit adult-area discovery UI from iOS-facing app surfaces
- treat adult access as a server-side capability flag, not a client-only toggle
- gate iOS adult visibility with backend fields for web opt-in style control
- keep reporting, blocking, moderation filtering, and operator review flows mandatory for store safety

What still needs explicit product/legal confirmation:

- exact external web verification flow
- exact wording for iOS blocked-access messaging
- moderation SLA and operator workflow
- whether Android and web will have different discovery behavior than iOS

Related docs:

- `docs/ADULT_VERIFICATION_PLATFORM_POLICY.md`
- `docs/ADULT_WEB_FLOW_SETUP.md`
- `docs/STORE_COMPLIANCE.md`
- `docs/AUTH_PHONE_PASSWORD.md`
- `docs/BUILD_DISTRIBUTION_COST.md`: iOS/Android build, OTA update, and CI cost strategy

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
3. image upload / crop / optimization paths
4. OTP timing and resend state
5. dummy data mixed with live Supabase behavior
6. chat-specific system messages and visual variants
7. keyboard-avoidance and safe-area handling on iPhone

## 11. Recent UX decisions that should not be silently reverted

- joined rooms from `내 채팅` should enter chat directly, not room detail
- story chat preview `바로가기` should open that story detail, not the story list first
- in chat-side story flow, back behavior should be:
  - story detail -> story list
  - story list -> chat
- room detail in chat-side entry should expose profile/story tabs
- some panels are intentionally read-only for super-admin observation
- default room visuals should stay calm and low-noise
- chat long-message collapse rule is documented separately:
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

## 13. Strategic decisions already made

These are not open questions anymore unless the owner changes them explicitly:

- product name is `뮤트 / Mute`
- visual direction is simple, light, white-based, soft corners, mint/green accents
- phone number + password is the auth direction
- server cost minimization matters
- iOS and Android both matter
- adult-area handling must be compliance-safe and store-review-safe
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

- `expo-iap` with Supabase direct StoreKit verification
- Google mobile ads

Do not assume store products are fully configured in dashboard just because client code exists.

## 15. Deployment / release reality

Current release mode is still stabilization-first.

Practical deployment stages:

1. local Expo start / web test
2. Android preview build via EAS
3. iOS TestFlight via EAS production build + submit
4. store submission only after adult-content policy, moderation, auth, and payment compliance are verified

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

1. is the tunnel link dead?
2. is the browser using an old cached bundle?
3. did `App.tsx` introduce a runtime crash?
4. is Supabase unavailable?
5. is Solapi balance / OTP delivery failing?

## 18. Missing confirmations the next operator should verify explicitly

These are important enough to re-check, not assume:

- Apple Developer / App Store Connect access state
- EAS login/build readiness
- App Store Connect product / StoreKit key state
- Google Mobile Ads app/unit setup
- Solapi sender-number validity
- Supabase auth hook health
- adult-content provider / web flow / policy status

## 19. Additional docs that should be written next

These do not all need to exist immediately, but they should exist before release:

- `docs/APP_REVIEW_NOTES.md`
  - reviewer-facing explanation of auth, reporting, blocking, moderation, and hidden adult-content handling
- `docs/ADULT_CONTENT_POLICY.md`
  - exact iOS/Android/web behavior split, hidden-by-default rule, and blocked-access copy
- `docs/MODERATION_POLICY.md`
  - report triage, banned-content policy, escalation path, evidence retention, and response targets
- `docs/OPERATIONS_RUNBOOK.md`
  - Supabase, SMS, ads, purchases, push, and incident recovery checklist
- `docs/PRIVACY_DATA_MAP.md`
  - what user data is stored, where, why, retention period, and deletion flow
- `docs/APP_STORE_METADATA_CHECKLIST.md`
  - screenshots, privacy labels, review notes, test accounts, and release gating checklist

## 20. Additional release considerations

Before store submission, another operator should also verify:

- report flow works for room, member, story, image, and message surfaces
- block flow actually suppresses future interaction where intended
- banned-word / moderation filter behavior is server-enforced, not only client-enforced
- private-room PIN flow is enforced server-side
- super-admin powers are isolated and not visible to ordinary members
- TestFlight build uses `production` profile, not `preview`
- iOS content-policy behavior is tested separately from Android/web behavior

## 21. Current working rule for edits

- prefer targeted patches, not repo-wide refactors
- use existing component and state patterns in `App.tsx`
- verify nested navigation after every story/chat/detail change
- treat user-facing wording changes as product decisions, not cosmetic churn

## 22. Current live app state as of 2026-06-19

Recently implemented in `App.tsx`:

- room detail page title / hashtag spacing adjusted
- main header logo size reduced and left spacing adjusted
- create-room cover selector changed to centered circular 1:1 button
- private-room join now requires 6-digit PIN entry
- chat `+` menu includes owner-only promotion entry
- promotion has 15-minute cooldown per room
- discover/promotion list sorts by latest promotion timestamp first
- adult rooms are hidden from promotion list for non-verified users
- adult rooms in discover/promotion list are blurred until opened
- story time formatting suppresses raw ISO `T...Z` leakage and falls back to `방금` on invalid values
- story detail can open its linked room directly
- duplicate internal story headers were reduced in one path and still require device regression testing
- join-request approve button uses gradient styling
- chat composer `+` and brush buttons dismiss keyboard/drawer/search before opening menus
- my own avatar in chat renders on the right side with my message
- profile save button and create-room primary action use gradient treatment
- `npm run typecheck` was green after these updates

## 23. Summary

This repo is not a fresh scaffold. It is an already-iterated product prototype with:

- real Supabase linkage
- real SMS auth work
- substantial UI surface
- mixed production and demo behaviors

A new Codex should continue from `C:\Users\trudy\mute-chat`, preserve the current direction, and stabilize behavior before attempting broad architecture cleanup.

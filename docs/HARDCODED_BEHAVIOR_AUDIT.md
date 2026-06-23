# Hardcoded Behavior Audit

Updated: 2026-06-21

This document tracks hardcoded/demo behavior that can make TestFlight QA pass
even when the real server-backed behavior is missing or wrong.

## Intentional demo data

Keep only one explicit demo room for showing every UI type.

- `App.tsx:53-69`
  - `DEMO_ROOM_ID`, `DEMO_ROOM`, `DEMO_PUBLIC_STORY_ROOM`
  - Purpose: sample room for chat types, stories, application states, system lines.
  - Current: the sample room remains visible as one explicit sample room, but it
    is no longer injected into joined room IDs or owner room IDs.
  - Rule: any future demo content must stay behind `DEMO_ROOM_ID` or an explicit
    `isSample` flag. Do not use demo members/stories as fallback for real rooms.

- `App.tsx:1370-1381`
  - Demo chat messages for the demo room.
  - Purpose: show long-message collapse, story preview, system notices, secret
    note, image, heart, leave/kick/room-update notices.
  - Risk: if similar message types do not appear from Supabase, QA may still look
    complete because the demo room works.

- `App.tsx:1671-1706`
  - `initialStoryItems()`
  - Purpose: sample story list and detail rendering.
  - Risk: public story QA can pass while real `stories/story_blocks/story_comments`
    paths are broken.

## High-priority hardcoded UX to replace

1. My-room unread badge
   - `App.tsx:1157`
   - Fixed: real rooms now derive unread counts from server
     `room_read_receipts`; demo/offline mode keeps local fallback.
   - Related implementation notes: `docs/READ_RECEIPTS_TODO.md`.

2. Notification drawer data
   - `App.tsx:2368-2376`
   - Fixed: now reads `user_notifications`; server `read_at` tracks read/unread
     state. `push_outbox` remains a delivery queue only.

3. Room detail creation date
   - `App.tsx:1282`
   - Fixed: uses `rooms.created_at`.

4. Chat date divider
   - `App.tsx:1645`
   - Fixed: visible messages are grouped by each message's `createdAt`.
   - Remaining: pending join-request notices still render outside the grouped
     message stream; this is acceptable short-term because only staff see them.

5. Room overview members/stories
   - `App.tsx:2093`
   - Fixed: real rooms now use `listRoomMembers()` and `listStories()`. Demo
     room still uses demo data.

6. Demo members outside the demo room
   - `App.tsx:125-158`, `App.tsx:1332`
   - Fixed: `ROOM_MEMBERS` fallback is restricted to `DEMO_ROOM_ID` for the
     current user's room profile.

## Medium-priority hardcoded behavior

1. Activity fallback time
   - `App.tsx:142-143`, `App.tsx:1115`, `App.tsx:1122`, `App.tsx:1152`,
     `App.tsx:1157`
   - Fixed: real rooms use server `rooms.updated_at`. `ROOM_UPDATED_AT` is
     restricted to `DEMO_ROOM_ID`.

2. Locally appended system events
   - `App.tsx:1454`, `App.tsx:1466`, story preview append around `App.tsx:1612`
   - Current: heart and secret messages now call `send_room_message`; point
     transfer now calls `transfer_room_points`, which updates balances, writes
     point ledger rows, and stores a system message.
   - Fixed: story-created preview now stores `messages.story_id` through
     `announce_story_created()` and renders from server messages.

3. Point log
   - `App.tsx:2140`
   - Fixed: reads `point_ledger` and computes displayed balance from current
     wallet balance.

4. Adult verification test mode
   - `supabase/functions/start-adult-verification/index.ts`
   - Current: supports mock verification when `ADULT_VERIFICATION_TEST_MODE=true`.
   - Needed: keep only for staging; production must use a real provider.

5. Web rewarded-ad fallback
   - `src/services/monetization.web.ts`
   - Current: always completes after a delay.
   - Needed: acceptable for web preview only; native builds should use AdMob path.

6. Adult verification provider callback
   - `supabase/functions/start-adult-verification/index.ts`
   - `supabase/functions/adult-verification-callback/index.ts`
   - Current: the external page and callback still include staging/provider
     placeholder behavior.
   - Must not ship: query-param-only verification. Production must verify the
     provider transaction signature/result server-side before setting
     `adult_verified_at`, `adult_content_web_opt_in_at`, or
     `ios_adult_content_enabled`.

7. Existing adult notification rows
   - `supabase/migrations/202606210004_adult_notification_filter.sql`
   - Fixed for new events: adult rooms no longer enqueue new chat/join-request
     notifications or push outbox rows.
   - Remaining operational cleanup: before public testing with adult rooms,
     delete or redact any old `user_notifications` / `push_outbox` rows already
     created for adult rooms.

8. Silent fallback failures
   - Several UI loads still use `catch(() => undefined)` for non-critical
     refreshes.
   - Rule: for user-triggered actions, show a toast or alert. For background
     refreshes, keep the previous visible state instead of replacing it with an
     empty list.

## Already fixed in this pass

- `여기까지 읽었어요`
  - Previously hardcoded at `index === 4`.
  - Now based on locally stored last-read message ID.
  - Production still needs server read receipts. See `docs/READ_RECEIPTS_TODO.md`.

## Recommended next cleanup order

1. Replace staging adult verification with a real provider result verification
   flow.
2. Add a one-time cleanup script for old adult-room notification/push rows.
3. Audit every `catch(() => undefined)` and classify it as background-safe,
   toast-required, or alert-required.
4. Keep the sample room explicit and ensure no real room falls back to
   `ROOM_MEMBERS` or `initialStoryItems()`.
5. Add integration tests for empty tags, missing cover images, missing room
   profiles, and image-only stories.

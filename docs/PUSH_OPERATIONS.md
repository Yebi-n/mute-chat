# Mute Push Operations

## Current flow

1. Database triggers insert a row into `public.push_outbox`.
2. The `send-push-outbox` Edge Function reads unsent rows.
3. The function sends notifications through the Expo Push API.
4. Each outbox row is marked as sent or failed.

The Edge Function accepts an authenticated app session for immediate delivery and
the Supabase service-role bearer token for scheduled recovery runs. Never place
the service-role token in the app, repository, public environment variables, or
EAS client configuration.

The app-side notification UI is the native OS notification: the app icon appears
on the left, chat notifications use the sender's room profile name as the title,
and the body is the chat preview. Join requests use the room name as the title
and `{requested_name}님이 가입 신청을 보냈습니다.` as the body.

Important: push rows are not delivered merely because they exist in
`push_outbox`. The Edge Function must be called by Supabase Cron or another
trusted scheduler.

## Schedule in Supabase

Configure the schedule in the Supabase Dashboard after the production project is
ready:

1. Open **Integrations > Cron**.
2. Store the service-role key in Supabase Vault.
3. Create a job that calls:
   `https://oxanqrmkvyniocxwreia.supabase.co/functions/v1/send-push-outbox`
4. Use `POST` and set `Authorization: Bearer <vault service-role secret>`.
5. Run every minute initially. Reduce frequency only if delayed notifications are
   acceptable.

Do not place the service-role key directly in migration SQL. Vault keeps the
credential out of migration history.

## Cost controls

- The worker processes at most 100 outbox rows per run.
- Failed jobs are not retried indefinitely.
- Devices without an active token fail immediately with `NO_ACTIVE_DEVICE`.
- Expo ticket responses disable tokens reported as `DeviceNotRegistered`.
- Add Expo receipt processing before production launch to catch failures that are
  reported after a ticket was initially accepted.
- Keep chat message bodies short in push payloads and load full content in-app.

## Release checks

- Test one chat notification on a physical iOS device.
- Test one chat notification on a physical Android device.
- Test join-request and join-result deep links.
- Confirm the scheduler has executed `send-push-outbox` at least once and
  `push_outbox.sent_at` is being filled.
- Verify notification permission denial does not block app use.
- Verify the app badge and in-app unread count remain consistent.
- Confirm no service-role value exists in the client bundle.

## Realtime verification

- On 2026-06-22, two authenticated test accounts confirmed message persistence,
  Realtime `messages` INSERT delivery, notification-inbox creation,
  push-outbox creation, and room notification OFF filtering.
- The earlier false failure came from the test script retaining only one event
  ID while the room emitted multiple INSERT events. The test now accumulates all
  received IDs and verifies that the target message ID is included.
- No polling fallback is enabled. Visible chat updates use Supabase Realtime to
  avoid repeated database reads.
- Push jobs for test accounts correctly reached `NO_ACTIVE_DEVICE` because those
  accounts had no registered physical-device token.

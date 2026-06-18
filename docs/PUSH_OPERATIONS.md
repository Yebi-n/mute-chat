# Mute Push Operations

## Current flow

1. Database triggers insert a row into `public.push_outbox`.
2. The `send-push-outbox` Edge Function reads unsent rows.
3. The function sends notifications through the Expo Push API.
4. Each outbox row is marked as sent or failed.

The Edge Function only accepts the Supabase service-role bearer token. Never place
that token in the app, repository, public environment variables, or EAS client
configuration.

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
- Remove stale device tokens after Expo reports them as unregistered.
- Add receipt processing before production launch so invalid tokens are disabled.
- Keep chat message bodies short in push payloads and load full content in-app.

## Release checks

- Test one chat notification on a physical iOS device.
- Test one chat notification on a physical Android device.
- Test join-request and join-result deep links.
- Verify notification permission denial does not block app use.
- Verify the app badge and in-app unread count remain consistent.
- Confirm no service-role value exists in the client bundle.

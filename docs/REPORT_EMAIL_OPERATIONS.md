# Report Email Operations

## Current flow

1. `submit_report` stores the report in `public.reports`.
2. The client invokes the deployed `send-report-email` Edge Function.
3. Email delivery state is recorded in `reports.email_sent_at` or `reports.email_failure_reason`.
4. Email failure never rolls back or loses the server report.

## Required production secrets

Configure these with `supabase secrets set`:

- `RESEND_API_KEY`
- `REPORT_EMAIL_FROM`: a sender on a domain verified in Resend
- `REPORT_EMAIL_TO`: optional; defaults to `muteappcontact@gmail.com`

The default `onboarding@resend.dev` sender is only suitable for limited provider testing.

## Before launch

- Submit one test report and confirm both the database row and email delivery.
- Monitor `email_failure_reason`.
- Add a scheduled retry worker so a report is retried if the client closes before invoking the function.

## Push notification media

Push payloads now distinguish text, image, story, and room notices and carry sender/room asset paths. Standard Expo/APNs notifications still show the app icon on iOS. A dynamic sender avatar requires an iOS Notification Service Extension in a later native build.

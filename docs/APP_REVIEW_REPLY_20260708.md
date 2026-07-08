# App Review Response - 2026-07-08

## Apple Feedback Summary

Apple requested action on these items:

1. Registration could not be completed because the reviewer did not have an authentication code.
2. A demo account with expired subscriptions is required to review subscription purchase behavior.
3. Because the app contains user-generated content, Apple needs to verify:
   - terms/EULA acceptance before registration or login,
   - no-tolerance policy for objectionable content and abusive users,
   - user reporting,
   - user blocking,
   - developer review and action within 24 hours.
4. App Store metadata previously declared in-app controls:
   - Parental Controls,
   - Age Assurance.
   Apple could not locate these in the app.
5. If App Tracking Transparency is declared/used, Apple needs to see the ATT prompt before tracking data is collected. If the app does not track users, privacy metadata should not declare tracking.

## Code Changes Applied

- Added required terms/community-policy consent to the login screen before login can proceed.
- Added required terms/privacy/community-policy and age confirmation consent before signup phone verification can proceed.
- Added a community safety note near login/signup consent:
  - objectionable content and abusive users are not allowed,
  - reports are reviewed by the operator within 24 hours.
- Added user block action to member profile actions.
- Blocking a user also creates a report for operator review, so the developer is notified through the report workflow.

## Manual App Store Connect Tasks

### 1. Authentication Code / Demo Account

Provide one of these in App Review Notes:

- A fixed test authentication code for review, or
- A review-only phone number/password account that bypasses SMS verification, or
- A note that registration requires live SMS and a test account is provided instead.

Recommended review note:

```text
For review, please use the demo account below instead of creating a new account through SMS verification.

Phone/ID: [REVIEW_ACCOUNT]
Password: [REVIEW_PASSWORD]

If an authentication code is required during review, please use: [FIXED_CODE]
```

### 2. Expired Subscription Demo Account

Apple specifically asked for a demo account with expired subscriptions. Create or configure one test account where subscription status is expired, then add it to App Review Notes.

```text
Expired subscription test account:
Phone/ID: [EXPIRED_SUBSCRIPTION_ACCOUNT]
Password: [PASSWORD]

This account has an expired subscription state and can be used to review the subscription repurchase/renewal flow.
```

### 3. UGC Safety Screen Recording

Record on a physical iPhone:

1. Fresh launch or fresh login.
2. Terms/community-policy consent visible before login/signup.
3. Enter a room or story.
4. Open a more/options menu and show `신고하기`.
5. Open a member profile and show `차단하기`.
6. Submit or show the report confirmation flow.

Upload this recording in App Review Information Notes or attachments.

### 4. Age Rating Metadata

Unless the app exposes real parental controls or age assurance mechanisms in the iOS app, set these to `None`:

- Parental Controls: None
- Age Assurance: None

This is separate from the hidden/external adult verification plan. For current iOS review, do not claim in-app age assurance if it is not visible and testable.

### 5. App Tracking Transparency / Privacy Metadata

Choose one direction and keep metadata consistent:

- If the app does not track users across apps/websites for advertising: remove tracking declaration in App Privacy.
- If tracking is declared or IDFA tracking is used: show ATT prompt before any tracking-capable SDK collection and provide a screen recording.

For the current safest review path, if AdMob is used only with non-tracking/contextual behavior, avoid declaring tracking unless IDFA or cross-app tracking is actually used.

## Suggested Reply To Apple

```text
Hello App Review Team,

Thank you for the detailed feedback.

We have updated the app so that users must accept the Terms, Privacy Policy, and Community Policy before logging in or registering. The policy states that objectionable content and abusive users are not tolerated. The app includes reporting and user blocking flows from room, story, and profile menus. Reports are reviewed by the operator within 24 hours, and offending content/users are removed or restricted as needed.

For registration review, please use the demo account in the App Review Notes. We have also provided an account with an expired subscription state for subscription review.

We updated the age rating metadata so that Parental Controls and Age Assurance are not declared unless they are directly available in the iOS app.

If additional information is needed, please let us know.
```


# Adult Verification Platform Policy

Updated: 2026-06-19

This document separates the adult-verification policy by platform so iOS work and later Android work do not get mixed.

## Product Principle

- Adult tabs must not appear before adult verification on either iOS or Android.
- Adult rooms must not appear in general discovery, search, promotion, push-notification discovery, or recommendation surfaces for unverified users.
- Adult rooms must never appear in the `프로모션` tab on either platform.
- Adult rooms must not expose the free `프로모션` action in the chat-room plus menu.
- Room creation may show the adult category row, but it must stay disabled until adult verification is complete.
- Phone-number SMS signup verification is not adult verification. Adult verification must use a proper identity/adult-verification provider and a server-side verified status.

## Current Build Priority

iOS is the current implementation priority.

Android-specific behavior should be documented for now and implemented later in a separate Android pass. Do not mix Android adult-tab implementation changes into the current iOS-focused work unless explicitly requested.

## iOS Policy

### Current Direction

- Keep the adult tab hidden by default.
- Do not provide in-app adult verification screens.
- Do not show in-app instructions explaining how to unlock adult content through a web workaround.
- Use an external web policy/verification portal for adult verification and iOS access enablement.
- Only after the server reports both adult verification and iOS adult-content enablement may the iOS app show adult-access UI, if that route is still approved by the release strategy.

### Safer App Review Posture

The lowest-risk iOS posture is:

- no explicit adult tab in iOS discovery
- no in-app adult-content onboarding
- no adult rooms in promotion or recommendation surfaces
- direct adult-room access only when the server says the account is allowed
- blocked access copy should be neutral and must not include web unlock instructions or links

### Required Server State

The app should treat adult access as server authority, not local state.

Required status fields:

- `adult_verified_at`
- `adult_content_web_opt_in_at`
- `ios_adult_content_enabled`

The app may cache these values for UX, but final access should be validated server-side.

## Android Policy

Android implementation is deferred.

When Android work starts:

- keep the adult tab hidden until adult verification is complete
- after adult verification, the adult tab may be shown on Android
- keep the adult category visible but disabled in room creation before verification
- do not show adult rooms in promotion, recommendations, or default unverified discovery
- do not allow adult rooms to run free promotion
- keep reporting, blocking, moderation, keyword filtering, and operator review active

Google Play still treats UGC adult-adjacent features as review-sensitive. Age-gating alone is not enough. The app must remain primarily a general community/chat app, not an adult-content app.

## Shared Moderation Requirements

Both platforms require:

- user report
- room report
- story report
- image/message report
- user block and unblock
- operator review queue
- basic keyword/image moderation path
- audit log for sanctions
- fast removal path for illegal, exploitative, or underage-related content

## Promotion Rules

Promotion is platform-independent:

- adult rooms are excluded from the `프로모션` tab
- adult rooms cannot trigger free promotion from the chat plus menu
- adult rooms can still use non-discovery internal room functions after access is allowed

## Implementation Guardrail

Before modifying adult-access code, check this order:

1. Is this an iOS release task or Android release task?
2. Does the change expose adult discovery before verification?
3. Does the change expose adult rooms in promotion or recommendations?
4. Does the app text mention web-based unlock instructions inside iOS?
5. Is the server still the final authority?

If any answer is unclear, pause and document the intended platform behavior before coding.

# Requests 15-32 Implementation Status

> 최신 기준(2026-07-07): 이 문서는 2026-06 당시 구현 상태 기록입니다. 현재 작업 기준은 `DOCS_INDEX.md`, `HANDOFF_CODEX.md`, `ACTION_PLAN.md`, `PRODUCT_SPEC.md`, `STORE_COMPLIANCE.md`, `MONETIZATION_SETUP.md`, `ADULT_WEB_FLOW_SETUP.md`를 우선합니다.

Updated: 2026-06-22

## Implemented

- Staff mute/unmute from member profile with realtime system messages.
- Story preview typography adjustments.
- Owner-only promotion with server cooldown and countdown UI.
- Seven-day chat color entitlements and persistent per-room styles.
- Custom bubble, text, and paid background color previews.
- Chat tool ordering and unified coming-soon copy.
- Paged grouped-photo viewer, backdrop close, legacy media-library save, and photo reply.
- Responsive grouped-photo previews: square cells and a 2:1 final cell for odd groups.
- Outside-tap closing for chat tools and profile action sheets.
- Profile-avatar navigation without a separate "profile view" action.
- Shared report confirmation warning.
- Owner-only room visibility settings initialized from server room state.
- Departed-member lookup, userId-based ban, active-ban list, and unban.
- Push payload copy/types for text, photo, story, and room notices.
- Feedback mailto target: `muteappcontact@gmail.com`.
- TopSpace server count announcements and count-based ranking.
- New-message preview and scroll-to-latest floating button.

## Production configuration still required

- Configure `RESEND_API_KEY`, `REPORT_EMAIL_FROM`, and optionally `REPORT_EMAIL_TO` for `send-report-email`.
- Add a scheduled report-email retry worker before launch.
- A dynamic sender avatar in an iOS system notification needs a Notification Service Extension. The push payload already contains sender and room asset paths.

See `docs/REPORT_EMAIL_OPERATIONS.md` for setup details.

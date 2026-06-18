# Chat Message Rules

Updated: 2026-06-17

## Long message collapse

- Scope: plain text chat messages only.
- Threshold: collapse when message length is `140` characters or more.
- Default collapsed view: show up to `4` lines in the bubble.
- User action: show `전체보기` below the bubble content.
- Expanded state: open in place and allow `접기`.
- QA requirement: keep at least one dummy message above the threshold so the behavior is always visible in test builds.

## System notice spacing

- Room change notices use the same centered system notice layout as other system events.
- Keep extra bottom spacing under system notices so the next chat bubble does not feel attached to the notice.

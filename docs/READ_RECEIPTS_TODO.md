# Read Receipts

Updated: 2026-06-21

## Current Behavior

Real Supabase rooms now use `public.room_read_receipts` as the source of truth
for:

- the chat unread divider
- my-room unread badge counts

Local `AsyncStorage` remains only for demo/offline fallback rooms.

## Implemented Table

```sql
create table public.room_read_receipts (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
```

## Implemented Behavior

- On chat open, fetch `last_read_message_id`.
- Render the unread divider before the first visible message after that ID.
- After the room is opened and the latest readable message is visible, call
  `mark_room_read(room_id, last_read_message_id)`.
- My-room unread badge counts compare recent server messages against the stored
  read receipt.

## Remaining Production Refinements

- Debounce/throttle `mark_room_read` more aggressively if chat traffic grows.
- Replace client-side per-room unread counting with one server RPC if room count
  grows enough to affect cost or latency.

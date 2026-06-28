create table if not exists public.adult_verification_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'portone',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'expired')),
  return_url text not null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists adult_verification_attempts_user_created_idx
  on public.adult_verification_attempts(user_id, created_at desc);

create index if not exists adult_verification_attempts_pending_expiry_idx
  on public.adult_verification_attempts(expires_at)
  where status = 'pending';

alter table public.adult_verification_attempts enable row level security;

revoke all on table public.adult_verification_attempts from anon, authenticated;
grant all on table public.adult_verification_attempts to service_role;

comment on table public.adult_verification_attempts is
  'Server-only binding between a PortOne identity verification ID and the authenticated Mute account.';

create table if not exists public.app_store_server_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_uuid text unique,
  notification_type text,
  subtype text,
  environment text,
  bundle_id text,
  product_id text,
  transaction_id text,
  original_transaction_id text,
  app_account_token uuid,
  matched_user_id uuid references public.users(id) on delete set null,
  status text not null default 'received',
  expires_at timestamptz,
  signed_payload text,
  raw_payload jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.app_store_server_notifications enable row level security;

create index if not exists app_store_server_notifications_created
  on public.app_store_server_notifications(created_at desc);

create index if not exists app_store_server_notifications_user
  on public.app_store_server_notifications(matched_user_id, created_at desc);

create index if not exists app_store_server_notifications_transaction
  on public.app_store_server_notifications(transaction_id);

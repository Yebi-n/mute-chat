alter table public.reports
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_failure_reason text;

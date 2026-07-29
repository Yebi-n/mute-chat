create table if not exists public.app_version_policy (
  platform text primary key check (platform in ('ios', 'android', 'web')),
  min_build integer not null default 0 check (min_build >= 0),
  latest_build integer check (latest_build is null or latest_build >= 0),
  force_message text,
  update_url text,
  updated_at timestamptz not null default now()
);

alter table public.app_version_policy enable row level security;

drop policy if exists app_version_policy_public_read on public.app_version_policy;
create policy app_version_policy_public_read on public.app_version_policy
  for select to anon, authenticated
  using (true);

insert into public.app_version_policy(platform, min_build, latest_build, force_message, update_url)
values
  (
    'ios',
    0,
    145,
    null,
    'https://apps.apple.com/kr/app/%EB%AE%A4%ED%8A%B8/id6781187934'
  ),
  (
    'android',
    0,
    123,
    null,
    'https://play.google.com/store/apps/details?id=app.mute.chat'
  )
on conflict (platform) do update
set latest_build = excluded.latest_build,
    force_message = excluded.force_message,
    update_url = excluded.update_url,
    updated_at = now();

create or replace function public.get_app_version_policy(p_platform text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.app_version_policy%rowtype;
begin
  select * into v_policy
  from public.app_version_policy
  where platform = p_platform;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'platform', v_policy.platform,
    'minBuild', v_policy.min_build,
    'latestBuild', v_policy.latest_build,
    'forceMessage', v_policy.force_message,
    'updateUrl', v_policy.update_url
  );
end;
$$;

revoke all on function public.get_app_version_policy(text) from public;
grant execute on function public.get_app_version_policy(text) to anon, authenticated;

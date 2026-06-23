create or replace function public.limit_chat_push_frequency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_type in ('chat_message', 'secret_message')
     and exists (
       select 1
       from public.push_outbox previous
       where previous.recipient_user_id = new.recipient_user_id
         and previous.event_type = new.event_type
         and previous.data ->> 'roomId' = new.data ->> 'roomId'
         and previous.created_at > now() - interval '3 seconds'
     ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists push_outbox_chat_cooldown on public.push_outbox;
create trigger push_outbox_chat_cooldown
before insert on public.push_outbox
for each row execute function public.limit_chat_push_frequency();

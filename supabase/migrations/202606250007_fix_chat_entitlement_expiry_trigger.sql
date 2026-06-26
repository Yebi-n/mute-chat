create or replace function public.set_chat_entitlement_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base timestamptz;
begin
  if new.entitlement_type in ('bubble_color','text_color','custom_color','background_color') then
    v_base := case
      when tg_op = 'UPDATE' then greatest(coalesce(old.expires_at, now()), coalesce(new.expires_at, now()), now())
      else greatest(coalesce(new.expires_at, now()), now())
    end;
    new.expires_at := v_base + interval '7 days';
  end if;
  return new;
end;
$$;

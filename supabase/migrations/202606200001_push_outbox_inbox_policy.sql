drop policy if exists push_outbox_read_own on public.push_outbox;

create policy push_outbox_read_own
on public.push_outbox
for select to authenticated
using (recipient_user_id = auth.uid());

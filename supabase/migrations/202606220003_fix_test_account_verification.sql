update public.users u
set adult_verified_at = now(), updated_at = now()
from auth.users a
where a.id = u.id and a.email = 'test-alpha@user.mute.app';

update public.users u
set adult_verified_at = null, updated_at = now()
from auth.users a
where a.id = u.id and a.email = 'test-bravo@user.mute.app';

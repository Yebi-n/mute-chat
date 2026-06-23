do $$
declare
  v_password text := 'mute1234!';
  v_accounts text[] := array['test-alpha', 'test-bravo'];
  v_account text;
  v_user_id uuid;
begin
  foreach v_account in array v_accounts loop
    select id into v_user_id
    from auth.users
    where email = v_account || '@user.mute.app';

    if v_user_id is null then
      v_user_id := gen_random_uuid();

      insert into auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
      ) values (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_account || '@user.mute.app',
        extensions.crypt(v_password, extensions.gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object('display_name', v_account, 'test_account', true),
        now(),
        now(),
        '',
        '',
        '',
        ''
      );

      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        v_user_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_account || '@user.mute.app'),
        'email',
        v_account || '@user.mute.app',
        now(),
        now(),
        now()
      );
    end if;

    insert into public.users (id, point_balance, updated_at)
    values (v_user_id, 10000, now())
    on conflict (id) do update
    set point_balance = greatest(public.users.point_balance, 10000),
        updated_at = now();
  end loop;
end
$$;

-- 원격 데모 seed를 Auth 서버가 기대하는 최신 Hosted Auth row 형태로 보정한다.
-- public 예시 데이터는 supabase/seed.sql이 담당한다.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'owner@lesson.local',
    extensions.crypt('lesson1234', extensions.gen_salt('bf')),
    '2026-08-01 00:00:00+09',
    '2026-08-01 00:00:00+09',
    '2026-08-01 00:00:00+09',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"제임스 원장"}'::jsonb,
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'teacher@lesson.local',
    extensions.crypt('lesson1234', extensions.gen_salt('bf')),
    '2026-08-01 00:00:00+09',
    '2026-08-01 00:00:00+09',
    '2026-08-01 00:00:00+09',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"김하늘 선생님"}'::jsonb,
    false,
    false
  )
on conflict (id) do update
set
  aud = excluded.aud,
  role = excluded.role,
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
  confirmation_token = coalesce(auth.users.confirmation_token, ''),
  recovery_token = coalesce(auth.users.recovery_token, ''),
  email_change_token_new = coalesce(auth.users.email_change_token_new, ''),
  email_change = coalesce(auth.users.email_change, ''),
  email_change_token_current = coalesce(auth.users.email_change_token_current, ''),
  email_change_confirm_status = coalesce(auth.users.email_change_confirm_status, 0),
  phone_change = coalesce(auth.users.phone_change, ''),
  phone_change_token = coalesce(auth.users.phone_change_token, ''),
  reauthentication_token = coalesce(auth.users.reauthentication_token, ''),
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  is_sso_user = false,
  is_anonymous = false,
  updated_at = now();

update auth.identities
set
  provider_id = case
    when user_id = '11111111-1111-1111-1111-111111111111' then 'owner@lesson.local'
    when user_id = '22222222-2222-2222-2222-222222222222' then 'teacher@lesson.local'
    else provider_id
  end,
  identity_data = case
    when user_id = '11111111-1111-1111-1111-111111111111' then '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@lesson.local","email_verified":true,"phone_verified":false}'::jsonb
    when user_id = '22222222-2222-2222-2222-222222222222' then '{"sub":"22222222-2222-2222-2222-222222222222","email":"teacher@lesson.local","email_verified":true,"phone_verified":false}'::jsonb
    else identity_data
  end,
  provider = 'email',
  updated_at = now()
where user_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  seed.id,
  seed.email,
  seed.id,
  seed.identity_data,
  'email',
  '2026-08-01 00:00:00+09',
  '2026-08-01 00:00:00+09',
  '2026-08-01 00:00:00+09'
from (
  values
    (
      '11111111-1111-1111-1111-111111111111'::uuid,
      'owner@lesson.local',
      '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@lesson.local","email_verified":true,"phone_verified":false}'::jsonb
    ),
    (
      '22222222-2222-2222-2222-222222222222'::uuid,
      'teacher@lesson.local',
      '{"sub":"22222222-2222-2222-2222-222222222222","email":"teacher@lesson.local","email_verified":true,"phone_verified":false}'::jsonb
    )
) as seed(id, email, identity_data)
where not exists (
  select 1
  from auth.identities identity
  where identity.user_id = seed.id
    and identity.provider = 'email'
);

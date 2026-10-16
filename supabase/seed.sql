-- 로컬 개발/테스트용 seed 데이터입니다.
-- 원격 Supabase 프로젝트에는 자동 반영되지 않으며, `supabase db reset` 시 로컬 DB에 적재됩니다.
-- 원격 데모 확인이 필요할 때 `supabase db push --include-seed`로 한 번 적용할 수 있도록
-- 같은 seed를 다시 실행해도 중복 삽입되지 않는 idempotent 형태로 유지합니다.

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
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
  updated_at = now(),
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  is_sso_user = false,
  is_anonymous = false;

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'owner@lesson.local',
    '11111111-1111-1111-1111-111111111111',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@lesson.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    '2026-08-01 00:00:00+09',
    '2026-08-01 00:00:00+09',
    '2026-08-01 00:00:00+09'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'teacher@lesson.local',
    '22222222-2222-2222-2222-222222222222',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"teacher@lesson.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    '2026-08-01 00:00:00+09',
    '2026-08-01 00:00:00+09',
    '2026-08-01 00:00:00+09'
  )
on conflict do nothing;

insert into public.profiles (id, display_name) values
  ('11111111-1111-1111-1111-111111111111', '제임스 원장'),
  ('22222222-2222-2222-2222-222222222222', '김하늘 선생님')
on conflict (id) do update
set display_name = excluded.display_name;

insert into public.academies (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '더 클래식 음악학원', '11111111-1111-1111-1111-111111111111')
on conflict (id) do update
set name = excluded.name;

insert into public.academy_members (id, academy_id, user_id, role, status) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'teacher', 'active')
on conflict (id) do update
set
  role = excluded.role,
  status = excluded.status;

insert into public.teachers (id, academy_id, member_id, name, part, phone, registered_on, salary_type) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '김하늘', '피아노', '010-1111-2222', '2026-03-02', 'monthly'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '오유진', '바이올린', '010-3333-4444', '2026-04-01', 'ratio'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '문서준', '첼로', '010-5555-6666', '2026-05-10', 'hourly')
on conflict (id) do update
set
  member_id = excluded.member_id,
  name = excluded.name,
  part = excluded.part,
  phone = excluded.phone,
  registered_on = excluded.registered_on,
  salary_type = excluded.salary_type;

insert into public.students (id, academy_id, name, status, registered_on) values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '김민지', 'enrolled', '2026-03-04'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '이서윤', 'enrolled', '2026-03-11'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '박지호', 'enrolled', '2026-04-02'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '한서아', 'enrolled', '2026-05-01'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '최도윤', 'enrolled', '2026-06-08')
on conflict (id) do update
set
  name = excluded.name,
  status = excluded.status,
  registered_on = excluded.registered_on;

insert into public.student_contacts (id, academy_id, student_id, relationship, phone) values
  ('13131313-1313-4313-8313-131313131301', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', '보호자', '010-9000-0001'),
  ('13131313-1313-4313-8313-131313131302', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', '보호자', '010-9000-0002'),
  ('13131313-1313-4313-8313-131313131303', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd3', '보호자', '010-9000-0003'),
  ('13131313-1313-4313-8313-131313131304', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd4', '보호자', '010-9000-0004'),
  ('13131313-1313-4313-8313-131313131305', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd5', '보호자', '010-9000-0005')
on conflict (id) do update
set
  relationship = excluded.relationship,
  phone = excluded.phone;

insert into public.student_instruments (
  id,
  academy_id,
  student_id,
  teacher_id,
  instrument_id,
  instrument_name,
  lesson_type,
  weekdays,
  start_time,
  end_time,
  progress,
  lesson_fee,
  discount_total,
  final_monthly_fee
) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'piano', '피아노', 'academy', '{"월","수"}', '15:00', '15:50', '체르니 100 12번', 150000, 10000, 140000),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'piano', '피아노', 'academy', '{"화","금"}', '16:00', '16:50', '바이엘 하권', 150000, 0, 150000),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd3', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'piano', '피아노', 'academy', '{"금"}', '17:00', '17:50', '소나티네 1악장', 150000, 0, 150000),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd4', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'violin', '바이올린', 'private', '{"금"}', '18:00', '18:50', '스즈키 1권 미뉴에트', 0, 0, 0),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd5', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'cello', '첼로', 'private', '{"토"}', '10:30', '11:20', '활쓰기 기초', 0, 0, 0)
on conflict (id) do update
set
  teacher_id = excluded.teacher_id,
  instrument_name = excluded.instrument_name,
  lesson_type = excluded.lesson_type,
  weekdays = excluded.weekdays,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  progress = excluded.progress,
  lesson_fee = excluded.lesson_fee,
  discount_total = excluded.discount_total,
  final_monthly_fee = excluded.final_monthly_fee;

insert into public.student_teacher_assignments (id, academy_id, student_id, teacher_id, instrument_name) values
  ('14141414-1414-4414-8414-141414141401', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', '피아노'),
  ('14141414-1414-4414-8414-141414141402', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', '피아노'),
  ('14141414-1414-4414-8414-141414141403', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd3', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', '피아노'),
  ('14141414-1414-4414-8414-141414141404', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd4', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', '바이올린'),
  ('14141414-1414-4414-8414-141414141405', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd5', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', '첼로')
on conflict (id) do update
set
  teacher_id = excluded.teacher_id,
  instrument_name = excluded.instrument_name,
  active = true;

insert into public.lesson_events (
  id,
  academy_id,
  student_id,
  student_instrument_id,
  teacher_id,
  lesson_kind,
  instrument_id,
  instrument_name,
  starts_at,
  ends_at,
  generated_from_enrollment
) values
  ('f1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'academy', 'piano', '피아노', '2026-08-21 15:00:00+09', '2026-08-21 15:50:00+09', true),
  ('f2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'academy', 'piano', '피아노', '2026-08-21 16:00:00+09', '2026-08-21 16:50:00+09', true),
  ('f3333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd3', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'academy', 'piano', '피아노', '2026-08-21 17:00:00+09', '2026-08-21 17:50:00+09', true),
  ('f4444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd4', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'private', 'violin', '바이올린', '2026-08-21 18:00:00+09', '2026-08-21 18:50:00+09', false),
  ('f5555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd5', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'private', 'cello', '첼로', '2026-08-22 10:30:00+09', '2026-08-22 11:20:00+09', false)
on conflict (id) do update
set
  teacher_id = excluded.teacher_id,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = 'scheduled',
  deletion_reason = null,
  deleted_at = null,
  deleted_by = null,
  generated_from_enrollment = excluded.generated_from_enrollment;

insert into public.attendance_records (
  id,
  academy_id,
  lesson_event_id,
  student_id,
  status,
  absence_reason,
  marked_at,
  marked_by
) values
  ('15151515-1515-4515-8515-151515151501', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f1111111-1111-4111-8111-111111111111', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'present', null, '2026-08-21 15:03:00+09', '11111111-1111-1111-1111-111111111111'),
  ('15151515-1515-4515-8515-151515151502', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f2222222-2222-4222-8222-222222222222', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'pending', null, '2026-08-21 16:00:00+09', '11111111-1111-1111-1111-111111111111'),
  ('15151515-1515-4515-8515-151515151503', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f3333333-3333-4333-8333-333333333333', 'dddddddd-dddd-dddd-dddd-ddddddddddd3', 'absent', '보호자 연락: 독감 증상', '2026-08-21 17:03:00+09', '11111111-1111-1111-1111-111111111111')
on conflict (academy_id, lesson_event_id, student_id) do nothing;

insert into public.monthly_memos (academy_id, month, content, unread, updated_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08', '8월 말 정기 발표회 리허설 일정 확인. 결석 원생 보강 우선 배정.', true, '11111111-1111-1111-1111-111111111111')
on conflict (academy_id, month) do nothing;

insert into public.lesson_ticket_grants (
  id,
  academy_id,
  student_id,
  instrument_id,
  instrument_name,
  total_granted_count,
  remaining_count,
  valid_from,
  valid_until,
  registered_at,
  paid_amount,
  paid_at,
  created_by
) values
  ('99999999-9999-4999-8999-999999999991', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd4', 'violin', '바이올린', 8, 2, '2026-08-01', '2026-08-28', '2026-08-01', 320000, '2026-08-01', '11111111-1111-1111-1111-111111111111'),
  ('99999999-9999-4999-8999-999999999992', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-ddddddddddd5', 'cello', '첼로', 4, 1, '2026-08-10', '2026-08-24', '2026-08-10', 180000, '2026-08-10', '11111111-1111-1111-1111-111111111111')
on conflict (id) do update
set
  instrument_name = excluded.instrument_name,
  total_granted_count = excluded.total_granted_count,
  valid_from = excluded.valid_from,
  valid_until = excluded.valid_until,
  registered_at = excluded.registered_at,
  paid_amount = excluded.paid_amount,
  paid_at = excluded.paid_at,
  created_by = excluded.created_by;

insert into public.vendors (id, academy_id, name, phone, vendor_type, note) values
  ('abababab-abab-4bab-8bab-ababababab01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '클래식 악기사', '02-1000-2000', '악기', '피아노 조율, 현 교체'),
  ('abababab-abab-4bab-8bab-ababababab02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '뮤직북 유통', '02-3000-4000', '교재', '바이엘, 체르니 정기 입고')
on conflict (id) do update
set
  name = excluded.name,
  phone = excluded.phone,
  vendor_type = excluded.vendor_type,
  note = excluded.note;

-- 교재 한 줄 = 현재 재고 권수. 출고 2건(바이엘 상 1권 대기, 스즈키 바이올린 1 1권 결제 완료)이 이미 차감된 값이다.
insert into public.books (id, academy_id, title, price, quantity, stocked_on, title_key) values
  ('12121212-1212-4212-8212-121212121201', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '바이엘 상', 12000, 9, '2026-08-01', '바이엘 상'),
  ('12121212-1212-4212-8212-121212121202', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '스즈키 바이올린 1', 18000, 7, '2026-08-01', '스즈키 바이올린 1')
on conflict (id) do update
set
  title = excluded.title,
  price = excluded.price,
  quantity = excluded.quantity,
  stocked_on = excluded.stocked_on,
  title_key = excluded.title_key,
  active = true;

insert into public.book_releases (
  id,
  academy_id,
  book_id,
  student_id,
  student_name,
  book_title,
  price,
  quantity,
  shipped_at,
  status,
  paid_at,
  created_by
) values
  ('17171717-1717-4717-8717-171717171701', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '12121212-1212-4212-8212-121212121201', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', '김민지', '바이엘 상', 12000, 1, '2026-08-18', 'payment-pending', null, '11111111-1111-1111-1111-111111111111'),
  ('17171717-1717-4717-8717-171717171702', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '12121212-1212-4212-8212-121212121202', 'dddddddd-dddd-dddd-dddd-ddddddddddd4', '한서아', '스즈키 바이올린 1', 18000, 1, '2026-08-12', 'paid', '2026-08-14', '11111111-1111-1111-1111-111111111111')
on conflict (id) do update
set
  student_name = excluded.student_name,
  book_title = excluded.book_title,
  price = excluded.price,
  quantity = excluded.quantity,
  shipped_at = excluded.shipped_at,
  status = excluded.status,
  paid_at = excluded.paid_at,
  created_by = excluded.created_by;

insert into public.fixed_income_snapshots (
  id,
  academy_id,
  month,
  student_id,
  student_instrument_id,
  student_name,
  instrument_id,
  instrument_name,
  amount,
  status,
  paid_at
) values
  ('18181818-1818-4818-8818-181818181801', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '김민지', 'piano', '피아노', 140000, 'paid', '2026-08-05'),
  ('18181818-1818-4818-8818-181818181802', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', '이서윤', 'piano', '피아노', 150000, 'unpaid', null)
on conflict (academy_id, month, student_id, instrument_id) do update
set
  student_name = excluded.student_name,
  student_instrument_id = excluded.student_instrument_id,
  instrument_name = excluded.instrument_name,
  amount = excluded.amount,
  status = excluded.status,
  paid_at = excluded.paid_at;

insert into public.ledger_entries (id, academy_id, occurred_on, entry_type, source, amount, description, ref_table, ref_id, created_by) values
  ('19191919-1919-4919-8919-191919191901', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-05', 'income', 'tuition', 140000, '김민지 8월 피아노 수강료', 'fixed_income_snapshots', '김민지-2026-08-piano', '11111111-1111-1111-1111-111111111111'),
  ('19191919-1919-4919-8919-191919191902', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-14', 'income', 'book-sale', 18000, '교재 판매: 스즈키 바이올린 1 / 한서아', 'book_releases', '스즈키-한서아', '11111111-1111-1111-1111-111111111111'),
  ('19191919-1919-4919-8919-191919191903', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-01', 'income', 'lesson-ticket', 320000, '한서아 바이올린 회차권 8회 구매', 'lesson_ticket_grants', '99999999-9999-4999-8999-999999999991', '11111111-1111-1111-1111-111111111111'),
  ('19191919-1919-4919-8919-191919191904', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-20', 'expense', 'manual', 70000, '피아노 조율비', 'vendors', '클래식 악기사', '11111111-1111-1111-1111-111111111111')
on conflict (id) do update
set
  occurred_on = excluded.occurred_on,
  entry_type = excluded.entry_type,
  source = excluded.source,
  amount = excluded.amount,
  description = excluded.description,
  ref_table = excluded.ref_table,
  ref_id = excluded.ref_id,
  created_by = excluded.created_by;

insert into public.teacher_salary_settings (
  id,
  academy_id,
  teacher_id,
  pay_type,
  ratio_teacher_share,
  monthly_salary,
  hourly_rate,
  withholding_tax_rate,
  rounding
) values
  ('20202020-2020-4020-8020-202020202001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'monthly', null, 1800000, null, 0.033, 'floor'),
  ('20202020-2020-4020-8020-202020202002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'ratio', 60, null, null, 0.033, 'floor'),
  ('20202020-2020-4020-8020-202020202003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'hourly', null, null, 35000, 0.033, 'floor')
on conflict (academy_id, teacher_id, pay_type) do update
set
  ratio_teacher_share = excluded.ratio_teacher_share,
  monthly_salary = excluded.monthly_salary,
  hourly_rate = excluded.hourly_rate,
  withholding_tax_rate = excluded.withholding_tax_rate,
  rounding = excluded.rounding,
  active = true;

insert into public.salary_settlements (
  id,
  academy_id,
  teacher_id,
  teacher_name,
  month,
  pay_type,
  base_pay,
  withholding_tax,
  net_pay,
  status,
  paid_at,
  lesson_event_ids
) values
  ('21212121-2121-4121-8121-212121212101', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', '김하늘', '2026-08', 'monthly', 1800000, 59400, 1740600, 'pending', null, array['f1111111-1111-4111-8111-111111111111'::uuid, 'f2222222-2222-4222-8222-222222222222'::uuid, 'f3333333-3333-4333-8333-333333333333'::uuid])
on conflict (academy_id, teacher_id, month, pay_type) do update
set
  teacher_name = excluded.teacher_name,
  base_pay = excluded.base_pay,
  withholding_tax = excluded.withholding_tax,
  net_pay = excluded.net_pay,
  status = excluded.status,
  paid_at = excluded.paid_at,
  lesson_event_ids = excluded.lesson_event_ids;

insert into public.audit_events (id, academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata) values
  ('22222222-2222-4222-8222-222222222201', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'seed.created', 'academies', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '로컬 개발 예시 데이터', '{"source":"supabase/seed.sql"}'::jsonb)
on conflict (id) do nothing;

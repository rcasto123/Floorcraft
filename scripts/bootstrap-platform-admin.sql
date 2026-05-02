-- bootstrap-platform-admin.sql
--
-- One-shot script for promoting the very first platform admin on a
-- fresh Supabase project. Idempotent: safe to re-run.
--
-- HOW TO USE
-- ----------
--   1. Sign up the email below through your app's /signup flow first
--      (this creates the corresponding `profiles` row).
--   2. Open Supabase dashboard → SQL Editor → New query.
--   3. Edit the email in the line marked CHANGE THIS EMAIL.
--   4. Paste this whole file → Run.
--   5. Sign in to the app, navigate to /admin.
--
-- The script:
--   - Adds the `is_platform_admin` column to `profiles` if missing
--     (covers the case where migration 0017 hasn't been applied
--     yet — `if not exists` makes it a no-op when 0017 already ran).
--   - Promotes the email below.
--   - Returns the resulting row so you can confirm it took.
--
-- After this runs once, all subsequent admins should be promoted via
-- the /admin/admins page in the app — no more SQL.

-- ⬇⬇⬇  CHANGE THIS EMAIL  ⬇⬇⬇
-- (replace the value inside the quotes; keep the quotes)
do $$
declare
  bootstrap_email text := 'robertmcasto@gmail.com';
  -- ⬆⬆⬆  CHANGE THIS EMAIL  ⬆⬆⬆
  promoted_count int;
begin
  -- Make sure the column exists (no-op if migration 0017 already ran).
  execute 'alter table profiles add column if not exists '
       || 'is_platform_admin boolean not null default false';

  update profiles
    set is_platform_admin = true
    where lower(email) = lower(bootstrap_email);
  get diagnostics promoted_count = row_count;

  if promoted_count = 0 then
    raise notice 'No profile found for %. Sign up that email first, then re-run.', bootstrap_email;
  else
    raise notice 'Promoted % to platform admin.', bootstrap_email;
  end if;
end $$;

-- Confirmation query (replace the email here too if you changed it
-- above). Should return one row with is_platform_admin = true.
select id, email, name, is_platform_admin
  from profiles
  where lower(email) = lower('robertmcasto@gmail.com');

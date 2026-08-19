-- Local seed data. Applied by `supabase db reset` / `supabase db seed`, NOT by
-- `supabase db push` (cloud migrations are applied without seed data).

-- Connectivity smoke row. The `smoke` table itself is created by the rls
-- migration so it also exists on cloud; this row seeds local dev so the smoke
-- test returns a non-empty result locally.
insert into public.smoke (id) values (gen_random_uuid());

-- Role fixtures for local RLS tests. Profiles reference auth.users(id), so
-- these inserts only succeed once the matching auth users exist (created via
-- the Auth UI / dashboard, or a future auth migration). Until `handle_new_user`
-- lands, keep them commented to avoid failing `db reset` on a fresh project.
--   insert into public.profiles (id, role)
--     values ('00000000-0000-0000-0000-000000000001', 'operator'),
--            ('00000000-0000-0000-0000-000000000002', 'admin');

-- Real-auth bootstrap: on every new auth.users insert, create a public.profiles
-- row so signup never leaves an operator without a profile. RLS grants workshop
-- access `to authenticated`, so the admin surface depends on this row existing.
--
-- First-admin logic:
--   * The FIRST signup of the whole system bootstraps 'admin' (the owner). The
--     check is "profiles is empty at insert time": once the owner signs in the
--     table is never empty again, so every later signup gets 'operator'.
--   * Escape hatch for a wrong first admin (design risk #2):
--       update public.profiles set role = 'admin' where id = '<user-uuid>';
--
-- security definer set search_path = '' (matches is_admin()/current_user_role()):
--   public.profiles has NO insert policy (RLS enabled) and no session exists at
--   signup time, so the insert must run as the function owner (postgres),
--   bypassing RLS. The empty search_path prevents search-path injection and RLS
--   recursion.
--
-- on conflict do nothing: never clobber a profile created out-of-band (manual
-- promotion, re-insert of an existing user). Additive migration: function +
-- trigger only, no table/column change — safe against live data.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case
      when not exists (select 1 from public.profiles) then 'admin'
      else 'operator'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

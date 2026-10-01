-- Ordinary read-only permission checks (run in the SQL editor; no output rows
-- are modified). Record the results next to the deployment notes.
-- Expected after applying 0012:
--   A. RLS enabled on bookings, payments, subscriptions, clients, waitlist,
--      waitlist_offers, blocked_slots, demo_state.
--   B. bookings_guard_deposit trigger present on bookings (+ duration sync trigger).
--   C. No policy grants anon access to bookings/clients (payments has none at all).
--   D. Table grants: anon has NONE on bookings; authenticated has DML grants but
--      RLS restricts them to admin rows only.
--   E. book_slot (8-arg) and confirm_demo_payment (3-arg) exist;
--      EXECUTE granted to service_role only.
--   F. book_slot signature: uuid, date, text, boolean, boolean, integer, text, integer.

-- A. Row-level security state
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('bookings','payments','subscriptions','clients','waitlist','waitlist_offers','blocked_slots','demo_state')
order by 1;

-- B. Triggers on bookings
select t.tgname as trigger_name, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where t.tgrelid = 'public.bookings'::regclass and not t.tgisinternal;

-- C. Policies (look for anything granting 'anon' on booking tables)
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- D. Table-level grants (expect no 'anon' rows on bookings/clients)
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('bookings','payments','clients','subscriptions')
  and grantee in ('anon','authenticated','service_role')
order by table_name, grantee, privilege_type;

-- E. Function EXECUTE grants (aclexplode; expect service_role only for both functions)
select p.proname as function_name,
       (aclexplode(coalesce(p.proacl, acldefault('f', p.proowner)))).grantee::regrole::text as grantee_role,
       (aclexplode(coalesce(p.proacl, acldefault('f', p.proowner)))).privilege_type as privilege
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('book_slot','confirm_demo_payment')
order by 1, 2;

-- F. Signatures (replaces \df+)
select p.proname as function_name,
       pg_get_function_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result_type
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('book_slot','confirm_demo_payment')
order by 1, 2;

#!/usr/bin/env bash
# Disposable PostgreSQL test runner for 0012_slot_duration_and_atomic_payment.
# Creates a throwaway cluster in /tmp, applies the fixture + migration, runs the
# sequential assertion suite plus REAL parallel-session races (reservation vs
# reservation, payment vs payment, payment vs reservation), then destroys it.
# Never touches any remote/production database.
set -euo pipefail

# Prefer a full server install (initdb needs the postgres binary; libpq alone lacks it).
for d in /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin /opt/homebrew/opt/postgresql/bin; do
  [ -x "$d/initdb" ] && PGDIR="$d" && break
done
PGDIR="${PGDIR:-$(dirname "$(command -v initdb)")}"
export PATH="$PGDIR:$PATH"
command -v initdb >/dev/null && [ -x "$(dirname "$(command -v initdb)")/postgres" ] \
  || { echo "FATAL: no PostgreSQL server binaries found (initdb+postgres required)"; exit 2; }

WORK="$(mktemp -d /tmp/rai-0012-XXXXXX)"
PGDATA="$WORK/pgdata"
PORT="${PG_TEST_PORT:-55432}"
SOCK="$WORK"
DB=rai0012
FAIL=0

cleanup() {
  pg_ctl -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

P() { psql -h "$SOCK" -p "$PORT" -U test -d "$DB" "$@"; }

echo "== initdb (disposable cluster: $PGDATA) =="
initdb -U test -A trust -E utf8 "$PGDATA" >/dev/null
pg_ctl -D "$PGDATA" -l "$WORK/log" -o "-p $PORT -k $SOCK" start >/dev/null
for i in $(seq 1 30); do pg_isready -h "$SOCK" -p "$PORT" >/dev/null 2>&1 && break; sleep 0.3; done

echo "== createdb =="
createdb -h "$SOCK" -p "$PORT" -U test "$DB"

echo "== fixture (from exported production definitions) =="
P -v ON_ERROR_STOP=1 -q -f tests/sql/0012_fixture.sql
echo "== overlap check on PRE-migration schema (no duration_slots column) =="
OD="2099-01-20"
P -q -c "insert into bookings (plan, status, vehicle_model, date, time, location_type) values ('Full Detail','confirmed','overlap','$OD','09:00','mobile')"
P -q -c "insert into bookings (plan, status, vehicle_model, date, time, location_type) values ('Essential Wash','confirmed','overlap','$OD','10:00','mobile')"
P -q -c "insert into bookings (plan, status, vehicle_model, date, time, location_type) values ('Full Detail','confirmed','overlap','$OD','09:00','studio')"
P -q -c "insert into bookings (plan, status, vehicle_model, date, time, location_type) values ('Essential Wash','confirmed','overlap','$OD','10:00','studio')"
sed "s/date '2026-10-01'/date '2099-01-20'/" drizzle/migrations/probe/0012_overlap_check.sql > "$WORK/overlap.sql"
VIOLATIONS=$(P -t -A -f "$WORK/overlap.sql" | head -1 | cut -d'|' -f4 || echo ERR)
echo "overlap query row 1: $VIOLATIONS (expected occupied_units=2 on the mobile pair only)"
[ "$VIOLATIONS" = "2" ] || { echo "OVERLAP CHECK FAILED: expected the query to flag exactly the mobile pair (2 units > 1 van), got '$VIOLATIONS'"; FAIL=1; }

echo "== migration 0012 =="
P -v ON_ERROR_STOP=1 -q -f drizzle/migrations/0012_slot_duration_and_atomic_payment.sql
echo "migration applied OK"

echo "== sequential assertions =="
if ! P -v ON_ERROR_STOP=1 -f tests/sql/0012_disposable_test.sql; then
  echo "SEQUENTIAL: FAILED"; FAIL=1
fi

# --- Real parallel-session races -------------------------------------------
declare -a ROUND_RESULTS
race_fail=0
DATE_FOR() { echo "2099-02-$(printf '%02d' $1)"; }

echo "== race 1: reservation vs reservation (last van slot), 10 rounds =="
for i in $(seq 1 10); do
  D="$(DATE_FOR $i)"; T="07:00"
  ID1=$(P -t -A -c "with i as (insert into bookings (plan,status,vehicle_model) values ('Essential Wash','lead','race') returning id) select id from i")
  ID2=$(P -t -A -c "with i as (insert into bookings (plan,status,vehicle_model) values ('Essential Wash','lead','race') returning id) select id from i")
  ( P -t -A -c "select book_slot('$ID1','$D','$T',true,true,1,'pending_deposit',1)" >"$WORK/r1" 2>&1 ) &
  ( P -t -A -c "select book_slot('$ID2','$D','$T',true,true,1,'pending_deposit',1)" >"$WORK/r2" 2>&1 ) &
  wait
  O="$( (cat "$WORK/r1"; cat "$WORK/r2") | sort | tr '\n' ' ' | xargs )"
  if grep -qi "deadlock" "$WORK/r1" "$WORK/r2"; then echo "round $i: DEADLOCK: $(cat "$WORK/r1" "$WORK/r2")"; race_fail=1; fi
  [ "$O" = "full ok" ] || { echo "round $i: expected 'full ok', got '$O'"; race_fail=1; }
done
[ $race_fail -eq 0 ] && echo "race 1: PASSED (10/10 rounds, no deadlocks)" || FAIL=1

echo "== race 2: payment vs payment (same booking), 10 rounds =="
for i in $(seq 1 10); do
  D="$(DATE_FOR $((i+10)))"
  BK=$(P -t -A -c "
    with c as (insert into clients (name, phone) values ('race', '+919000000003') returning id),
         b as (insert into bookings (plan, vehicle_model, total, client_id, status)
               select 'Essential Wash', 'race', 699, id, 'lead' from c returning id)
    select id from b")
  P -q -c "select book_slot('$BK','$D','09:00',false,true,1,'pending_deposit',1)" >/dev/null
  ( P -t -A -c "select confirm_demo_payment('$BK','upi',210)" >"$WORK/p1" 2>&1 ) &
  ( P -t -A -c "select confirm_demo_payment('$BK','card',210)" >"$WORK/p2" 2>&1 ) &
  wait
  O="$( (cat "$WORK/p1"; cat "$WORK/p2") | sort | tr '\n' ' ' | xargs )"
  N=$(P -t -A -c "select count(*) from payments where booking_id='$BK'")
  if grep -qi "deadlock" "$WORK/p1" "$WORK/p2"; then echo "round $i: DEADLOCK: $(cat "$WORK/p1" "$WORK/p2")"; race_fail=1; fi
  [ "$O" = "already_paid ok" ] || { echo "round $i: expected 'already_paid ok', got '$O'"; race_fail=1; }
  [ "$N" = "1" ] || { echo "round $i: expected exactly 1 payment row, got $N"; race_fail=1; }
done
[ $race_fail -eq 0 ] && echo "race 2: PASSED (10/10 rounds, exactly one payment row each, no deadlocks)" || FAIL=1

echo "== race 3: payment vs new reservation on the SAME van slot (mobile, cap 1), 10 rounds =="
# Review-issue fix: previously this race used two-capacity studio, started with an
# already-expired hold only, and did not assert the rival's result when payment was
# refused. Now: mobile capacity one (a slot can hold exactly one), rounds ALTERNATE
# between an expired hold (25 min) and a live hold (19 min), and BOTH outcomes are
# asserted in every round, including post-state. Expiry-boundary cases are covered
# separately below (exact 20-minute stamp = expired; 19-minute stamp = payable).
race3_fail=0
for i in $(seq 1 10); do
  D="$(printf "2099-03-%02d" $((10+i)))"
  BK=$(P -t -A -c "
    with c as (insert into clients (name, phone) values ('race3', '+919000000004') returning id),
         b as (insert into bookings (plan, vehicle_model, total, client_id, status)
               select 'Essential Wash', 'race', 699, id, 'lead' from c returning id)
    select id from b")
  P -q -c "select book_slot('$BK','$D','07:00',true,true,1,'pending_deposit',1)" >/dev/null
  if [ $((i % 2)) -eq 1 ]; then AGE="25 minutes"; ELSE=expired; else AGE="19 minutes"; ELSE=live; fi
  P -q -c "update bookings set held_at = clock_timestamp() - interval '$AGE' where id='$BK'" >/dev/null
  RIVAL=$(P -t -A -c "with i as (insert into bookings (plan,status,vehicle_model) values ('Essential Wash','lead','race') returning id) select id from i")
  ( P -t -A -c "select confirm_demo_payment('$BK','upi',210)" >"$WORK/x1" 2>&1 ) &
  ( P -t -A -c "select book_slot('$RIVAL','$D','07:00',true,true,1,'pending_deposit',1)" >"$WORK/x2" 2>&1 ) &
  wait
  if grep -qi "deadlock" "$WORK/x1" "$WORK/x2"; then echo "round $i: DEADLOCK: $(cat "$WORK/x1" "$WORK/x2")"; race3_fail=1; fi
  OUT1="$(cat "$WORK/x1" | xargs)"; OUT2="$(cat "$WORK/x2" | xargs)"
  PAID=$(P -t -A -c "select deposit_paid from bookings where id='$BK'")
  NPAY=$(P -t -A -c "select count(*) from payments where booking_id='$BK'")
  if [ "$ELSE" = "expired" ]; then
    [ "$OUT1" = "hold_expired" ] || { echo "round $i (expired): payment result was '$OUT1' (expected hold_expired)"; race3_fail=1; }
    [ "$OUT2" = "ok" ] || { echo "round $i (expired): rival result was '$OUT2' (expected ok — the slot was free)"; race3_fail=1; }
    [ "$PAID" = "f" ] || { echo "round $i (expired): booking must NOT be paid"; race3_fail=1; }
    [ "$NPAY" = "0" ] || { echo "round $i (expired): payment rows = $NPAY (expected 0)"; race3_fail=1; }
  else
    [ "$OUT1" = "ok" ] || { echo "round $i (live): payment result was '$OUT1' (expected ok)"; race3_fail=1; }
    [ "$OUT2" = "full" ] || { echo "round $i (live): rival result was '$OUT2' (expected full — van holds exactly one)"; race3_fail=1; }
    [ "$PAID" = "t" ] || { echo "round $i (live): booking must be paid"; race3_fail=1; }
    [ "$NPAY" = "1" ] || { echo "round $i (live): payment rows = $NPAY (expected 1)"; race3_fail=1; }
  fi
done

echo "== race 3b: expiry-boundary checks (exact 20-minute stamp) =="
D="$(printf "2099-03-%02d" 30)"
BK=$(P -t -A -c "
  with c as (insert into clients (name, phone) values ('race3b', '+919000000005') returning id),
       b as (insert into bookings (plan, vehicle_model, total, client_id, status)
             select 'Essential Wash', 'race', 699, id, 'lead' from c returning id)
  select id from b")
P -q -c "select book_slot('$BK','$D','07:00',true,true,1,'pending_deposit',1)" >/dev/null
# Boundary: the rule is held_at <= now - 20 minutes => expired. A stamp set to
# exactly -20 minutes is already past the boundary by the time payment runs, so it
# must be refused; a -19 minute stamp must still be payable.
P -q -c "update bookings set held_at = clock_timestamp() - interval '20 minutes' where id='$BK'" >/dev/null
B1="$(P -t -A -c "select confirm_demo_payment('$BK','upi',210)" | xargs)"
[ "$B1" = "hold_expired" ] || { echo "boundary -20min: expected hold_expired, got '$B1'"; race3_fail=1; }
P -q -c "update bookings set held_at = clock_timestamp() - interval '19 minutes' where id='$BK'" >/dev/null
B2="$(P -t -A -c "select confirm_demo_payment('$BK','upi',210)" | xargs)"
[ "$B2" = "ok" ] || { echo "boundary -19min: expected ok, got '$B2'"; race3_fail=1; }

[ $race3_fail -eq 0 ] && echo "race 3: PASSED (5 expired + 5 live rounds, both outcomes asserted every round; boundary -20min refused, -19min payable; no deadlocks)" || FAIL=1

echo "== rollback verification (real rollback file on the same disposable cluster) =="
RB=drizzle/migrations/rollback/0012_slot_duration_and_atomic_payment.down.sql
P -v ON_ERROR_STOP=1 -q -f "$RB" && echo "rollback file applied OK"
rb_fail=0
check() { # name expected_sql actual
  if [ "$2" = "$3" ]; then echo "  ok: $1"; else echo "  FAIL: $1 (expected '$2', got '$3')"; rb_fail=1; fi
}
check "8-arg book_slot removed" \
  "$(P -t -A -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='book_slot' and pg_get_function_identity_arguments(p.oid) like '%p_slots%'")" "0"
check "confirm_demo_payment removed" \
  "$(P -t -A -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='confirm_demo_payment'")" "0"
check "duration sync trigger removed" \
  "$(P -t -A -c "select count(*) from pg_trigger where tgname='bookings_duration_sync' and not tgisinternal")" "0"
check "7-arg book_slot restored and callable" \
  "$(P -t -A -c "select book_slot(t_lead(), '2099-01-10'::date + 300, '07:00', true, true, 1, 'pending_deposit')")" "ok"
check "restored function rejects dry window (old semantics)" \
  "$(P -t -A -c "select book_slot(t_lead(), '2099-01-10'::date + 300, '12:00', true, false, 1, 'pending_deposit')")" "dry_window"
check "deposit guard still active after rollback" \
  "$(P -t -A -c "select count(*) from pg_trigger where tgname='bookings_guard_deposit' and not tgisinternal")" "1"
check "duration_slots column retained (harmless)" \
  "$(P -t -A -c "select count(*) from information_schema.columns where table_name='bookings' and column_name='duration_slots'")" "1"
[ $rb_fail -eq 0 ] && echo "rollback verification: PASSED" || FAIL=1

if [ $FAIL -eq 0 ] && [ $race_fail -eq 0 ]; then
  echo "RESULT: ALL DISPOSABLE-DB TESTS PASSED"
else
  echo "RESULT: TESTS FAILED"
  exit 1
fi

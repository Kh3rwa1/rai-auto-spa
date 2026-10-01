/**
 * SERVER-ONLY booking-writes switch — committed source, not runtime env.
 *
 * This module is part of the server bundle that the publishing pipeline
 * always ships, so the switch does not depend on Worker bindings or on
 * hosting env delivery. The booking desk opens ONLY when `open` is exactly
 * the boolean `true` — a missing key, false, a string, or a number all stay
 * paused (see write-pause.server.ts).
 *
 * CURRENT STATE: `open: true` — bookings are INTENTIONALLY OPEN in this
 * deployment (0014 acceptance passed; the desk reopens with this publish).
 *
 * The runtime environment can still FORCE a pause (`BOOKING_WRITES_PAUSE=1`);
 * that override wins over this setting wherever env is delivered at all.
 * Nothing here is read from client input and no environment values are
 * exposed to the client.
 *
 * To pause again: set `open: false` (or delete the key), commit, republish —
 * or set `BOOKING_WRITES_PAUSE=1` where env is delivered.
 */
export const BOOKING_WRITES_CONFIG: { open: boolean } = {
  open: true,
};

/**
 * Server-enforced maintenance pause for booking writes — FAIL-CLOSED.
 *
 * DEFAULT STATE: writes are PAUSED. Opening the booking desk requires the
 * deployment environment to set BOOKING_WRITES_OPEN=1 — a variable the
 * previously published app never read, so the paused default cannot depend
 * on the old app understanding any new environment setting.
 *
 * Activate (this is the default): publish as-is. Every mutating booking path
 * (upload, preview, quick start/hold/release, confirm, payment, reschedule,
 * offer claim, payment link, phone-agent webhook) refuses with
 * WRITE_PAUSE_MESSAGE. Availability reads and the dashboard stay open.
 *
 * Lift the pause (approval-gated): set BOOKING_WRITES_OPEN=1 in the hosting
 * environment. If env changes require a redeploy on the host, publish a
 * one-line change flipping the default here instead.
 */

export const WRITE_PAUSE_MESSAGE =
  "Rai's booking desk is paused for a quick upgrade — please try again in a few minutes.";

export function writesPaused(): boolean {
  return process.env["BOOKING_WRITES_OPEN"] !== "1";
}

/** Throws from inside server-fn handlers when writes are paused. */
export function assertWritesOpen(): void {
  if (writesPaused()) throw new Error(WRITE_PAUSE_MESSAGE);
}

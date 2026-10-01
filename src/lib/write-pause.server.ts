/**
 * Server-enforced maintenance pause for booking writes — FAIL-CLOSED.
 *
 * DEFAULT STATE: writes are PAUSED. Opening the desk requires the explicit
 * server-only configuration in booking-writes.config.ts to be exactly
 * `open: true` (committed source — delivered by the publishing pipeline
 * itself, independent of Worker bindings or hosting env delivery).
 *
 * Precedence (fail-closed):
 *   1. Environment PAUSE override — `BOOKING_WRITES_PAUSE=1` forces the
 *      pause and wins over the configured open setting, wherever the
 *      runtime delivers environment variables at all.
 *   2. Server-only configuration — `BOOKING_WRITES_CONFIG.open === true`
 *      opens the desk; anything else (missing key, false, wrong type)
 *      stays paused.
 *
 * Rejection shape: assertWritesOpen() tags the error (MAINTENANCE_PAUSED) and
 * sets the response status to 503, so server-function calls fail with
 * HTTP 503 AND a message the client can recognize — distinguishable from
 * genuine server/network failures. Client-side recognition lives in
 * write-pause-ui.ts (client-safe, no server env access). The phone-agent
 * webhook returns an explicit 503 JSON response.
 *
 * Lift the pause (approval-gated): set `open: true` in
 * booking-writes.config.ts, commit, republish. Pause again: set it back to
 * `false` and republish, or set `BOOKING_WRITES_PAUSE=1` where env is
 * delivered.
 */
import { setResponseStatus } from "@tanstack/react-start/server";
import { MAINTENANCE_TAG } from "./write-pause-ui";
import { BOOKING_WRITES_CONFIG } from "./booking-writes.config";

export const WRITE_PAUSE_MESSAGE =
  "Rai's booking desk is paused for a quick upgrade — please try again in a few minutes.";

export function writesPaused(): boolean {
  // Environment pause override wins over the configured open setting.
  if (process.env["BOOKING_WRITES_PAUSE"] === "1") return true;
  // Explicit server-only configuration; anything but literal true is paused.
  return BOOKING_WRITES_CONFIG.open !== true;
}

/** Throws a tagged, HTTP-503-marked rejection from server-fn handlers when paused. */
export function assertWritesOpen(): void {
  if (writesPaused()) {
    try {
      setResponseStatus(503, "Service Unavailable");
    } catch {
      // No request context (unit tests) — the tagged error still carries the signal.
    }
    throw new Error(`${MAINTENANCE_TAG}: ${WRITE_PAUSE_MESSAGE}`);
  }
}

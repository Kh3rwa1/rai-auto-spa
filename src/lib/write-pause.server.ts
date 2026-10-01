/**
 * Server-enforced maintenance pause for booking writes — FAIL-OPEN.
 *
 * DEFAULT STATE: writes are OPEN. The booking desk can be paused for
 * maintenance by setting BOOKING_WRITES_PAUSED=1 in the deployment
 * environment; any other value (or unset) keeps bookings flowing.
 *
 * Rejection shape: assertWritesOpen() tags the error (MAINTENANCE_PAUSED) and
 * sets the response status to 503, so server-function calls fail with
 * HTTP 503 AND a message the client can recognize — distinguishable from
 * genuine server/network failures. Client-side recognition lives in
 * write-pause-ui.ts (client-safe, no server env access). The phone-agent
 * webhook returns an explicit 503 JSON response.
 */
import { setResponseStatus } from "@tanstack/react-start/server";
import { MAINTENANCE_TAG } from "./write-pause-ui";

export const WRITE_PAUSE_MESSAGE =
  "Rai's booking desk is paused for a quick upgrade — please try again in a few minutes.";

export function writesPaused(): boolean {
  return process.env["BOOKING_WRITES_PAUSED"] === "1";
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

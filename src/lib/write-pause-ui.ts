/**
 * Client-safe maintenance-pause recognition. No server env access here.
 *
 * The server's write-pause guard throws an error tagged MAINTENANCE_PAUSED and
 * marks the response 503. Depending on the transport layer the client may see
 * the tagged message, the 503 Response, or the raw JSON body — all recognized
 * below. Genuine network/server failures match nothing and keep their normal
 * error handling.
 */

export const PAUSED_NOTICE =
  "Bookings are temporarily paused for an update. Please try again shortly.";

/** Error-tag prefix embedded by the server's write-pause guard. */
export const MAINTENANCE_TAG = "MAINTENANCE_PAUSED";
/** Fallbacks: raw 503 responses and alternate payload wordings. */
const PAUSED_MARKERS = [MAINTENANCE_TAG, '"paused":true', "paused for a quick upgrade"];

export function isPausedError(e: unknown): boolean {
  if (typeof Response !== "undefined" && e instanceof Response) return e.status === 503;
  const msg = typeof e === "string" ? e : e instanceof Error ? e.message : "";
  return PAUSED_MARKERS.some((m) => msg.includes(m));
}

/** Toast/display message for a caught booking error: pause notice or the original. */
export function bookingErrorMessage(e: unknown, fallback: string): string {
  return isPausedError(e) ? PAUSED_NOTICE : fallback;
}

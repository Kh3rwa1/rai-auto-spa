import { afterEach, describe, expect, it } from "vitest";

const { assertManageToken } = await import("./booking-core");
const pause = await import("./write-pause.server");
const ui = await import("./write-pause-ui");

describe("assertManageToken (ownership rule)", () => {
  const TOKEN = "abcd1234abcd1234"; // 16 chars, matches server-side manage_token

  it("refuses when the token is omitted — a booking UUID alone cannot modify", () => {
    expect(() => assertManageToken(TOKEN, undefined)).toThrow(/can't be modified here/);
    expect(() => assertManageToken(TOKEN, "")).toThrow(/can't be modified here/);
  });

  it("refuses a mismatched token", () => {
    expect(() => assertManageToken(TOKEN, "zzzz9999zzzz9999")).toThrow(/doesn't match/);
  });

  it("accepts the token that was handed to the booking's creator", () => {
    expect(() => assertManageToken(TOKEN, TOKEN)).not.toThrow();
  });

  it("refuses when the row has no token context at all", () => {
    expect(() => assertManageToken(null, undefined)).toThrow(/can't be modified here/);
  });
});

describe("write pause (fail-open default)", () => {
  afterEach(() => {
    delete process.env["BOOKING_WRITES_PAUSED"];
  });

  it("writes are OPEN by default (env unset)", () => {
    expect(pause.writesPaused()).toBe(false);
  });

  it("pauses only when BOOKING_WRITES_PAUSED=1", () => {
    process.env["BOOKING_WRITES_PAUSED"] = "1";
    expect(pause.writesPaused()).toBe(true);
  });

  it("any other value stays open", () => {
    for (const v of ["0", "true", "paused", ""]) {
      process.env["BOOKING_WRITES_PAUSED"] = v;
      expect(pause.writesPaused()).toBe(false);
    }
  });

  it("assertWritesOpen rejects with the MAINTENANCE_PAUSED-tagged error when paused", () => {
    process.env["BOOKING_WRITES_PAUSED"] = "1";
    let thrown: unknown;
    try {
      pause.assertWritesOpen();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("MAINTENANCE_PAUSED:");
    expect((thrown as Error).message).toContain("paused for a quick upgrade");
  });

  it("assertWritesOpen does not throw while writes are open", () => {
    expect(() => pause.assertWritesOpen()).not.toThrow();
  });
});

describe("pause recognition on the client", () => {
  it("recognizes the thrown 503 Response", () => {
    process.env["BOOKING_WRITES_PAUSED"] = "1";
    let thrown: unknown;
    try {
      pause.assertWritesOpen();
    } catch (e) {
      thrown = e;
    } finally {
      delete process.env["BOOKING_WRITES_PAUSED"];
    }
    expect(ui.isPausedError(thrown)).toBe(true);
  });

  it("recognizes the pause payload when the body arrives as text", () => {
    expect(
      ui.isPausedError(
        new Error(JSON.stringify({ paused: true, message: pause.WRITE_PAUSE_MESSAGE })),
      ),
    ).toBe(true);
    expect(ui.isPausedError(pause.WRITE_PAUSE_MESSAGE)).toBe(true);
  });

  it("treats genuine connection/server failures as NOT paused", () => {
    expect(ui.isPausedError(new TypeError("Failed to fetch"))).toBe(false);
    expect(ui.isPausedError(new Error("Could not reserve the slot. Please try again."))).toBe(
      false,
    );
    expect(ui.isPausedError(undefined)).toBe(false);
  });

  it("bookingErrorMessage swaps in the required notice only for pauses", () => {
    const paused = new Error(JSON.stringify({ paused: true }));
    expect(
      ui.bookingErrorMessage(paused, "Couldn't start your booking. Check your connection."),
    ).toBe(ui.PAUSED_NOTICE);
    expect(ui.bookingErrorMessage(new TypeError("Failed to fetch"), "Connection fallback")).toBe(
      "Connection fallback",
    );
    expect(ui.PAUSED_NOTICE).toBe(
      "Bookings are temporarily paused for an update. Please try again shortly.",
    );
  });
});

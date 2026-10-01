import { afterEach, describe, expect, it } from "vitest";

const { assertManageToken } = await import("./booking-core");
const pause = await import("./write-pause.server");

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

describe("write pause (fail-closed default)", () => {
  afterEach(() => {
    delete process.env["BOOKING_WRITES_OPEN"];
  });

  it("writes are PAUSED by default (env unset)", () => {
    expect(pause.writesPaused()).toBe(true);
    expect(() => pause.assertWritesOpen()).toThrow(/paused for a quick upgrade/);
  });

  it("opens only when BOOKING_WRITES_OPEN=1", () => {
    process.env["BOOKING_WRITES_OPEN"] = "1";
    expect(pause.writesPaused()).toBe(false);
    expect(() => pause.assertWritesOpen()).not.toThrow();
  });

  it("any other value stays paused", () => {
    for (const v of ["0", "true", "open", ""]) {
      process.env["BOOKING_WRITES_OPEN"] = v;
      expect(pause.writesPaused()).toBe(true);
    }
  });
});

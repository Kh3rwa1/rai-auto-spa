/**
 * Phone helpers: IP-based country detection with a USA default (most visitors
 * are in the US) and strict E.164 storage so the voice agent can dial back.
 */

export const COUNTRY_DIAL: Record<string, { iso2: string; dial: string; label: string }> = {
  US: { iso2: "us", dial: "1", label: "USA" },
  CA: { iso2: "ca", dial: "1", label: "Canada" },
  GB: { iso2: "gb", dial: "44", label: "UK" },
  IN: { iso2: "in", dial: "91", label: "India" },
  AU: { iso2: "au", dial: "61", label: "Australia" },
};

export const DEFAULT_COUNTRY = "US";

/** Valid E.164: leading +, country digit 1-9, 8–15 digits total. */
export const E164_RE = /^\+[1-9]\d{7,14}$/;

export const isE164 = (v: string) => E164_RE.test(v.trim());

/** react-phone-input-2 hands back digits without "+"; store canonical E.164. */
export const toE164 = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};

export const prettyE164 = (v: string) => v;

/** Look up the visitor's country from their IP; falls back to USA. */
export async function detectCountry(signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch("https://ipapi.co/json/", signal ? { signal } : {});
    if (!res.ok) return DEFAULT_COUNTRY;
    const j = (await res.json()) as { country_code?: string };
    const cc = (j.country_code ?? "").toUpperCase();
    return COUNTRY_DIAL[cc] ? cc : DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}

export const countryLabel = (cc: string) => COUNTRY_DIAL[cc]?.label ?? "USA";
export const countryIso2 = (cc: string) => COUNTRY_DIAL[cc]?.iso2 ?? "us";
export const countryDial = (cc: string) => COUNTRY_DIAL[cc]?.dial ?? "1";

/** Regional-indicator flag for a 2-letter country code. */
export const flagEmoji = (cc: string) =>
  (COUNTRY_DIAL[cc] ? cc : DEFAULT_COUNTRY)
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");

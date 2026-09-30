/** Single source of truth for brand + sender identity and demo links. */
export const BRAND = {
  siteName: "Rai's Auto Spa",
  /** Verified sender subdomain delegated to Lovable's nameservers — never the root domain. */
  senderDomain: "notify.tinytales.tech",
  /** Domain shown in the From: header. */
  fromDomain: "tinytales.tech",
  /** Public source repo linked from the demo ribbon (replace once the repo is connected). */
  githubUrl: "https://github.com/rai-auto-spa/rai-auto-spa",
} as const;

/** Single source of truth for brand + sender identity and demo links. */
export const BRAND = {
  siteName: "Rai's Auto Spa",
  /** Verified sender subdomain delegated to Lovable's nameservers — never the root domain. */
  senderDomain: "notify.tinytales.tech",
  /** Domain shown in the From: header. */
  fromDomain: "tinytales.tech",
  /** Public source repo linked from the demo ribbon . */
  githubUrl: "https://github.com/Kh3rwa1/rai-auto-spa",
} as const;

import jpeg from "jpeg-js";

export type Box = { x: number; y: number; w: number; h: number }; // normalised 0..1

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

/** Sniff real image type from magic bytes (never trust the client's MIME). */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Validate a base64 upload: decodable, size-capped, real image bytes. Returns friendly errors. */
export function decodeUpload(b64: string): { ok: true; bytes: Uint8Array; mime: "image/jpeg" | "image/png" | "image/webp" } | { ok: false; error: string } {
  const clean = b64.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  if (!clean || clean.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return { ok: false, error: "That photo couldn't be read. Please try another one." };
  if ((clean.length * 3) / 4 > MAX_UPLOAD_BYTES) return { ok: false, error: "That photo is too large (max 6 MB). Please try a smaller one." };
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  } catch {
    return { ok: false, error: "That photo couldn't be read. Please try another one." };
  }
  if (bytes.length < 1024) return { ok: false, error: "That photo looks empty. Please try another one." };
  const mime = sniffImage(bytes);
  if (!mime) return { ok: false, error: "Please upload a JPG, PNG or WebP photo." };
  return { ok: true, bytes, mime };
}

/**
 * Pixelate + soften the plate region of a JPEG (pure JS, runs on the edge worker).
 * Returns null when the image can't be decoded, so callers can fall back gracefully.
 */
export function blurRegion(jpegBytes: Uint8Array, box: Box): Uint8Array | null {
  let img: { width: number; height: number; data: Uint8Array };
  try {
    img = jpeg.decode(jpegBytes, { useTArray: true, maxMemoryUsageInMB: 256 });
  } catch {
    return null;
  }
  const { width: W, height: H, data } = img;
  const pad = 0.25;
  const x0 = Math.max(0, Math.floor((box.x - box.w * pad) * W));
  const y0 = Math.max(0, Math.floor((box.y - box.h * pad) * H));
  const x1 = Math.min(W, Math.ceil((box.x + box.w * (1 + pad)) * W));
  const y1 = Math.min(H, Math.ceil((box.y + box.h * (1 + pad)) * H));
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const cell = Math.max(6, Math.round((x1 - x0) / 10));
  for (let by = y0; by < y1; by += cell) {
    for (let bx = x0; bx < x1; bx += cell) {
      const ex = Math.min(bx + cell, x1), ey = Math.min(by + cell, y1);
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) {
        const i = (y * W + x) * 4;
        r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++;
      }
      r /= n; g /= n; b /= n;
      for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) {
        const i = (y * W + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b;
      }
    }
  }
  return new Uint8Array(jpeg.encode({ data, width: W, height: H }, 85).data);
}

export function parseBox(v: unknown): Box | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const n = v.map(Number);
  if (n.some((x) => !Number.isFinite(x))) return null;
  let [x, y, w, h] = n as [number, number, number, number];
  if (Math.max(x, y, w, h) > 1.5) [x, y, w, h] = [x / 1000, y / 1000, w / 1000, h / 1000]; // tolerate 0..1000 scale
  if (w <= 0 || h <= 0 || w > 0.8 || h > 0.5 || x < 0 || y < 0 || x > 1 || y > 1) return null;
  return { x, y, w, h };
}

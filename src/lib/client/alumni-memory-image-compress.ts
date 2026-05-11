/**
 * Client-side resize + WebP/JPEG compression before alumni memory uploads (reduces storage + egress).
 * Safe no-op when canvas/WebP unsupported — caller may still upload original under server cap.
 */
const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_MAX_BYTES = 1.35 * 1024 * 1024;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    img.decoding = "async";
    img.src = src;
  });

const blobToFile = (blob: Blob, name: string) =>
  new File([blob], name, { type: blob.type || "image/jpeg", lastModified: Date.now() });

export const compressAlumniMemoryImageForUpload = async (
  file: File,
  opts?: { maxEdge?: number; maxBytes?: number }
): Promise<File> => {
  if (typeof window === "undefined" || typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const maxEdge = opts?.maxEdge ?? DEFAULT_MAX_EDGE;
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  if (file.size <= maxBytes && file.type === "image/webp") return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return file;

    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, tw, th);

    const tryEncode = (type: "image/webp" | "image/jpeg", quality: number): Promise<Blob | null> =>
      new Promise((res) => {
        canvas.toBlob((b) => res(b), type, quality);
      });

    let best: Blob | null = null;
    for (const type of ["image/webp", "image/jpeg"] as const) {
      for (let q = 0.88; q >= 0.52; q -= 0.06) {
        const b = await tryEncode(type, q);
        if (b && b.size <= maxBytes) {
          best = b;
          break;
        }
        if (b) best = b;
      }
      if (best && best.size <= maxBytes) break;
    }

    if (!best || best.size >= file.size) return file;
    const ext = best.type.includes("webp") ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "memory";
    return blobToFile(best, `${base}-optimized.${ext}`);
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

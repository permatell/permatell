/**
 * Client-side image compression for story cover images.
 *
 * Cover images above the free bundling limit would otherwise need Turbo
 * credits, so we re-encode them in the browser (canvas only, no dependency)
 * until the encoded bytes fit comfortably under that limit.
 */

import { FREE_UPLOAD_MAX_BYTES } from "@/lib/turbo";

/**
 * The free limit applies to the signed data item, not the raw bytes: signature,
 * owner, tags and headers add roughly a kilobyte on top of the payload. Aim
 * well below the limit so the envelope can never push us over.
 */
export const COMPRESSION_TARGET_BYTES = FREE_UPLOAD_MAX_BYTES - 10 * 1024;

/** Cover images are rendered in a sidebar column; nothing needs to be huge. */
const MAX_DIMENSION = 1600;

const DIMENSION_STEPS = [1280, 1024, 800, 640, 512, 400];

/**
 * Kept above the range where compression artifacts get obvious: a smaller image
 * at decent quality reads better than a large, badly mangled one.
 */
const QUALITY_STEPS = [0.82, 0.7, 0.58];

/** Only used at the smallest size, once shrinking alone has run out of room. */
const LAST_RESORT_QUALITY_STEPS = [0.45, 0.35, 0.25];

export interface CompressionResult {
  file: File;
  originalBytes: number;
  bytes: number;
  width: number;
  height: number;
  format: "image/webp" | "image/jpeg";
  /** True when a source alpha channel had to be flattened onto white. */
  alphaFlattened: boolean;
  /** False when even the smallest/lowest-quality encode stayed over target. */
  reachedTarget: boolean;
}

/** SVG is vector and GIF animation cannot survive a canvas re-encode. */
export function canCompressImageType(type: string): boolean {
  const normalized = (type || "").toLowerCase();
  return normalized.startsWith("image/") && normalized !== "image/svg+xml";
}

/**
 * Animated GIFs carry one graphic control extension per frame; a single one (or
 * none) means a still image that is safe to re-encode.
 */
export async function isAnimatedGif(file: File): Promise<boolean> {
  if ((file.type || "").toLowerCase() !== "image/gif") return false;

  const bytes = new Uint8Array(await file.arrayBuffer());
  let frames = 0;
  for (let i = 0; i < bytes.length - 3; i++) {
    if (
      bytes[i] === 0x00 &&
      bytes[i + 1] === 0x21 &&
      bytes[i + 2] === 0xf9 &&
      bytes[i + 3] === 0x04
    ) {
      frames++;
      if (frames > 1) return true;
    }
  }
  return false;
}

function supportsWebpEncoding(): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not read that image."));
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function drawToCanvas(
  decoded: DecodedImage,
  width: number,
  height: number,
  background?: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot compress images.");

  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(decoded.source, 0, 0, width, height);
  return canvas;
}

function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext("2d");
  if (!context) return false;

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

function encode(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode the image.")),
      format,
      quality
    );
  });
}

function scaledSize(
  width: number,
  height: number,
  longestEdge: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= longestEdge) return { width, height };

  const scale = longestEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function renamedForFormat(name: string, format: string): string {
  const extension = format === "image/webp" ? "webp" : "jpg";
  const base = name.replace(/\.[^.]+$/, "") || "cover-image";
  return `${base}.${extension}`;
}

/**
 * Re-encode `file` so it fits within `targetBytes`, stepping the longest edge
 * and the encoder quality down until it does. Returns the smallest encode it
 * managed even when the target is out of reach, so callers can report it.
 */
export async function compressImageToTarget(
  file: File,
  targetBytes: number = COMPRESSION_TARGET_BYTES
): Promise<CompressionResult> {
  const decoded = await decodeImage(file);

  try {
    const format: "image/webp" | "image/jpeg" = supportsWebpEncoding()
      ? "image/webp"
      : "image/jpeg";

    // JPEG cannot store alpha, so a transparent source has to be flattened.
    const sourceType = (file.type || "").toLowerCase();
    const mayHaveAlpha =
      sourceType !== "image/jpeg" && sourceType !== "image/jpg";
    const probe = scaledSize(decoded.width, decoded.height, 256);
    const alphaFlattened =
      format === "image/jpeg" &&
      mayHaveAlpha &&
      hasTransparency(drawToCanvas(decoded, probe.width, probe.height));
    const background = format === "image/jpeg" ? "#ffffff" : undefined;

    const startingEdge = Math.min(
      Math.max(decoded.width, decoded.height),
      MAX_DIMENSION
    );
    const edges = [
      startingEdge,
      ...DIMENSION_STEPS.filter((edge) => edge < startingEdge),
    ];
    const attempts = edges.flatMap((edge) =>
      QUALITY_STEPS.map((quality) => ({ edge, quality }))
    );
    for (const quality of LAST_RESORT_QUALITY_STEPS) {
      attempts.push({ edge: edges[edges.length - 1], quality });
    }

    const canvases = new Map<number, HTMLCanvasElement>();
    let best: { blob: Blob; width: number; height: number } | null = null;

    for (const { edge, quality } of attempts) {
      const { width, height } = scaledSize(decoded.width, decoded.height, edge);
      let canvas = canvases.get(edge);
      if (!canvas) {
        canvas = drawToCanvas(decoded, width, height, background);
        canvases.set(edge, canvas);
      }

      const blob = await encode(canvas, format, quality);
      if (!best || blob.size < best.blob.size) {
        best = { blob, width, height };
      }
      if (blob.size <= targetBytes) {
        return {
          file: new File([blob], renamedForFormat(file.name, format), {
            type: format,
          }),
          originalBytes: file.size,
          bytes: blob.size,
          width,
          height,
          format,
          alphaFlattened,
          reachedTarget: true,
        };
      }
    }

    if (!best) throw new Error("Could not compress that image.");

    return {
      file: new File([best.blob], renamedForFormat(file.name, format), {
        type: format,
      }),
      originalBytes: file.size,
      bytes: best.blob.size,
      width: best.width,
      height: best.height,
      format,
      alphaFlattened,
      reachedTarget: false,
    };
  } finally {
    decoded.release();
  }
}

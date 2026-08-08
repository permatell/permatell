import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const PLACEHOLDER_COVER = "/no_cover.webp";

/**
 * Only use a cover URL as <img src> when it looks complete.
 * Incomplete typed hosts (e.g. "permatell.vercel.app" while typing) become
 * relative URLs like https://p/ … https://permatell.vercel.ap/ and fail DNS.
 */
export function isCompleteHttpUrl(value?: string | null): boolean {
  const text = String(value || "").trim();
  if (!text) return false;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (!parsed.hostname.includes(".")) return false;
    const labels = parsed.hostname.split(".").filter(Boolean);
    if (labels.length < 2) return false;
    const tld = labels[labels.length - 1];
    return tld.length >= 2 && /^[a-z0-9-]+$/i.test(tld);
  } catch {
    return false;
  }
}

export function safeCoverImageSrc(value?: string | null): string {
  const text = String(value || "").trim();
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  return isCompleteHttpUrl(text) ? text : PLACEHOLDER_COVER;
}

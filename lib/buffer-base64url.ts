import { Buffer } from "buffer";

type BufferFrom = typeof Buffer.from;
type BufferIsEncoding = typeof Buffer.isEncoding;

const patchedKey = "__permatellBase64urlBufferPatched";
const patchedBufferKey = "__permatellBase64urlPatched";

function normalizeBase64url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return `${base64}${padding}`;
}

function patchBufferObject(target: typeof Buffer) {
  const patchable = target as typeof Buffer & { [patchedBufferKey]?: boolean };
  if (patchable[patchedBufferKey]) return;

  const originalFrom = target.from.bind(target) as BufferFrom;
  const originalIsEncoding = target.isEncoding.bind(target) as BufferIsEncoding;

  target.isEncoding = ((encoding: string) => {
    return encoding === "base64url" || originalIsEncoding(encoding);
  }) as BufferIsEncoding;

  target.from = ((value: unknown, encodingOrOffset?: unknown, length?: unknown) => {
    if (typeof value === "string" && encodingOrOffset === "base64url") {
      return originalFrom(normalizeBase64url(value), "base64");
    }
    return originalFrom(value as never, encodingOrOffset as never, length as never);
  }) as BufferFrom;

  patchable[patchedBufferKey] = true;
}

function patchBufferBase64url() {
  const global = globalThis as typeof globalThis & {
    Buffer?: typeof Buffer;
    [patchedKey]?: boolean;
  };

  if (global[patchedKey]) return;

  patchBufferObject(Buffer);
  if (global.Buffer && global.Buffer !== Buffer) {
    patchBufferObject(global.Buffer);
  }
  global.Buffer = Buffer;
  global[patchedKey] = true;
}

patchBufferBase64url();

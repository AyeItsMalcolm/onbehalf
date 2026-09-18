/**
 * WebCrypto adapter for the verifier core. No Node imports: this exact file
 * is bundled into the browser demo and also unit-tested under Node 22's
 * globalThis.crypto, which proves the browser path equals the CLI path.
 *
 * Ed25519 in WebCrypto: Chrome 137+, Safari 17+, Firefox 130+. If importKey
 * throws NotSupportedError the caller may supply a fallback verifier.
 */
import type { CryptoAdapter } from "./core.js";

export type Ed25519Fallback = (rawPub: Uint8Array, sig: Uint8Array, msg: Uint8Array) => Promise<boolean>;

export interface WebAdapterOptions {
  canonicalize: (value: unknown) => string | undefined;
  subtle?: SubtleCrypto;
  ed25519Fallback?: Ed25519Fallback;
  /** Receives "webcrypto" or "fallback" the first time a signature is checked. */
  onEngine?: (engine: "webcrypto" | "fallback") => void;
}

export async function webSha256(subtle: SubtleCrypto, bytes: Uint8Array): Promise<Uint8Array> {
  const buf = await subtle.digest("SHA-256", bytes as BufferSource);
  return new Uint8Array(buf);
}

export async function webEd25519Verify(
  subtle: SubtleCrypto,
  rawPub: Uint8Array,
  sig: Uint8Array,
  msg: Uint8Array,
): Promise<boolean> {
  const key = await subtle.importKey("raw", rawPub as BufferSource, { name: "Ed25519" }, false, ["verify"]);
  return subtle.verify({ name: "Ed25519" }, key, sig as BufferSource, msg as BufferSource);
}

export function createWebCryptoAdapter(opts: WebAdapterOptions): CryptoAdapter {
  const subtle = opts.subtle ?? globalThis.crypto.subtle;
  let engineReported = false;
  return {
    sha256: (bytes) => webSha256(subtle, bytes),
    ed25519Verify: async (rawPub, sig, msg) => {
      try {
        const ok = await webEd25519Verify(subtle, rawPub, sig, msg);
        if (!engineReported) {
          engineReported = true;
          opts.onEngine?.("webcrypto");
        }
        return ok;
      } catch (e) {
        const notSupported = (e as { name?: string }).name === "NotSupportedError";
        if (notSupported && opts.ed25519Fallback) {
          if (!engineReported) {
            engineReported = true;
            opts.onEngine?.("fallback");
          }
          return opts.ed25519Fallback(rawPub, sig, msg);
        }
        // A malformed signature or key is a verification failure, not a crash.
        if (!notSupported) return false;
        throw e;
      }
    },
    canonicalize: (value) => {
      const out = opts.canonicalize(value);
      if (typeof out !== "string") throw new Error("canonicalize returned no output");
      return out;
    },
  };
}

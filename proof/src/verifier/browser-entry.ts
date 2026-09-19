/**
 * Browser bundle entry. `pnpm build:demo` bundles this with esbuild into
 * demo/assets/verifier.js. The receipt page imports it and runs the SAME
 * verifier core as the CLI, with WebCrypto in place of node:crypto and the
 * same `canonicalize` package (Apache-2.0) for RFC 8785.
 */
import canonicalize from "canonicalize";

export { verifyPackage } from "./core.js";
export type { Check, VerificationReport, VerifierConfig } from "./core.js";
export { createWebCryptoAdapter, webEd25519Verify } from "./adapters-web.js";

export function canonicalizeJson(value: unknown): string | undefined {
  return canonicalize(value as Parameters<typeof canonicalize>[0]);
}

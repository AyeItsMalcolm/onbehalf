/** Node adapters for the verifier core: node:crypto + the canonicalize package. */
import canonicalize from "canonicalize";
import { ed25519Verify, sha256 } from "../crypto/node.js";
import type { CryptoAdapter } from "./core.js";

export const nodeCryptoAdapter: CryptoAdapter = {
  sha256: async (bytes) => sha256(bytes),
  ed25519Verify: async (rawPub, sig, msg) => ed25519Verify(rawPub, sig, msg),
  canonicalize: (value) => {
    const out = canonicalize(value as Parameters<typeof canonicalize>[0]);
    if (typeof out !== "string") throw new Error("canonicalize returned no output");
    return out;
  },
};

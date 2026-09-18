/**
 * RFC 8785 (JSON Canonicalization Scheme) via the `canonicalize` package.
 * Never hand-rolled (AGENTS.md §12).
 *
 * canonicalBytes(core)  → the exact UTF-8 bytes that are hashed and signed.
 * digestHex(bytes)      → "0x" + lowercase hex SHA-256, the on-chain bytes32.
 */
import canonicalize from "canonicalize";
import { sha256, toHex } from "./crypto/node.js";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function canonicalString(value: JsonValue): string {
  const out = canonicalize(value);
  if (typeof out !== "string") {
    throw new Error("canonicalize returned no output");
  }
  return out;
}

export function canonicalBytes(value: JsonValue): Uint8Array {
  return new TextEncoder().encode(canonicalString(value));
}

export function digestHex(bytes: Uint8Array): string {
  return `0x${toHex(sha256(bytes))}`;
}

/** sha256:<hex> form used inside the receipt for sub-digests. */
export function subDigest(value: JsonValue): string {
  return `sha256:${toHex(sha256(canonicalBytes(value)))}`;
}

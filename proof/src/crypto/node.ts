/**
 * Node-side cryptography for the Onbehalf receipt profile.
 *
 * Profile (PRODUCT_ARCHITECTURE.md §12.9):
 *   canonicalization RFC 8785 (see ../canonical.ts), digest SHA-256,
 *   signature Ed25519 over the canonical bytes, key reference = key ID +
 *   public-key fingerprint, base64url for binary material.
 *
 * Nothing here implements a primitive by hand. Everything delegates to
 * node:crypto. The private key never leaves a KeyObject and is never
 * serialized by this module except at generation time, into .env.
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";

export const ED25519_RAW_PUBLIC_KEY_BYTES = 32;
export const ED25519_SIGNATURE_BYTES = 64;

export function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(clean, "hex"));
}

export function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function fromBase64Url(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "base64url"));
}

/** 256-bit commitment nonce (PBX-011), base64url. */
export function generateCommitmentNonce(): string {
  return toBase64Url(randomBytes(32));
}

/** Raw 32-byte Ed25519 public key from a KeyObject, via its JWK form. */
export function rawPublicKey(pub: KeyObject): Uint8Array {
  const jwk = pub.export({ format: "jwk" }) as { kty?: string; crv?: string; x?: string };
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string") {
    throw new Error("Not an Ed25519 public key");
  }
  const raw = fromBase64Url(jwk.x);
  if (raw.length !== ED25519_RAW_PUBLIC_KEY_BYTES) {
    throw new Error(`Unexpected raw public key length ${raw.length}`);
  }
  return raw;
}

/** KeyObject from a raw 32-byte Ed25519 public key. */
export function publicKeyFromRaw(raw: Uint8Array): KeyObject {
  if (raw.length !== ED25519_RAW_PUBLIC_KEY_BYTES) {
    throw new Error(`Raw Ed25519 public key must be 32 bytes, got ${raw.length}`);
  }
  return createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: toBase64Url(raw) },
    format: "jwk",
  });
}

/** key_ + first 16 hex chars of SHA-256(raw public key). */
export function keyIdFor(raw: Uint8Array): string {
  return `key_${toHex(sha256(raw)).slice(0, 16)}`;
}

/** sha256: + full hex SHA-256(raw public key). */
export function fingerprintFor(raw: Uint8Array): string {
  return `sha256:${toHex(sha256(raw))}`;
}

export interface GeneratedSigningKey {
  /** PKCS8 DER, base64. Goes to .env only. */
  privateKeyPkcs8Base64: string;
  rawPublicKey: Uint8Array;
}

export function generateSigningKey(): GeneratedSigningKey {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = privateKey.export({ type: "pkcs8", format: "der" }) as Buffer;
  return {
    privateKeyPkcs8Base64: der.toString("base64"),
    rawPublicKey: rawPublicKey(publicKey),
  };
}

/** Load the issuer private key from the RECEIPT_SIGNING_KEY env var. */
export function loadSigningKey(env: NodeJS.ProcessEnv = process.env): KeyObject {
  const value = env.RECEIPT_SIGNING_KEY;
  if (!value) {
    throw new Error("RECEIPT_SIGNING_KEY is not set. Run `pnpm keygen` first.");
  }
  const key = createPrivateKey({
    key: Buffer.from(value, "base64"),
    format: "der",
    type: "pkcs8",
  });
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("RECEIPT_SIGNING_KEY is not an Ed25519 key");
  }
  return key;
}

export function publicKeyOf(priv: KeyObject): KeyObject {
  return createPublicKey(priv);
}

export function ed25519Sign(priv: KeyObject, message: Uint8Array): Uint8Array {
  return new Uint8Array(nodeSign(null, message, priv));
}

export function ed25519Verify(rawPub: Uint8Array, signature: Uint8Array, message: Uint8Array): boolean {
  if (signature.length !== ED25519_SIGNATURE_BYTES) return false;
  try {
    return nodeVerify(null, message, publicKeyFromRaw(rawPub), signature);
  } catch {
    return false;
  }
}

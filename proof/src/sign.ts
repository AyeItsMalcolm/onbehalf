/**
 * pnpm sign
 *
 * fixture receipt core → canonical bytes (RFC 8785) → SHA-256 digest
 * → Ed25519 signature → out/receipt.s2.package.json
 *
 * Plain English: we turn the receipt into one exact byte string that every
 * computer in the world will produce identically, take its fingerprint, and
 * sign that byte string with the issuer's private key. The package carries
 * the receipt, the fingerprint, the signature, and the public key needed to
 * check it. Anchor proof sits outside the signed bytes (PBX-015) and is
 * preserved across re-signs as long as the digest is unchanged.
 *
 * The private key is read from RECEIPT_SIGNING_KEY and never printed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalBytes, canonicalString, digestHex } from "./canonical.js";
import {
  ed25519Sign,
  ed25519Verify,
  fingerprintFor,
  keyIdFor,
  loadSigningKey,
  publicKeyOf,
  rawPublicKey,
  toBase64Url,
} from "./crypto/node.js";
import type { AnchorProof, ReceiptCore, ReceiptPackage } from "./receipt.js";

const ROOT = process.cwd();
const FIXTURE = resolve(ROOT, "fixtures/receipt.s2.json");
const OUT_DIR = resolve(ROOT, "out");
const OUT_CANONICAL = resolve(OUT_DIR, "receipt.s2.canonical.json");
const OUT_PACKAGE = resolve(OUT_DIR, "receipt.s2.package.json");

function main(): void {
  const core = JSON.parse(readFileSync(FIXTURE, "utf8")) as ReceiptCore;

  const priv = loadSigningKey();
  const raw = rawPublicKey(publicKeyOf(priv));
  const keyId = keyIdFor(raw);
  if (core.issuer.keyId !== keyId) {
    throw new Error(
      `fixture issuer.keyId ${core.issuer.keyId} does not match the signing key (${keyId}). Run pnpm fixture.`,
    );
  }

  const canonical = canonicalString(core as unknown as Parameters<typeof canonicalString>[0]);
  const bytes = canonicalBytes(core as unknown as Parameters<typeof canonicalBytes>[0]);
  const digest = digestHex(bytes);
  const signature = ed25519Sign(priv, bytes);

  // Self-check before writing: the signature must verify under the public key.
  if (!ed25519Verify(raw, signature, bytes)) {
    throw new Error("Self-check failed: signature does not verify under the derived public key");
  }

  let anchorProof: AnchorProof = {
    state: "NOT_SUBMITTED",
    reason: "not submitted in demo",
  };
  if (existsSync(OUT_PACKAGE)) {
    const prior = JSON.parse(readFileSync(OUT_PACKAGE, "utf8")) as Partial<ReceiptPackage>;
    if (prior.cryptographicProof?.digest === digest && prior.anchorProof) {
      anchorProof = prior.anchorProof;
    }
  }

  const pkg: ReceiptPackage = {
    receiptCore: core,
    cryptographicProof: {
      canonicalization: "RFC8785-JCS",
      digestAlgorithm: "SHA-256",
      digest,
      signatureAlgorithm: "Ed25519",
      signature: toBase64Url(signature),
      publicKey: toBase64Url(raw),
      publicKeyFingerprint: fingerprintFor(raw),
    },
    anchorProof,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_CANONICAL, canonical);
  writeFileSync(OUT_PACKAGE, `${JSON.stringify(pkg, null, 2)}\n`);

  console.log(`canonical bytes  ${bytes.length} bytes → ${OUT_CANONICAL}`);
  console.log(`digest           ${digest}`);
  console.log(`signature        ${pkg.cryptographicProof.signature}`);
  console.log(`publicKey        ${pkg.cryptographicProof.publicKey}`);
  console.log(`fingerprint      ${pkg.cryptographicProof.publicKeyFingerprint}`);
  console.log(`anchorProof      ${anchorProof.state}`);
  console.log(`package          ${OUT_PACKAGE}`);
}

main();

import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalBytes } from "../src/canonical.js";
import { ed25519Sign, ed25519Verify, fingerprintFor, fromBase64Url, rawPublicKey, toBase64Url } from "../src/crypto/node.js";
import { nodeCryptoAdapter } from "../src/verifier/adapters-node.js";
import { verifyPackage } from "../src/verifier/core.js";
import { clone, loadConfig, loadPackage, statuses } from "./helpers.js";

describe("signature", () => {
  it("genuine package: Schema, Digest, Signature, Issuer PASS; Anchor SKIPPED; VALID_UNANCHORED", async () => {
    const report = await verifyPackage(loadPackage(), loadConfig(), nodeCryptoAdapter);
    expect(statuses(report)).toEqual({
      Schema: "PASS",
      Digest: "PASS",
      Signature: "PASS",
      Issuer: "PASS",
      Anchor: "SKIPPED",
    });
    expect(report.result).toBe("VALID_UNANCHORED");
  });

  it("signature verifies directly over the canonical bytes with the packaged public key", () => {
    const pkg = loadPackage();
    const ok = ed25519Verify(
      fromBase64Url(pkg.cryptographicProof.publicKey),
      fromBase64Url(pkg.cryptographicProof.signature),
      canonicalBytes(pkg.receiptCore as never),
    );
    expect(ok).toBe(true);
  });

  it("wrong key (signature from another key, packaged key unchanged): Signature FAIL, INVALID", async () => {
    const pkg = clone(loadPackage());
    const { privateKey } = generateKeyPairSync("ed25519");
    pkg.cryptographicProof.signature = toBase64Url(ed25519Sign(privateKey, canonicalBytes(pkg.receiptCore as never)));
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Digest).toBe("PASS");
    expect(statuses(report).Signature).toBe("FAIL");
    expect(report.result).toBe("INVALID");
  });

  it("wrong key (re-signed and re-keyed by an impostor): Signature PASS but Issuer FAIL, INVALID", async () => {
    const pkg = clone(loadPackage());
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const raw = rawPublicKey(publicKey);
    pkg.cryptographicProof.signature = toBase64Url(ed25519Sign(privateKey, canonicalBytes(pkg.receiptCore as never)));
    pkg.cryptographicProof.publicKey = toBase64Url(raw);
    pkg.cryptographicProof.publicKeyFingerprint = fingerprintFor(raw);
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Signature).toBe("PASS");
    expect(statuses(report).Issuer).toBe("FAIL");
    expect(report.result).toBe("INVALID");
  });

  it("fingerprint in the package that does not match the packaged key: Issuer FAIL", async () => {
    const pkg = clone(loadPackage());
    pkg.cryptographicProof.publicKeyFingerprint = "sha256:" + "0".repeat(64);
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Issuer).toBe("FAIL");
    expect(report.result).toBe("INVALID");
  });

  it("truncated or garbage signature is a FAIL, not a crash", async () => {
    const pkg = clone(loadPackage());
    pkg.cryptographicProof.signature = "AAAA";
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Signature).toBe("FAIL");
  });
});

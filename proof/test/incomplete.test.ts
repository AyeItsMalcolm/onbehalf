import { describe, expect, it } from "vitest";
import { nodeCryptoAdapter } from "../src/verifier/adapters-node.js";
import { verifyPackage } from "../src/verifier/core.js";
import { clone, loadConfig, loadPackage, statuses } from "./helpers.js";

type Loose = Record<string, unknown>;

describe("missing proof material and unsupported profiles", () => {
  it("missing digest → Digest SKIPPED, INCOMPLETE", async () => {
    const pkg = clone(loadPackage());
    delete (pkg.cryptographicProof as unknown as Loose).digest;
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Digest).toBe("SKIPPED");
    expect(report.result).toBe("INCOMPLETE");
  });

  it("missing signature → Signature SKIPPED, INCOMPLETE", async () => {
    const pkg = clone(loadPackage());
    delete (pkg.cryptographicProof as unknown as Loose).signature;
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Signature).toBe("SKIPPED");
    expect(report.result).toBe("INCOMPLETE");
  });

  it("missing public key → Signature and Issuer SKIPPED, INCOMPLETE", async () => {
    const pkg = clone(loadPackage());
    delete (pkg.cryptographicProof as unknown as Loose).publicKey;
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Signature).toBe("SKIPPED");
    expect(statuses(report).Issuer).toBe("SKIPPED");
    expect(report.result).toBe("INCOMPLETE");
  });

  it("no cryptographicProof at all → INCOMPLETE, never valid", async () => {
    const pkg = clone(loadPackage());
    delete (pkg as unknown as Loose).cryptographicProof;
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(report.result).toBe("INCOMPLETE");
  });

  it("missing anchorProof → Anchor SKIPPED, still VALID_UNANCHORED (anchor is outside the signed core)", async () => {
    const pkg = clone(loadPackage());
    delete (pkg as unknown as Loose).anchorProof;
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Anchor).toBe("SKIPPED");
    expect(report.result).toBe("VALID_UNANCHORED");
  });

  it("unsupported signature algorithm → Schema FAIL, INVALID", async () => {
    const pkg = clone(loadPackage());
    (pkg.cryptographicProof as unknown as Loose).signatureAlgorithm = "RSA";
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Schema).toBe("FAIL");
    expect(report.result).toBe("INVALID");
  });

  it("unknown schema name or version → Schema FAIL", async () => {
    const pkg = clone(loadPackage());
    (pkg.receiptCore as unknown as Loose).schemaVersion = "9.9.9";
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Schema).toBe("FAIL");
  });

  it("not even an object → Schema FAIL and everything else SKIPPED", async () => {
    const report = await verifyPackage("hello", loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Schema).toBe("FAIL");
    expect(report.result).toBe("INVALID");
  });
});

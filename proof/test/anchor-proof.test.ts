/**
 * PBX-015: anchor proof lives outside the signed core, so changing it never
 * touches Digest or Signature. The Anchor check itself is exercised with an
 * in-memory chain reader; no network, no key.
 */
import { describe, expect, it } from "vitest";
import { nodeCryptoAdapter } from "../src/verifier/adapters-node.js";
import { verifyPackage, type AnchorReader, type VerifierConfig } from "../src/verifier/core.js";
import { clone, loadConfig, loadPackage, statuses } from "./helpers.js";

const CONTRACT = "0x1111111111111111111111111111111111111111";
const ISSUER = "0x2222222222222222222222222222222222222222";
const BLOCK_HASH = "0x" + "ab".repeat(32);
const TX = "0x" + "cd".repeat(32);
const SCHEMA_ID = "0x" + "ef".repeat(32);

function anchoredConfig(): VerifierConfig {
  const c = loadConfig();
  return { ...c, anchor: { ...c.anchor, contractAddress: CONTRACT, issuerAddress: ISSUER, minConfirmations: 2 } };
}

function anchoredPackage() {
  const pkg = clone(loadPackage());
  pkg.anchorProof = {
    state: "ANCHORED",
    chainId: 97,
    contractAddress: CONTRACT,
    issuerAddress: ISSUER,
    transactionHash: TX,
    blockNumber: 12884201,
    blockHash: BLOCK_HASH,
    confirmationsObserved: 2,
    schemaId: SCHEMA_ID,
  };
  return pkg;
}

function fakeReader(overrides: Partial<AnchorReader> = {}): AnchorReader {
  const pkg = loadPackage();
  const digest = pkg.cryptographicProof.digest;
  return {
    chainId: async () => 97,
    committedAtBlock: async (contract, issuer, d) =>
      contract === CONTRACT && issuer === ISSUER && d === digest ? 12884201n : 0n,
    blockHash: async (n) => (n === 12884201n ? BLOCK_HASH : null),
    latestBlockNumber: async () => 12884205n,
    commitEventPresent: async (tx, contract, issuer, d, schemaId) =>
      tx === TX && contract === CONTRACT && issuer === ISSUER && d === digest && schemaId === SCHEMA_ID,
    ...overrides,
  };
}

describe("anchor proof is outside the signed core (PBX-015)", () => {
  it("editing anchorProof leaves Digest and Signature PASS", async () => {
    const pkg = clone(loadPackage());
    pkg.anchorProof = { state: "PENDING", reason: "submitted, waiting for confirmations", blockNumber: 1 };
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Digest).toBe("PASS");
    expect(statuses(report).Signature).toBe("PASS");
    expect(statuses(report).Anchor).toBe("SKIPPED");
    expect(report.result).toBe("VALID_UNANCHORED");
  });

  it("ANCHORED claimed but no chain access → Anchor SKIPPED, VALID_UNANCHORED (never VALID on a claim)", async () => {
    const report = await verifyPackage(anchoredPackage(), anchoredConfig(), nodeCryptoAdapter);
    expect(statuses(report).Anchor).toBe("SKIPPED");
    expect(report.result).toBe("VALID_UNANCHORED");
  });
});

describe("anchor check against an in-memory chain", () => {
  it("all sub-checks pass → Anchor PASS, VALID", async () => {
    const report = await verifyPackage(anchoredPackage(), anchoredConfig(), nodeCryptoAdapter, {
      anchorReader: fakeReader(),
    });
    expect(statuses(report).Anchor).toBe("PASS");
    expect(report.result).toBe("VALID");
    const anchor = report.checks.find((c) => c.name === "Anchor")!;
    expect(anchor.lines?.every((l) => l.startsWith("ok "))).toBe(true);
  });

  it("digest not committed for the issuer → Anchor FAIL, INVALID", async () => {
    const report = await verifyPackage(anchoredPackage(), anchoredConfig(), nodeCryptoAdapter, {
      anchorReader: fakeReader({ committedAtBlock: async () => 0n }),
    });
    expect(statuses(report).Anchor).toBe("FAIL");
    expect(report.result).toBe("INVALID");
  });

  it("wrong chain id → Anchor FAIL, other checks untouched", async () => {
    const report = await verifyPackage(anchoredPackage(), anchoredConfig(), nodeCryptoAdapter, {
      anchorReader: fakeReader({ chainId: async () => 56 }),
    });
    const s = statuses(report);
    expect(s.Anchor).toBe("FAIL");
    expect(s.Digest).toBe("PASS");
    expect(s.Signature).toBe("PASS");
  });

  it("too few confirmations → Anchor FAIL", async () => {
    const report = await verifyPackage(anchoredPackage(), anchoredConfig(), nodeCryptoAdapter, {
      anchorReader: fakeReader({ latestBlockNumber: async () => 12884201n }),
    });
    expect(statuses(report).Anchor).toBe("FAIL");
  });

  it("package names a different contract than the trusted config → Anchor FAIL", async () => {
    const pkg = anchoredPackage();
    pkg.anchorProof.contractAddress = "0x3333333333333333333333333333333333333333";
    const report = await verifyPackage(pkg, anchoredConfig(), nodeCryptoAdapter, { anchorReader: fakeReader() });
    expect(statuses(report).Anchor).toBe("FAIL");
  });

  it("tampered core with a real-looking anchor → digest lookup uses the RECOMPUTED digest and fails", async () => {
    const pkg = anchoredPackage();
    pkg.receiptCore.action.amountMinor = 95000;
    const report = await verifyPackage(pkg, anchoredConfig(), nodeCryptoAdapter, { anchorReader: fakeReader() });
    const s = statuses(report);
    expect(s.Digest).toBe("FAIL");
    expect(s.Signature).toBe("FAIL");
    expect(s.Anchor).toBe("FAIL");
    expect(report.result).toBe("INVALID");
  });
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReceiptPackage } from "../src/receipt.js";
import { nodeCryptoAdapter } from "../src/verifier/adapters-node.js";
import { verifyPackage } from "../src/verifier/core.js";
import { clone, getAt, leafPaths, loadConfig, loadPackage, mutate, setAt, statuses } from "./helpers.js";

const TAMPERED = resolve(import.meta.dirname, "../../out/receipt.s2.tampered.json");

describe("tamper detection", () => {
  it("every leaf of receiptCore, changed in turn, yields Digest FAIL + Signature FAIL + INVALID", async () => {
    const base = loadPackage();
    const config = loadConfig();
    const paths = leafPaths(base.receiptCore);
    expect(paths.length, "signed leaf fields; the narrated number").toBe(48);
    for (const path of paths) {
      const pkg = clone(base);
      setAt(pkg.receiptCore, path, mutate(getAt(pkg.receiptCore, path)));
      const report = await verifyPackage(pkg, config, nodeCryptoAdapter);
      const s = statuses(report);
      expect(s.Digest, `path ${path.join(".")}`).toBe("FAIL");
      expect(s.Signature, `path ${path.join(".")}`).toBe("FAIL");
      expect(report.result, `path ${path.join(".")}`).toBe("INVALID");
    }
  });

  it("adding an unknown field to the signed core also fails", async () => {
    const pkg = clone(loadPackage());
    (pkg.receiptCore as unknown as Record<string, unknown>).note = "added later";
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Digest).toBe("FAIL");
    expect(report.result).toBe("INVALID");
  });

  it("removing a field from the signed core fails Schema (and would fail Digest)", async () => {
    const pkg = clone(loadPackage());
    delete (pkg.receiptCore as unknown as Record<string, unknown>).commitmentNonce;
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report).Schema).toBe("FAIL");
    expect(report.result).toBe("INVALID");
  });

  it("out/receipt.s2.tampered.json (pnpm tamper) is INVALID with exactly Digest and Signature failing", async () => {
    expect(existsSync(TAMPERED), "run `pnpm tamper` first").toBe(true);
    const pkg = JSON.parse(readFileSync(TAMPERED, "utf8")) as ReceiptPackage;
    expect(pkg.receiptCore.action.amountMinor).toBe(95000);
    const report = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    expect(statuses(report)).toEqual({
      Schema: "PASS",
      Digest: "FAIL",
      Signature: "FAIL",
      Issuer: "PASS",
      Anchor: "SKIPPED",
    });
    expect(report.result).toBe("INVALID");
    expect(report.summary).toBe("failed: Digest, Signature");
  });
});

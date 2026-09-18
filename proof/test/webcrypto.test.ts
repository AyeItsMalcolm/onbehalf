/**
 * The browser path: verifier core + WebCrypto adapter, run under Node 22's
 * globalThis.crypto. Proves the demo page performs the same checks with the
 * same results as the CLI.
 */
import canonicalize from "canonicalize";
import { describe, expect, it } from "vitest";
import { nodeCryptoAdapter } from "../src/verifier/adapters-node.js";
import { createWebCryptoAdapter } from "../src/verifier/adapters-web.js";
import { verifyPackage } from "../src/verifier/core.js";
import { clone, loadConfig, loadPackage } from "./helpers.js";

const web = createWebCryptoAdapter({ canonicalize: (v) => canonicalize(v as never) });

describe("WebCrypto adapter (browser path)", () => {
  it("genuine package: identical report to the Node adapter", async () => {
    const pkg = loadPackage();
    const a = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    const b = await verifyPackage(pkg, loadConfig(), web);
    expect(b).toEqual(a);
    expect(b.result).toBe("VALID_UNANCHORED");
  });

  it("tampered package: identical report to the Node adapter", async () => {
    const pkg = clone(loadPackage());
    pkg.receiptCore.action.amountMinor = 95000;
    const a = await verifyPackage(pkg, loadConfig(), nodeCryptoAdapter);
    const b = await verifyPackage(pkg, loadConfig(), web);
    expect(b).toEqual(a);
    expect(b.result).toBe("INVALID");
  });

  it("reports which engine verified the signature", async () => {
    let engine: string | undefined;
    const adapter = createWebCryptoAdapter({ canonicalize: (v) => canonicalize(v as never), onEngine: (e) => (engine = e) });
    await verifyPackage(loadPackage(), loadConfig(), adapter);
    expect(engine).toBe("webcrypto");
  });
});

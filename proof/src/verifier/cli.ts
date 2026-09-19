/**
 * pnpm verify <package.json> [--no-anchor] [--json]
 *
 * Prints one line per check (PASS / FAIL / SKIPPED with a reason) and an
 * overall result. Exit codes: 0 VALID or VALID_UNANCHORED, 1 INVALID,
 * 2 INCOMPLETE, 3 usage or read error.
 *
 * The verifier trusts proof/verifier.config.json, not the package.
 * Chain access (for an ANCHORED package) needs RPC_URL in the environment;
 * without it, or with --no-anchor, the Anchor check is SKIPPED.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyPackage, type AnchorReader, type VerifierConfig } from "./core.js";
import { nodeCryptoAdapter } from "./adapters-node.js";
import { formatReport } from "./format.js";

const CONFIG_PATH = resolve(process.cwd(), "proof/verifier.config.json");

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const noAnchor = args.includes("--no-anchor");
  const asJson = args.includes("--json");
  if (!file) {
    console.error("usage: pnpm verify <package.json> [--no-anchor] [--json]");
    return 3;
  }

  let pkg: unknown;
  let config: VerifierConfig;
  try {
    pkg = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));
    config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as VerifierConfig;
  } catch (e) {
    console.error(`could not read input: ${(e as Error).message}`);
    return 3;
  }

  let anchorReader: AnchorReader | undefined;
  const state = (pkg as { anchorProof?: { state?: string } })?.anchorProof?.state;
  if (!noAnchor && state === "ANCHORED" && process.env.RPC_URL) {
    const { createAnchorReader } = await import("../anchor/reader.js");
    anchorReader = createAnchorReader({
      rpcUrl: process.env.RPC_URL,
      chainId: Number(process.env.CHAIN_ID ?? config.anchor.chainId),
    });
  }

  const report = await verifyPackage(pkg, config, nodeCryptoAdapter, anchorReader ? { anchorReader } : {});

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Verifying ${file}`);
    console.log(`Trusted config: ${CONFIG_PATH}`);
    console.log("");
    console.log(formatReport(report));
  }

  switch (report.result) {
    case "VALID":
    case "VALID_UNANCHORED":
      return 0;
    case "INVALID":
      return 1;
    default:
      return 2;
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`verifier error: ${(e as Error).message}`);
    process.exit(3);
  },
);

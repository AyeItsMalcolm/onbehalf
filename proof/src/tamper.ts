/**
 * pnpm tamper
 *
 * Copies the signed package and changes ONE field inside the signed core:
 * receiptCore.action.amountMinor 75000 → 95000 ($750.00 → $950.00).
 * Nothing else changes: same digest claim, same signature, same public key.
 *
 * Then `pnpm verify out/receipt.s2.tampered.json` must report Digest FAIL and
 * Signature FAIL and overall INVALID. That is the whole point: a receipt
 * cannot be quietly edited after the fact.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReceiptPackage } from "./receipt.js";

const SRC = resolve(process.cwd(), "out/receipt.s2.package.json");
const DST = resolve(process.cwd(), "out/receipt.s2.tampered.json");
export const TAMPERED_AMOUNT_MINOR = 95000;

function main(): void {
  const pkg = JSON.parse(readFileSync(SRC, "utf8")) as ReceiptPackage;
  const before = pkg.receiptCore.action.amountMinor;
  pkg.receiptCore.action.amountMinor = TAMPERED_AMOUNT_MINOR;
  writeFileSync(DST, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`Copied ${SRC}`);
  console.log(`Changed receiptCore.action.amountMinor ${before} → ${TAMPERED_AMOUNT_MINOR}`);
  console.log(`Left digest, signature, and public key untouched`);
  console.log(`Wrote ${DST}`);
  console.log(`Now run: pnpm verify out/receipt.s2.tampered.json  (expect INVALID: Digest, Signature)`);
}

main();

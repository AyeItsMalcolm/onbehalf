/**
 * pnpm keygen
 *
 * Creates the issuer's Ed25519 signing key once and stores the private half
 * in .env as RECEIPT_SIGNING_KEY. Prints ONLY public material: key ID,
 * fingerprint, and the base64url public key. If a key already exists in the
 * environment, it is reused and its public parts are printed.
 *
 * The private key is never printed, logged, or written anywhere but .env.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  fingerprintFor,
  generateSigningKey,
  keyIdFor,
  loadSigningKey,
  publicKeyOf,
  rawPublicKey,
  toBase64Url,
} from "./crypto/node.js";

const ENV_PATH = resolve(process.cwd(), ".env");
const VAR = "RECEIPT_SIGNING_KEY";

function assertEnvIgnored(): void {
  try {
    execFileSync("git", ["check-ignore", "-q", ".env"], { stdio: "ignore" });
  } catch {
    throw new Error(".env is not gitignored. Refusing to write a private key.");
  }
}

function envHasVar(): boolean {
  if (!existsSync(ENV_PATH)) return false;
  const text = readFileSync(ENV_PATH, "utf8");
  return text.split(/\r?\n/).some((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
    return m?.[1] === VAR && (m[2] ?? "").trim().length > 0;
  });
}

function main(): void {
  assertEnvIgnored();

  let raw: Uint8Array;
  if (process.env[VAR] && process.env[VAR]!.trim().length > 0) {
    raw = rawPublicKey(publicKeyOf(loadSigningKey()));
    console.log("Existing RECEIPT_SIGNING_KEY found in .env. Reusing it.");
  } else if (envHasVar()) {
    throw new Error(".env already defines RECEIPT_SIGNING_KEY but it was not loaded. Run with --env-file=.env.");
  } else {
    const generated = generateSigningKey();
    raw = generated.rawPublicKey;
    const line = `${VAR}=${generated.privateKeyPkcs8Base64}\n`;
    if (!existsSync(ENV_PATH)) {
      writeFileSync(ENV_PATH, line, { mode: 0o600 });
    } else {
      const current = readFileSync(ENV_PATH, "utf8");
      appendFileSync(ENV_PATH, (current.endsWith("\n") || current.length === 0 ? "" : "\n") + line);
    }
    console.log("Generated a new Ed25519 signing key and wrote it to .env (private half not shown).");
  }

  console.log("");
  console.log(`keyId        ${keyIdFor(raw)}`);
  console.log(`fingerprint  ${fingerprintFor(raw)}`);
  console.log(`publicKey    ${toBase64Url(raw)}  (base64url, raw 32 bytes)`);
  console.log("");
  console.log("Next: put issuer.keyId in fixtures/receipt.s2.json, then `pnpm sign`.");
  console.log("Reminder: add ANCHOR_PRIVATE_KEY, RPC_URL, and CHAIN_ID to .env yourself for step 6.");
}

main();

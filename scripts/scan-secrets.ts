/**
 * pnpm scan:secrets
 *
 * Confirms no secret material is tracked by git. Reports found / not found
 * only; never prints a value. Exit 1 on any finding.
 *
 * Checks:
 *   1. .env is gitignored and not tracked.
 *   2. .env.example contains variable names only (no values).
 *   3. No tracked file contains secret-shaped text: Stripe key prefixes,
 *      PEM private-key markers, or an env assignment with a value for
 *      RECEIPT_SIGNING_KEY / ANCHOR_PRIVATE_KEY / RPC_URL.
 *   4. No tracked file contains the ACTUAL values from .env (loaded in
 *      process via --env-file-if-exists; compared, never echoed).
 *
 * DEMO_SCOPE.md §6 asks for `git grep` on `sk_`, `PRIVATE`, and the actual
 * key values. A bare `PRIVATE` would match the variable NAME
 * ANCHOR_PRIVATE_KEY in .env.example and docs by design, so this scan
 * matches private-key MATERIAL (PEM markers, assignments with values) rather than the word alone.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SECRET_VARS = ["RECEIPT_SIGNING_KEY", "ANCHOR_PRIVATE_KEY", "RPC_URL"] as const;
const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "Stripe secret key prefix", re: /\bsk_(live|test)_[A-Za-z0-9]{8,}/ },
  { name: "PEM header", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "PEM private key marker", re: /PRIVATE KEY-----/ },
  { name: "env assignment with a value", re: new RegExp(`^[ \\t]*(${SECRET_VARS.join("|")})[ \\t]*=[ \\t]*\\S+`, "m") },
];

let findings = 0;
const ok = (msg: string) => console.log(`ok       ${msg}`);
const bad = (msg: string) => {
  findings += 1;
  console.log(`FINDING  ${msg}`);
};

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

// 1. .env ignored and untracked
try {
  execFileSync("git", ["check-ignore", "-q", ".env"], { stdio: "ignore" });
  ok(".env is gitignored");
} catch {
  bad(".env is NOT gitignored");
}
const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
if (tracked.includes(".env")) bad(".env is tracked"); else ok(".env is not tracked");

// 2. .env.example names only
try {
  const lines = readFileSync(".env.example", "utf8").split(/\r?\n/);
  const withValues = lines.filter((l) => /^[A-Z0-9_]+=.+/.test(l.trim()));
  if (withValues.length) bad(`.env.example has ${withValues.length} line(s) with values`);
  else ok(".env.example has names only");
} catch {
  bad(".env.example missing");
}

// 3 + 4. scan tracked text files
// Binary files are skipped, and so is this scanner: its regex literals contain the marker text it hunts for.
const SELF = "scripts/scan-secrets.ts";
const textFiles = tracked.filter((f) => f !== SELF && !/\.(png|webm|mp4|woff2?|jpg|jpeg|gif|ico|pdf)$/i.test(f));
const secretValues = SECRET_VARS.map((v) => process.env[v]).filter((v): v is string => !!v && v.trim().length > 0);
let scanned = 0;
for (const file of textFiles) {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  scanned += 1;
  for (const p of PATTERNS) if (p.re.test(text)) bad(`${p.name} in ${file}`);
  for (const value of secretValues) {
    if (text.includes(value)) bad(`an actual .env secret value appears in ${file}`);
    // Also catch the base64 value with padding stripped or URL-safe variants.
    const variants = [value.replace(/=+$/, ""), value.replace(/\+/g, "-").replace(/\//g, "_")].filter((v) => v.length >= 20 && v !== value);
    for (const v of variants) if (text.includes(v)) bad(`a re-encoded .env secret value appears in ${file}`);
  }
}
ok(`scanned ${scanned} tracked text files for ${PATTERNS.length} patterns and ${secretValues.length} live value(s)`);

console.log("");
console.log(findings === 0 ? "Result   CLEAN" : `Result   ${findings} finding(s)`);
process.exit(findings === 0 ? 0 : 1);

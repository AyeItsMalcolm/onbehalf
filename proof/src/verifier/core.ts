/**
 * Independent receipt verifier core (PRODUCT_ARCHITECTURE.md §12.11).
 *
 * Pure and runtime-neutral: NO Node imports. Cryptography and canonicalization
 * arrive through adapters, so the same file runs in the CLI (node:crypto) and
 * in the browser (WebCrypto), and the browser demo provably runs the same
 * checks in the same order as the CLI.
 *
 * Checks, each reported separately, never collapsed into one badge:
 *   Schema     package shape and supported cryptographic profile
 *   Digest     SHA-256 of canonical receiptCore bytes == package digest
 *   Signature  Ed25519 over the same bytes verifies under the packaged key
 *   Issuer     packaged key fingerprint == recomputed == trusted config
 *   Anchor     public commitment on the configured chain/contract/issuer
 *
 * Overall: VALID | VALID_UNANCHORED | INVALID | INCOMPLETE.
 */

export type CheckName = "Schema" | "Digest" | "Signature" | "Issuer" | "Anchor";
export type CheckStatus = "PASS" | "FAIL" | "SKIPPED";
export type OverallResult = "VALID" | "VALID_UNANCHORED" | "INVALID" | "INCOMPLETE";

export interface Check {
  name: CheckName;
  status: CheckStatus;
  /** One line a human can read. */
  reason: string;
  /** Optional sub-lines (used by Anchor). */
  lines?: string[];
}

export interface VerificationReport {
  checks: Check[];
  result: OverallResult;
  summary: string;
  /** Recomputed digest, when the core could be canonicalized. */
  recomputedDigest?: string;
  canonicalByteLength?: number;
}

export interface CryptoAdapter {
  sha256(bytes: Uint8Array): Promise<Uint8Array>;
  ed25519Verify(rawPublicKey: Uint8Array, signature: Uint8Array, message: Uint8Array): Promise<boolean>;
  canonicalize(value: unknown): string;
}

/** Read-only chain access for the Anchor check. Implemented with viem in the CLI. */
export interface AnchorReader {
  chainId(): Promise<number>;
  committedAtBlock(contract: string, issuer: string, digest: string): Promise<bigint>;
  blockHash(blockNumber: bigint): Promise<string | null>;
  latestBlockNumber(): Promise<bigint>;
  commitEventPresent(txHash: string, contract: string, issuer: string, digest: string, schemaId: string): Promise<boolean>;
}

export interface VerifierConfig {
  schema: { name: string; supportedVersions: string[] };
  issuer: { issuerId: string; keyId: string; publicKeyFingerprint: string };
  anchor: {
    chainId: number;
    contractAddress: string | null;
    issuerAddress: string | null;
    minConfirmations: number;
  };
}

export interface VerifyOptions {
  /** When absent, an ANCHORED package gets Anchor SKIPPED (no chain access). */
  anchorReader?: AnchorReader;
}

// ---------- small encoding helpers (not cryptography) ----------

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function base64UrlToBytes(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// ---------- schema (structural) ----------

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

const CORE_SHAPE: Record<string, Record<string, (v: unknown) => boolean>> = {
  issuer: { issuerId: isStr, keyId: isStr },
  scope: { environment: isStr, coveredRoute: isStr, coverageClaim: isStr },
  subject: { organizationRef: isStr, agentRef: isStr, agentVersion: isStr },
  authority: {
    mandateRef: isStr,
    mandateVersion: isNum,
    mandateDigest: isStr,
    activeAtEvaluation: isBool,
    activeAtExecution: isBool,
  },
  action: {
    actionId: isStr,
    actionVersion: isNum,
    actionType: isStr,
    targetRef: isStr,
    amountMinor: isNum,
    currency: isStr,
    requestDigest: isStr,
  },
  policy: {
    policyRef: isStr,
    policyVersion: isNum,
    policyDigest: isStr,
    decision: isStr,
    reasonCodes: isStrArr,
    evaluatedAt: isStr,
  },
  approval: { required: isBool, decision: isStr, approverRef: isStr, bindingDigest: isStr, decidedAt: isStr },
  execution: {
    provider: isStr,
    providerEnvironment: isStr,
    operationRef: isStr,
    providerObjectRef: isStr,
    attemptedAt: isStr,
    observedState: isStr,
    observedAt: isStr,
    observationSources: isStrArr,
  },
  evidence: { level: isStr, recordedEventCount: isNum, evidenceManifestDigest: isStr, limitations: isStrArr },
};

const ANCHOR_STATES = new Set(["NOT_SUBMITTED", "PENDING", "ANCHORED", "FAILED"]);

function schemaProblems(pkg: unknown, config: VerifierConfig): string[] {
  const problems: string[] = [];
  if (!isRec(pkg)) return ["package is not a JSON object"];
  const core = pkg.receiptCore;
  if (!isRec(core)) return ["receiptCore missing or not an object"];

  if (core.schema !== config.schema.name) problems.push(`schema ${String(core.schema)} is not ${config.schema.name}`);
  if (!isStr(core.schemaVersion) || !config.schema.supportedVersions.includes(core.schemaVersion)) {
    problems.push(`schemaVersion ${String(core.schemaVersion)} not in supported ${config.schema.supportedVersions.join(", ")}`);
  }
  for (const k of ["receiptId", "issuedAt", "commitmentNonce"]) {
    if (!isStr(core[k])) problems.push(`receiptCore.${k} missing`);
  }
  for (const [section, fields] of Object.entries(CORE_SHAPE)) {
    const s = core[section];
    if (!isRec(s)) {
      problems.push(`receiptCore.${section} missing`);
      continue;
    }
    for (const [field, ok] of Object.entries(fields)) {
      if (!ok(s[field])) problems.push(`receiptCore.${section}.${field} missing or wrong type`);
    }
  }

  const proof = pkg.cryptographicProof;
  if (isRec(proof)) {
    if (proof.canonicalization !== "RFC8785-JCS") problems.push(`canonicalization ${String(proof.canonicalization)} unsupported`);
    if (proof.digestAlgorithm !== "SHA-256") problems.push(`digestAlgorithm ${String(proof.digestAlgorithm)} unsupported`);
    if (proof.signatureAlgorithm !== "Ed25519") problems.push(`signatureAlgorithm ${String(proof.signatureAlgorithm)} unsupported`);
  }
  const anchor = pkg.anchorProof;
  if (isRec(anchor) && !ANCHOR_STATES.has(String(anchor.state))) {
    problems.push(`anchorProof.state ${String(anchor.state)} unknown`);
  }
  return problems;
}

// ---------- the verifier ----------

/** Middle-ellipsize a hex value, keeping any "sha256:" or "0x" prefix intact. */
function shortHex(h: string): string {
  const m = h.match(/^(sha256:|0x)?(.*)$/);
  const prefix = m?.[1] ?? "";
  const body = m?.[2] ?? h;
  return body.length > 14 ? `${prefix}${body.slice(0, 8)}…${body.slice(-4)}` : h;
}

export async function verifyPackage(
  pkg: unknown,
  config: VerifierConfig,
  crypto: CryptoAdapter,
  options: VerifyOptions = {},
): Promise<VerificationReport> {
  const checks: Check[] = [];
  const report: VerificationReport = { checks, result: "INCOMPLETE", summary: "" };

  // 1. Schema
  const problems = schemaProblems(pkg, config);
  if (problems.length > 0) {
    checks.push({ name: "Schema", status: "FAIL", reason: problems.join("; ") });
  } else {
    const core = (pkg as Rec).receiptCore as Rec;
    checks.push({
      name: "Schema",
      status: "PASS",
      reason: `${String(core.schema)}@${String(core.schemaVersion)}, profile RFC8785-JCS / SHA-256 / Ed25519`,
    });
  }

  const p = isRec(pkg) ? pkg : {};
  const core = isRec(p.receiptCore) ? p.receiptCore : null;
  const proof = isRec(p.cryptographicProof) ? p.cryptographicProof : null;
  const anchor = isRec(p.anchorProof) ? p.anchorProof : null;

  // Canonical bytes (needed by Digest and Signature)
  let canonical: Uint8Array | null = null;
  let recomputed: string | null = null;
  if (core) {
    try {
      canonical = utf8Bytes(crypto.canonicalize(core));
      recomputed = `0x${bytesToHex(await crypto.sha256(canonical))}`;
      report.recomputedDigest = recomputed;
      report.canonicalByteLength = canonical.length;
    } catch (e) {
      canonical = null;
    }
  }

  // 2. Digest
  if (!proof || !isStr(proof.digest)) {
    checks.push({ name: "Digest", status: "SKIPPED", reason: "cryptographicProof.digest missing" });
  } else if (!canonical || !recomputed) {
    checks.push({ name: "Digest", status: "FAIL", reason: "receiptCore could not be canonicalized" });
  } else if (recomputed === proof.digest.toLowerCase()) {
    checks.push({
      name: "Digest",
      status: "PASS",
      reason: `${shortHex(recomputed)} recomputed from ${canonical.length} canonical bytes`,
    });
  } else {
    checks.push({
      name: "Digest",
      status: "FAIL",
      reason: `recomputed ${shortHex(recomputed)} ≠ package ${shortHex(proof.digest)}; receiptCore changed after signing`,
    });
  }

  // 3. Signature
  let rawPub: Uint8Array | null = null;
  if (proof && isStr(proof.publicKey)) {
    try {
      rawPub = base64UrlToBytes(proof.publicKey);
    } catch {
      rawPub = null;
    }
  }
  if (!proof || !isStr(proof.signature)) {
    checks.push({ name: "Signature", status: "SKIPPED", reason: "cryptographicProof.signature missing" });
  } else if (!rawPub) {
    checks.push({ name: "Signature", status: "SKIPPED", reason: "cryptographicProof.publicKey missing or unreadable" });
  } else if (!canonical) {
    checks.push({ name: "Signature", status: "FAIL", reason: "receiptCore could not be canonicalized" });
  } else {
    let ok = false;
    try {
      ok = rawPub.length === 32 && (await crypto.ed25519Verify(rawPub, base64UrlToBytes(proof.signature), canonical));
    } catch {
      ok = false;
    }
    checks.push(
      ok
        ? { name: "Signature", status: "PASS", reason: "Ed25519 over canonical bytes verifies under the packaged public key" }
        : { name: "Signature", status: "FAIL", reason: "Ed25519 signature does not verify over these canonical bytes" },
    );
  }

  // 4. Issuer
  if (!rawPub) {
    checks.push({ name: "Issuer", status: "SKIPPED", reason: "no public key to fingerprint" });
  } else {
    const fp = `sha256:${bytesToHex(await crypto.sha256(rawPub))}`;
    const issues: string[] = [];
    if (!proof || proof.publicKeyFingerprint !== fp) issues.push("packaged fingerprint ≠ recomputed");
    if (fp !== config.issuer.publicKeyFingerprint) issues.push("fingerprint ≠ configured issuer key");
    const issuer = core && isRec(core.issuer) ? core.issuer : null;
    if (!issuer || issuer.issuerId !== config.issuer.issuerId) issues.push("issuerId ≠ configured");
    if (!issuer || issuer.keyId !== config.issuer.keyId) issues.push("keyId ≠ configured");
    checks.push(
      issues.length === 0
        ? {
            name: "Issuer",
            status: "PASS",
            reason: `fingerprint ${shortHex(fp)} matches configured issuer ${config.issuer.issuerId} (${config.issuer.keyId})`,
          }
        : { name: "Issuer", status: "FAIL", reason: issues.join("; ") },
    );
  }

  // 5. Anchor
  checks.push(await anchorCheck(anchor, recomputed, config, options.anchorReader));

  // Overall
  const failed = checks.filter((c) => c.status === "FAIL");
  const coreSkipped = checks.filter((c) => c.name !== "Anchor" && c.status === "SKIPPED");
  const anchorCheckResult = checks.find((c) => c.name === "Anchor");
  if (failed.length > 0) {
    report.result = "INVALID";
    report.summary = `failed: ${failed.map((c) => c.name).join(", ")}`;
  } else if (coreSkipped.length > 0) {
    report.result = "INCOMPLETE";
    report.summary = `missing proof material: ${coreSkipped.map((c) => c.name).join(", ")}`;
  } else if (anchorCheckResult?.status === "PASS") {
    report.result = "VALID";
    report.summary = "receipt integrity, issuer, and public commitment verified";
  } else {
    report.result = "VALID_UNANCHORED";
    report.summary = `receipt integrity and issuer verified; anchor ${anchorCheckResult?.reason ?? "not checked"}`;
  }
  return report;
}

async function anchorCheck(
  anchor: Rec | null,
  recomputedDigest: string | null,
  config: VerifierConfig,
  reader: AnchorReader | undefined,
): Promise<Check> {
  if (!anchor) return { name: "Anchor", status: "SKIPPED", reason: "anchorProof missing" };
  const state = String(anchor.state);
  if (state !== "ANCHORED") {
    const reason = isStr(anchor.reason) ? anchor.reason : state.toLowerCase().replace("_", " ");
    return { name: "Anchor", status: "SKIPPED", reason: `${state}: ${reason}` };
  }
  if (!reader) {
    return { name: "Anchor", status: "SKIPPED", reason: "ANCHORED claimed but no chain access (run with RPC_URL to check)" };
  }
  if (!recomputedDigest) return { name: "Anchor", status: "FAIL", reason: "no recomputed digest to look up" };
  if (!config.anchor.contractAddress || !config.anchor.issuerAddress) {
    return { name: "Anchor", status: "FAIL", reason: "verifier config has no trusted contract/issuer address" };
  }

  const lines: string[] = [];
  let ok = true;
  const line = (good: boolean, text: string) => {
    lines.push(`${good ? "ok " : "BAD"} ${text}`);
    if (!good) ok = false;
  };

  try {
    const chainId = await reader.chainId();
    line(chainId === config.anchor.chainId && anchor.chainId === chainId, `chain id ${chainId} (expected ${config.anchor.chainId})`);
    line(
      String(anchor.contractAddress).toLowerCase() === config.anchor.contractAddress.toLowerCase(),
      `contract ${String(anchor.contractAddress)} matches configured`,
    );
    line(
      String(anchor.issuerAddress).toLowerCase() === config.anchor.issuerAddress.toLowerCase(),
      `issuer address ${String(anchor.issuerAddress)} matches configured`,
    );
    const block = await reader.committedAtBlock(config.anchor.contractAddress, config.anchor.issuerAddress, recomputedDigest);
    line(block > 0n, `digest ${shortHex(recomputedDigest)} committed at block ${block.toString()}`);
    if (block > 0n) {
      line(BigInt(String(anchor.blockNumber)) === block, `package blockNumber ${String(anchor.blockNumber)} matches chain`);
      const hash = await reader.blockHash(block);
      line(!!hash && hash.toLowerCase() === String(anchor.blockHash).toLowerCase(), `block hash ${shortHex(String(hash))} matches package`);
      const latest = await reader.latestBlockNumber();
      const confirmations = latest - block + 1n;
      line(confirmations >= BigInt(config.anchor.minConfirmations), `${confirmations.toString()} confirmations (min ${config.anchor.minConfirmations})`);
      const eventOk = await reader.commitEventPresent(
        String(anchor.transactionHash),
        config.anchor.contractAddress,
        config.anchor.issuerAddress,
        recomputedDigest,
        String(anchor.schemaId),
      );
      line(eventOk, `EvidenceCommitted(issuer, digest, schemaId) present in tx ${shortHex(String(anchor.transactionHash))}`);
    }
  } catch (e) {
    return { name: "Anchor", status: "FAIL", reason: `chain read failed: ${(e as Error).message}`, lines };
  }

  return ok
    ? { name: "Anchor", status: "PASS", reason: `committed on chain ${config.anchor.chainId} by configured issuer`, lines }
    : { name: "Anchor", status: "FAIL", reason: "one or more anchor sub-checks failed", lines };
}

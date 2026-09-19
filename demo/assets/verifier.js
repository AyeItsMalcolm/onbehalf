// Bundled by `pnpm build:demo` from proof/src/verifier (core + WebCrypto adapter)
// and the canonicalize package (Apache-2.0). Same checks, same order, as the CLI.

// node_modules/.pnpm/canonicalize@5.0.0/node_modules/canonicalize/lib/canonicalize.js
function serializeString(value) {
  if (!value.isWellFormed()) {
    throw new Error("Lone surrogate is not allowed");
  }
  return JSON.stringify(value);
}
function serializePrimitive(value) {
  switch (typeof value) {
    case "number":
      if (isNaN(value)) {
        throw new Error("NaN is not allowed");
      }
      if (!isFinite(value)) {
        throw new Error("Infinity is not allowed");
      }
      return JSON.stringify(value);
    case "string":
      return serializeString(value);
    case "boolean":
      return value ? "true" : "false";
    default:
      return JSON.stringify(value);
  }
}
function enterValue(value, seen) {
  let wrappers = null;
  while (value !== null && typeof value === "object" && typeof value.toJSON === "function") {
    if (seen.has(value)) {
      throw new Error("Circular reference detected");
    }
    seen.add(value);
    (wrappers ??= []).push(value);
    value = value.toJSON();
  }
  if (value instanceof Number || value instanceof String || value instanceof Boolean) {
    value = value.valueOf();
  }
  if (value === null || typeof value !== "object") {
    if (wrappers !== null) {
      for (const wrapper of wrappers) seen.delete(wrapper);
    }
    return serializePrimitive(value);
  }
  if (seen.has(value)) {
    throw new Error("Circular reference detected");
  }
  seen.add(value);
  return {
    container: value,
    // null marks an array frame; object frames carry their sorted keys.
    // `sort()`'s default comparator orders by UTF-16 code unit, which is the
    // order JCS requires.
    keys: Array.isArray(value) ? null : Object.keys(value).sort(),
    // Next child to serialize; the frame resumes here after a nested
    // container's subtree completes.
    index: 0,
    // Whether no member has been emitted yet (controls comma placement).
    first: true,
    // toJSON wrappers to release from `seen` when this frame completes.
    wrappers
  };
}
function canonicalize(object) {
  if (object === null || typeof object !== "object") {
    return serializePrimitive(object);
  }
  const seen = /* @__PURE__ */ new Set();
  const root = enterValue(object, seen);
  if (typeof root !== "object") {
    return root;
  }
  let result = root.keys === null ? "[" : "{";
  const stack = [root];
  outer:
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const container = frame.container;
      if (frame.keys === null) {
        while (frame.index < container.length) {
          const i = frame.index++;
          if (i > 0) {
            result += ",";
          }
          const element = container[i];
          const value = element === void 0 || typeof element === "symbol" || typeof element === "function" ? null : element;
          if (value === null || typeof value !== "object") {
            result += serializePrimitive(value);
            continue;
          }
          const child = enterValue(value, seen);
          if (typeof child !== "object") {
            result += child === void 0 ? "null" : child;
            continue;
          }
          result += child.keys === null ? "[" : "{";
          stack.push(child);
          continue outer;
        }
        result += "]";
      } else {
        const keys = frame.keys;
        while (frame.index < keys.length) {
          const key = keys[frame.index++];
          const value = container[key];
          if (value === void 0 || typeof value === "symbol" || typeof value === "function") {
            continue;
          }
          if (value === null || typeof value !== "object") {
            if (frame.first) {
              frame.first = false;
            } else {
              result += ",";
            }
            result += serializeString(key) + ":" + serializePrimitive(value);
            continue;
          }
          const child = enterValue(value, seen);
          if (child === void 0) {
            continue;
          }
          if (frame.first) {
            frame.first = false;
          } else {
            result += ",";
          }
          result += serializeString(key) + ":";
          if (typeof child !== "object") {
            result += child;
            continue;
          }
          result += child.keys === null ? "[" : "{";
          stack.push(child);
          continue outer;
        }
        result += "}";
      }
      seen.delete(container);
      if (frame.wrappers !== null) {
        for (const wrapper of frame.wrappers) seen.delete(wrapper);
      }
      stack.pop();
    }
  return result;
}

// proof/src/verifier/core.ts
function bytesToHex(bytes) {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}
function base64UrlToBytes(text) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function utf8Bytes(text) {
  return new TextEncoder().encode(text);
}
var isRec = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isStr = (v) => typeof v === "string" && v.length > 0;
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
var isBool = (v) => typeof v === "boolean";
var isStrArr = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
var CORE_SHAPE = {
  issuer: { issuerId: isStr, keyId: isStr },
  scope: { environment: isStr, coveredRoute: isStr, coverageClaim: isStr },
  subject: { organizationRef: isStr, agentRef: isStr, agentVersion: isStr },
  authority: {
    mandateRef: isStr,
    mandateVersion: isNum,
    mandateDigest: isStr,
    activeAtEvaluation: isBool,
    activeAtExecution: isBool
  },
  action: {
    actionId: isStr,
    actionVersion: isNum,
    actionType: isStr,
    targetRef: isStr,
    amountMinor: isNum,
    currency: isStr,
    requestDigest: isStr
  },
  policy: {
    policyRef: isStr,
    policyVersion: isNum,
    policyDigest: isStr,
    decision: isStr,
    reasonCodes: isStrArr,
    evaluatedAt: isStr
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
    observationSources: isStrArr
  },
  evidence: { level: isStr, recordedEventCount: isNum, evidenceManifestDigest: isStr, limitations: isStrArr }
};
var ANCHOR_STATES = /* @__PURE__ */ new Set(["NOT_SUBMITTED", "PENDING", "ANCHORED", "FAILED"]);
function schemaProblems(pkg, config) {
  const problems = [];
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
function shortHex(h) {
  const m = h.match(/^(sha256:|0x)?(.*)$/);
  const prefix = m?.[1] ?? "";
  const body = m?.[2] ?? h;
  return body.length > 14 ? `${prefix}${body.slice(0, 8)}\u2026${body.slice(-4)}` : h;
}
async function verifyPackage(pkg, config, crypto, options = {}) {
  const checks = [];
  const report = { checks, result: "INCOMPLETE", summary: "" };
  const problems = schemaProblems(pkg, config);
  if (problems.length > 0) {
    checks.push({ name: "Schema", status: "FAIL", reason: problems.join("; ") });
  } else {
    const core2 = pkg.receiptCore;
    checks.push({
      name: "Schema",
      status: "PASS",
      reason: `${String(core2.schema)}@${String(core2.schemaVersion)}, profile RFC8785-JCS / SHA-256 / Ed25519`
    });
  }
  const p = isRec(pkg) ? pkg : {};
  const core = isRec(p.receiptCore) ? p.receiptCore : null;
  const proof = isRec(p.cryptographicProof) ? p.cryptographicProof : null;
  const anchor = isRec(p.anchorProof) ? p.anchorProof : null;
  let canonical = null;
  let recomputed = null;
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
  if (!proof || !isStr(proof.digest)) {
    checks.push({ name: "Digest", status: "SKIPPED", reason: "cryptographicProof.digest missing" });
  } else if (!canonical || !recomputed) {
    checks.push({ name: "Digest", status: "FAIL", reason: "receiptCore could not be canonicalized" });
  } else if (recomputed === proof.digest.toLowerCase()) {
    checks.push({
      name: "Digest",
      status: "PASS",
      reason: `${shortHex(recomputed)} recomputed from ${canonical.length} canonical bytes`
    });
  } else {
    checks.push({
      name: "Digest",
      status: "FAIL",
      reason: `recomputed ${shortHex(recomputed)} \u2260 package ${shortHex(proof.digest)}; receiptCore changed after signing`
    });
  }
  let rawPub = null;
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
      ok = rawPub.length === 32 && await crypto.ed25519Verify(rawPub, base64UrlToBytes(proof.signature), canonical);
    } catch {
      ok = false;
    }
    checks.push(
      ok ? { name: "Signature", status: "PASS", reason: "Ed25519 over canonical bytes verifies under the packaged public key" } : { name: "Signature", status: "FAIL", reason: "Ed25519 signature does not verify over these canonical bytes" }
    );
  }
  if (!rawPub) {
    checks.push({ name: "Issuer", status: "SKIPPED", reason: "no public key to fingerprint" });
  } else {
    const fp = `sha256:${bytesToHex(await crypto.sha256(rawPub))}`;
    const issues = [];
    if (!proof || proof.publicKeyFingerprint !== fp) issues.push("packaged fingerprint \u2260 recomputed");
    if (fp !== config.issuer.publicKeyFingerprint) issues.push("fingerprint \u2260 configured issuer key");
    const issuer = core && isRec(core.issuer) ? core.issuer : null;
    if (!issuer || issuer.issuerId !== config.issuer.issuerId) issues.push("issuerId \u2260 configured");
    if (!issuer || issuer.keyId !== config.issuer.keyId) issues.push("keyId \u2260 configured");
    checks.push(
      issues.length === 0 ? {
        name: "Issuer",
        status: "PASS",
        reason: `fingerprint ${shortHex(fp)} matches configured issuer ${config.issuer.issuerId} (${config.issuer.keyId})`
      } : { name: "Issuer", status: "FAIL", reason: issues.join("; ") }
    );
  }
  checks.push(await anchorCheck(anchor, recomputed, config, options.anchorReader));
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
async function anchorCheck(anchor, recomputedDigest, config, reader) {
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
  const lines = [];
  let ok = true;
  const line = (good, text) => {
    lines.push(`${good ? "ok " : "BAD"} ${text}`);
    if (!good) ok = false;
  };
  try {
    const chainId = await reader.chainId();
    line(chainId === config.anchor.chainId && anchor.chainId === chainId, `chain id ${chainId} (expected ${config.anchor.chainId})`);
    line(
      String(anchor.contractAddress).toLowerCase() === config.anchor.contractAddress.toLowerCase(),
      `contract ${String(anchor.contractAddress)} matches configured`
    );
    line(
      String(anchor.issuerAddress).toLowerCase() === config.anchor.issuerAddress.toLowerCase(),
      `issuer address ${String(anchor.issuerAddress)} matches configured`
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
        String(anchor.schemaId)
      );
      line(eventOk, `EvidenceCommitted(issuer, digest, schemaId) present in tx ${shortHex(String(anchor.transactionHash))}`);
    }
  } catch (e) {
    return { name: "Anchor", status: "FAIL", reason: `chain read failed: ${e.message}`, lines };
  }
  return ok ? { name: "Anchor", status: "PASS", reason: `committed on chain ${config.anchor.chainId} by configured issuer`, lines } : { name: "Anchor", status: "FAIL", reason: "one or more anchor sub-checks failed", lines };
}

// proof/src/verifier/adapters-web.ts
async function webSha256(subtle, bytes) {
  const buf = await subtle.digest("SHA-256", bytes);
  return new Uint8Array(buf);
}
async function webEd25519Verify(subtle, rawPub, sig, msg) {
  const key = await subtle.importKey("raw", rawPub, { name: "Ed25519" }, false, ["verify"]);
  return subtle.verify({ name: "Ed25519" }, key, sig, msg);
}
function createWebCryptoAdapter(opts) {
  const subtle = opts.subtle ?? globalThis.crypto.subtle;
  let engineReported = false;
  return {
    sha256: (bytes) => webSha256(subtle, bytes),
    ed25519Verify: async (rawPub, sig, msg) => {
      try {
        const ok = await webEd25519Verify(subtle, rawPub, sig, msg);
        if (!engineReported) {
          engineReported = true;
          opts.onEngine?.("webcrypto");
        }
        return ok;
      } catch (e) {
        const notSupported = e.name === "NotSupportedError";
        if (notSupported && opts.ed25519Fallback) {
          if (!engineReported) {
            engineReported = true;
            opts.onEngine?.("fallback");
          }
          return opts.ed25519Fallback(rawPub, sig, msg);
        }
        if (!notSupported) return false;
        throw e;
      }
    },
    canonicalize: (value) => {
      const out = opts.canonicalize(value);
      if (typeof out !== "string") throw new Error("canonicalize returned no output");
      return out;
    }
  };
}

// proof/src/verifier/browser-entry.ts
function canonicalizeJson(value) {
  return canonicalize(value);
}
export {
  canonicalizeJson,
  createWebCryptoAdapter,
  verifyPackage,
  webEd25519Verify
};

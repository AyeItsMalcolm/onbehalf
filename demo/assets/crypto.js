// Onbehalf demo — real cryptography in the browser.
// SHA-256 via SubtleCrypto. Nothing here is simulated.

const enc = new TextEncoder();

export function bytesToHex(bytes) {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return bytesToHex(new Uint8Array(buf));
}

/**
 * Approval binding digest, exactly as proof/src/binding.ts computes it.
 * The binding object is flat (strings and small integers only), so sorted-key
 * JSON.stringify is byte-identical to RFC 8785. proof/test/binding.test.ts
 * proves that equality against the canonicalize library.
 */
export function bindingCanonical(facts) {
  const sorted = {};
  for (const k of Object.keys(facts).sort()) sorted[k] = facts[k];
  return JSON.stringify(sorted);
}

export async function bindingDigest(facts) {
  return `sha256:${await sha256Hex(bindingCanonical(facts))}`;
}

export function factsFromCore(core, amountMinorOverride) {
  return {
    actionId: core.action.actionId,
    actionVersion: core.action.actionVersion,
    actionType: core.action.actionType,
    targetRef: core.action.targetRef,
    amountMinor: amountMinorOverride ?? core.action.amountMinor,
    currency: core.action.currency,
    mandateRef: core.authority.mandateRef,
    mandateVersion: core.authority.mandateVersion,
    policyRef: core.policy.policyRef,
    policyVersion: core.policy.policyVersion,
  };
}

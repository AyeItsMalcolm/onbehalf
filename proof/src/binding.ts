/**
 * Approval binding digest.
 *
 * Plain English: the approver signs off on THESE exact facts. If any of them
 * change (amount, target, mandate version, policy version...), the digest
 * changes and the old approval no longer matches (AGENTS.md §9 invariant 3).
 *
 * The object is deliberately flat with only strings and small integers, so a
 * browser can reproduce the canonical form with sorted-key JSON.stringify and
 * SubtleCrypto SHA-256. proof/test/binding.test.ts proves that equals
 * RFC 8785 output from `canonicalize`.
 */
import { canonicalBytes, type JsonValue } from "./canonical.js";
import { sha256, toHex } from "./crypto/node.js";

export interface BindingFacts {
  actionId: string;
  actionVersion: number;
  actionType: string;
  targetRef: string;
  amountMinor: number;
  currency: string;
  mandateRef: string;
  mandateVersion: number;
  policyRef: string;
  policyVersion: number;
}

export const BINDING_KEYS: ReadonlyArray<keyof BindingFacts> = [
  "actionId",
  "actionType",
  "actionVersion",
  "amountMinor",
  "currency",
  "mandateRef",
  "mandateVersion",
  "policyRef",
  "policyVersion",
  "targetRef",
];

export function bindingObject(facts: BindingFacts): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const key of BINDING_KEYS) out[key] = facts[key];
  return out;
}

/** Same shape the browser uses: sorted keys, no whitespace. */
export function bindingCanonicalBrowserStyle(facts: BindingFacts): string {
  const sorted = Object.keys(facts)
    .sort()
    .reduce<Record<string, JsonValue>>((acc, k) => {
      acc[k] = facts[k as keyof BindingFacts];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

export function bindingDigest(facts: BindingFacts): string {
  return `sha256:${toHex(sha256(canonicalBytes(bindingObject(facts))))}`;
}

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bindingCanonicalBrowserStyle, bindingDigest, bindingObject, type BindingFacts } from "../src/binding.js";
import { canonicalString } from "../src/canonical.js";
import { loadFixtureCore } from "./helpers.js";

function factsFromFixture(): BindingFacts {
  const c = loadFixtureCore();
  return {
    actionId: c.action.actionId,
    actionVersion: c.action.actionVersion,
    actionType: c.action.actionType,
    targetRef: c.action.targetRef,
    amountMinor: c.action.amountMinor,
    currency: c.action.currency,
    mandateRef: c.authority.mandateRef,
    mandateVersion: c.authority.mandateVersion,
    policyRef: c.policy.policyRef,
    policyVersion: c.policy.policyVersion,
  };
}

describe("approval binding digest", () => {
  it("equals the fixture's approval.bindingDigest", () => {
    expect(bindingDigest(factsFromFixture())).toBe(loadFixtureCore().approval.bindingDigest);
  });

  it("browser-style sorted JSON.stringify is byte-identical to RFC 8785 for the flat binding object", () => {
    const facts = factsFromFixture();
    expect(bindingCanonicalBrowserStyle(facts)).toBe(canonicalString(bindingObject(facts) as never));
    const browserDigest = `sha256:${createHash("sha256").update(bindingCanonicalBrowserStyle(facts)).digest("hex")}`;
    expect(browserDigest).toBe(bindingDigest(facts));
  });

  it("changing the amount by one cent changes the digest", () => {
    const facts = factsFromFixture();
    const a = bindingDigest(facts);
    const b = bindingDigest({ ...facts, amountMinor: facts.amountMinor + 1 });
    expect(b).not.toBe(a);
    expect(bindingDigest(facts)).toBe(a);
  });

  it("changing the target, mandate version, or policy version changes the digest", () => {
    const facts = factsFromFixture();
    const a = bindingDigest(facts);
    expect(bindingDigest({ ...facts, targetRef: "pi_other" })).not.toBe(a);
    expect(bindingDigest({ ...facts, mandateVersion: 4 })).not.toBe(a);
    expect(bindingDigest({ ...facts, policyVersion: 2 })).not.toBe(a);
  });
});

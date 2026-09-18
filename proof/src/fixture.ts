/**
 * pnpm fixture
 *
 * Assembles fixtures/receipt.s2.json (the S2 "$750 human approval" receipt
 * core) from the small source fixtures in fixtures/s2/. Every sha256:… value
 * in the core is a real hash of a real file, so a judge can ask "what is
 * mandateDigest?" and the answer is "the hash of fixtures/s2/mandate.v3.json".
 *
 * Idempotent: if the core already exists, its commitmentNonce and issuedAt are
 * reused so re-running never changes the signed bytes.
 *
 * Honest labeling: execution and evidence values are fixture data. No Stripe
 * call happened. See fixtures/README.md and EXPLAINER.md.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bindingDigest } from "./binding.js";
import { subDigest, type JsonValue } from "./canonical.js";
import { generateCommitmentNonce, keyIdFor, loadSigningKey, publicKeyOf, rawPublicKey } from "./crypto/node.js";
import { SCHEMA, SCHEMA_VERSION, type ReceiptCore } from "./receipt.js";

const ROOT = process.cwd();
const S2 = resolve(ROOT, "fixtures/s2");
const OUT = resolve(ROOT, "fixtures/receipt.s2.json");

/** The S2 story timeline. Approval expiry is 15 minutes (§12.4). */
const STORY = {
  receiptId: "rcpt_s2_7f3a9c2e",
  issuedAt: "2026-09-18T21:04:30Z",
  evaluatedAt: "2026-09-18T21:00:00Z",
  decidedAt: "2026-09-18T21:02:00Z",
  attemptedAt: "2026-09-18T21:03:00Z",
  observedAt: "2026-09-18T21:04:00Z",
  approverRef: "approver_j_tan",
  operationRef: "op_s2_4h8j2n6r",
  providerObjectRef: "re_3QxTk9LmN2vRc8dE1Kp7Hs2a",
} as const;

/** From PRODUCT_ARCHITECTURE.md §14.1, with "Blackbox" → "Onbehalf" per PBX-021 item 6. */
const LIMITATIONS = [
  "Covers only the configured Onbehalf gateway route",
  "Does not prove absence of actions made with other credentials",
];

function readJson(name: string): Record<string, JsonValue> {
  return JSON.parse(readFileSync(resolve(S2, name), "utf8")) as Record<string, JsonValue>;
}

function str(o: Record<string, JsonValue>, k: string): string {
  const v = o[k];
  if (typeof v !== "string") throw new Error(`fixture field ${k} must be a string`);
  return v;
}
function num(o: Record<string, JsonValue>, k: string): number {
  const v = o[k];
  if (typeof v !== "number") throw new Error(`fixture field ${k} must be a number`);
  return v;
}

function main(): void {
  const mandate = readJson("mandate.v3.json");
  const policy = readJson("policy.v1.json");
  const request = readJson("request.json");
  const manifest = readJson("evidence-manifest.json");
  const events = manifest.events;
  if (!Array.isArray(events)) throw new Error("evidence-manifest.json needs an events array");

  const keyId = keyIdFor(rawPublicKey(publicKeyOf(loadSigningKey())));

  let nonce = generateCommitmentNonce();
  let issuedAt: string = STORY.issuedAt;
  const hadPrior = existsSync(OUT);
  if (hadPrior) {
    const prior = JSON.parse(readFileSync(OUT, "utf8")) as Partial<ReceiptCore>;
    if (typeof prior.commitmentNonce === "string") nonce = prior.commitmentNonce;
    if (typeof prior.issuedAt === "string") issuedAt = prior.issuedAt;
  }

  const requestedBy = request.requestedBy as Record<string, JsonValue>;

  const core: ReceiptCore = {
    schema: SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    receiptId: STORY.receiptId,
    issuedAt,
    issuer: { issuerId: "onbehalf-demo", keyId },
    scope: {
      environment: "test",
      coveredRoute: "stripe_sandbox_default",
      coverageClaim: "gateway_observed",
    },
    subject: {
      organizationRef: str(mandate, "organizationRef"),
      agentRef: str(requestedBy, "agentRef"),
      agentVersion: str(requestedBy, "agentVersion"),
    },
    authority: {
      mandateRef: str(mandate, "mandateRef"),
      mandateVersion: num(mandate, "mandateVersion"),
      mandateDigest: subDigest(mandate),
      activeAtEvaluation: true,
      activeAtExecution: true,
    },
    action: {
      actionId: str(request, "actionId"),
      actionVersion: num(request, "actionVersion"),
      actionType: str(request, "actionType"),
      targetRef: str(request, "targetRef"),
      amountMinor: num(request, "amountMinor"),
      currency: str(request, "currency"),
      requestDigest: subDigest(request),
    },
    policy: {
      policyRef: str(policy, "policyRef"),
      policyVersion: num(policy, "policyVersion"),
      policyDigest: subDigest(policy),
      decision: "REQUIRE_APPROVAL",
      reasonCodes: ["HUMAN_APPROVAL_REQUIRED"],
      evaluatedAt: STORY.evaluatedAt,
    },
    approval: {
      required: true,
      decision: "APPROVED",
      approverRef: STORY.approverRef,
      bindingDigest: "", // filled below from the action + authority + policy facts
      decidedAt: STORY.decidedAt,
    },
    execution: {
      provider: "stripe",
      providerEnvironment: "sandbox",
      operationRef: STORY.operationRef,
      providerObjectRef: STORY.providerObjectRef,
      attemptedAt: STORY.attemptedAt,
      observedState: "SUCCEEDED",
      observedAt: STORY.observedAt,
      observationSources: ["direct_response"],
    },
    evidence: {
      level: "PROVIDER_OBSERVED",
      recordedEventCount: events.length,
      evidenceManifestDigest: subDigest(manifest),
      limitations: LIMITATIONS,
    },
    commitmentNonce: nonce,
  };

  core.approval.bindingDigest = bindingDigest({
    actionId: core.action.actionId,
    actionVersion: core.action.actionVersion,
    actionType: core.action.actionType,
    targetRef: core.action.targetRef,
    amountMinor: core.action.amountMinor,
    currency: core.action.currency,
    mandateRef: core.authority.mandateRef,
    mandateVersion: core.authority.mandateVersion,
    policyRef: core.policy.policyRef,
    policyVersion: core.policy.policyVersion,
  });

  writeFileSync(OUT, `${JSON.stringify(core, null, 2)}\n`);
  console.log(`Wrote ${OUT}`);
  console.log(`receiptId       ${core.receiptId}`);
  console.log(`issuer.keyId    ${core.issuer.keyId}`);
  console.log(`amount          ${core.action.amountMinor} ${core.action.currency} (minor units)`);
  console.log(`bindingDigest   ${core.approval.bindingDigest}`);
  console.log(`commitmentNonce ${hadPrior ? "kept from prior file" : "newly generated"} (256-bit, base64url)`);
}

main();

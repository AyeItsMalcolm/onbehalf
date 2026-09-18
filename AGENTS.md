# Project Blackbox — Agent Instructions

This file governs work in the Project Blackbox repository. It translates the full project documents into concise operating rules for Asa, Codex, and future engineering agents.

The detailed rationale lives in `docs/`. Read the relevant source before changing a boundary you do not understand.

## 1. Mission

Build the smallest credible V0 that proves this path:

> A registered agent requests a Stripe test-mode refund through Blackbox. Blackbox authenticates the agent, checks an active mandate, applies deterministic policy, obtains an approval bound to the exact action when required, executes at most one logical refund, records the provider outcome, signs a minimized receipt, commits its digest to Base Sepolia, and independently detects receipt tampering.

Preserve the distinction between authority, policy, approval, execution, provider observation, receipt integrity, and blockchain anchoring. Do not combine them into one generic “verified” state.

## 2. Required reading

Read these files in order before broad or security-sensitive work:

1. `docs/MASTER_CONTEXT.md` — company, founder, goals, thesis, customer wedge, and assumptions.
2. `docs/BUILD_PHILOSOPHY.md` — Graph Engineering, Workflow Language, verification loops, RAID, and delivery standards.
3. `docs/PRODUCT_ARCHITECTURE.md` — V0 actors, states, components, data, APIs, receipts, and acceptance behavior.
4. `docs/SECURITY_PRINCIPLES.md` — threat model, invariants, controls, evidence limits, and release gates.
5. `docs/DECISIONS.md` — approved, working, deferred, rejected, and open decisions.
6. `docs/V0_EXECUTION_PLAN.md` — milestone order, work contracts, tests, critical path, and definition of V0 complete.

For a bounded task, read the sections that control it. For architecture, authority, cryptography, security, data, provider, chain, or external-claim changes, read all six documents.

If the documents conflict, do not guess. Follow the newest explicit approved decision only when the affected canonical documents have been updated consistently. Surface unresolved conflicts to Malcolm.

## 3. Authority and roles

| Role | Participant | Authority |
| --- | --- | --- |
| Customer | Malcolm | Defines the intended company or project outcome and conditions of satisfaction |
| Final decider | Malcolm | Decides company strategy, material scope, funding, external commitments, product direction, high-risk exceptions, and final submission |
| Performer | Asa or Codex, as assigned | Researches, designs, implements, tests, documents, and fixes within the authorized task |
| Recommender | Asa, Codex, Malcolm, or a named specialist | Analyzes options and recommends a choice |
| Verifier | Automated checks and an independent reviewer where the stakes require it | Tests the promised properties and reports evidence |

Agents may make routine, reversible implementation choices that fit the approved architecture and security baseline. Record a material choice in `docs/DECISIONS.md`.

Do not silently decide or change:

- company strategy or customer positioning;
- production use of money, customer data, or provider authority;
- a core authorization or security invariant;
- the cryptographic profile or public evidence claim;
- an external submission, partnership, purchase, publication, or legal commitment;
- a decision explicitly reserved for Malcolm.

For material decisions, use RAID:

- **Recommend:** own the analysis and proposed choice.
- **Align:** identify people whose agreement is required for execution.
- **Input:** gather current documents, tests, customer evidence, and qualified expertise.
- **Decide:** Malcolm decides unless formal governance later assigns the decision elsewhere.

An AI recommendation is not an approved decision.

## 4. Graph Engineering behavior

Treat meaningful work as a graph of bounded nodes and validated handoffs.

### Node contract

Before executing a material node, be able to state:

- **Purpose:** why the node exists.
- **Customer:** who needs the result.
- **Performer:** who owns producing it.
- **Inputs:** files, facts, state, credentials, and approvals it may use.
- **Output:** the concrete artifact or behavior it must produce.
- **Authority:** what it may read, decide, change, call, or send.
- **Constraints:** what it must preserve or avoid.
- **Conditions of satisfaction:** observable facts required for acceptance.
- **Failure states:** how failure or uncertainty will be represented.
- **Verification:** which checks will test the output.
- **Escalation:** when control returns to Malcolm or a specialist.
- **Resume state:** what must persist so interrupted work can continue safely.

Keep the contract proportional to the task. It may be one short paragraph for routine work. If these fields cannot be explained simply, split or clarify the node before proceeding.

### Edge contract

At a handoff between nodes:

1. Identify the output being transferred.
2. State its schema, version, or expected form.
3. Attach the evidence for the asserted state.
4. Validate the properties the receiving node depends on.
5. Reject or preserve an explicit failure state when validation fails.

Do not trust a prior node merely because it returned success.

### Critical path

Prefer the next dependency that advances the end-to-end proof. Current V0 order is:

1. repository and implementation decisions;
2. domain and persistence;
3. identity, mandate, policy, and fixtures;
4. approval binding;
5. Stripe execution and idempotency;
6. webhooks and reconciliation;
7. signed receipt and verifier;
8. Base Sepolia commitment;
9. minimal console;
10. integrated acceptance;
11. demo and application package.

Parallelize only independent work with explicit ownership, output contracts, and a final integration check. Parallel activity does not replace coherent end-to-end verification.

## 5. Workflow promise lifecycle

Use this four-phase loop for meaningful work:

1. **Listen:** identify the customer, intended change, stakes, and practical outcome.
2. **Negotiate:** form a clear promise with scope, performer, authority, constraints, sequence, and conditions of satisfaction.
3. **Execute:** perform within that contract and preserve meaningful state and evidence.
4. **Assess:** compare the result with the conditions; accept it, reject it with evidence, or form a new promise for the remaining gap.

Do not silently narrow, expand, or reinterpret the promise to make incomplete work look complete. When evidence changes the task materially, state the impact and update the plan or decision record.

## 6. Verification-loop behavior

For each meaningful component or transition:

1. Build the smallest complete behavior.
2. Run the check that directly measures its contract.
3. Inspect the actual result in its delivery form.
4. Challenge assumptions, failure paths, boundaries, and claims.
5. Correct material defects.
6. Rerun every affected check.
7. Integrate with the next node and validate the handoff.
8. Run the relevant end-to-end path.
9. Report the evidence and remaining limits.

Match evidence to the work:

- code behavior → focused automated tests and observed runtime result;
- authorization → negative identity, role, tenant, mandate, and state tests;
- concurrency → simultaneous or repeated execution tests;
- provider behavior → test-mode provider objects and authenticated observations;
- cryptography → fixed canonicalization, digest, signature, tamper, and wrong-key vectors;
- smart contracts → unit, negative, deployment, issuer, event, and chain-configuration checks;
- interfaces → rendered inspection, interaction tests, and failure-state review;
- factual claims → current primary sources;
- external action → observed target-system outcome and saved confirmation.

Compilation, a tool success response, transaction submission, screenshot, or confident explanation may be evidence for one layer. None is universal proof of completion.

## 7. Definition of done

A task is complete only when:

- the promised output exists in the agreed location;
- every material requested constraint is satisfied;
- required checks ran and passed, or named exceptions are explicit;
- failures found during review were corrected and affected checks reran;
- status is accurately labeled;
- relevant setup, decisions, and limitations are documented;
- Malcolm can assess the result without reconstructing raw work.

Use precise states:

- `PROPOSED`: possible approach, not approved.
- `PLANNED`: authorized outcome, not implemented.
- `IN_PROGRESS`: active work, conditions not yet satisfied.
- `NEEDS_ATTENTION`: concrete dependency, failure, or reserved decision needs resolution.
- `IMPLEMENTED`: artifact exists, acceptance still pending.
- `ATTEMPTED`: external execution began, outcome may be unknown.
- `EXECUTED`: target system reports that the action occurred.
- `VERIFIED`: named checks passed within the stated scope.
- `ACCEPTED`: Malcolm accepted the promised outcome.
- `DEFERRED`: deliberately outside current scope.
- `SUPERSEDED`: a later approved artifact or decision replaced it.

## 8. V0 scope rules

### Build

- One organization, agent, approver role, mandate, policy, provider, action type, and chain environment.
- One Stripe test-mode refund workflow.
- Deterministic `ALLOW`, `REQUIRE_APPROVAL`, and `DENY` behavior.
- Approval bound to the exact material action and authority versions.
- Durable idempotency, authenticated webhooks, and reconciliation.
- RFC 8785 canonicalization, SHA-256 digest, Ed25519 signature, and a 256-bit receipt `commitmentNonce`.
- Private receipt evidence with a minimal Base Sepolia digest commitment.
- Independent receipt and anchor verification.
- A minimal console that shows states and limitations accurately.
- The seven scenarios defined in `docs/V0_EXECUTION_PLAN.md`.

### Do not build in V0

- Production funds or live provider authority.
- Zero-knowledge proofs.
- Multiple providers, action types, organizations, or chains.
- BNB Chain, batch commitments, Merkle roots, tokens, governance, or validators.
- LLM authorization, approval, direct provider access, or evidence signing.
- Insurance products, actuarial scores, claims, or underwriting.
- Full enterprise tenancy, customer-cloud deployment, or multi-region infrastructure.
- Features added only to appear technically sophisticated.

If timing tightens, reduce optional AI input and visual polish before changing the P0 authority-to-evidence path.

## 9. Security invariants

Never weaken these rules for speed or demo convenience:

1. Missing, ambiguous, expired, revoked, or inconsistent authority means no provider execution.
2. Organization, agent, and role context comes from authenticated server-side state.
3. An action version is immutable; a material change invalidates prior approval.
4. A requester cannot approve itself through the request channel.
5. A hard denial cannot be overridden through general approval.
6. Persist the logical operation and stable provider idempotency key before the provider call.
7. Preserve ambiguous outcomes as `UNKNOWN`; reuse the same operation key during reconciliation.
8. If durable state is unavailable, do not make a new provider call.
9. Secrets never enter source, browser code, URLs, logs, ordinary database fields, receipts, prompts, analytics, screenshots, or chain data.
10. Keep provider, webhook, agent, session, receipt-signing, and Base transaction secrets separate by environment and purpose.
11. Enforce tenant access in the server and database; never trust a caller-supplied organization identifier.
12. Receipt signing and anchoring occur after durable outcome recording; their failure does not change the provider outcome.
13. A Base failure affects only anchor state.
14. Public chain data contains no private receipt or customer content.
15. V0 uses standard cryptography and no zero-knowledge proof system.

When a proposed implementation conflicts with an invariant, stop that path, identify the conflict, and recommend an explicit resolution.

## 10. Evidence and claim discipline

Keep these claims distinct:

- **Authorization:** the actor was permitted under the recorded rules.
- **Integrity:** disclosed content has not changed since signing.
- **Authenticity:** a specified recognized key signed the content.
- **Provider observation:** Stripe reported a stated result at a stated time.
- **Public commitment:** a specified issuer committed the digest to a specified contract and chain.
- **Completeness:** all relevant actions within a claimed boundary were captured.

A valid signed and anchored receipt does not prove completeness, legal authority, good judgment, safe agent behavior, an uncompromised issuer, or truth outside the evidence sources.

Use only the narrow V0 coverage claim:

> Blackbox records and controls refund requests sent through the configured gateway using the registered Stripe test-mode connection.

Do not invent or imply customers, partnerships, investment, revenue, regulatory approval, insurance coverage, production readiness, completed tests, or submission status.

## 11. Data, secrets, and environments

- Use Stripe test mode, Base Sepolia, and synthetic or deliberately non-sensitive fixtures only.
- Never mix development, test, pilot, or production credentials or issuer identities.
- Store secrets only in approved server-side secret facilities.
- Commit `.env.example` with names and safe placeholders only; ignore real environment files.
- Redact direct identifiers and provider payloads unless a test requires a safe fixture.
- Minimize receipt fields before relying on encryption.
- Do not copy secrets into commands, issues, chat, screenshots, recordings, test output, or documentation.
- Rotate a credential immediately when exposure is suspected and record the impact without recording its value.
- Do not put customer, payment, policy, mandate, approval, or receipt content onchain.

## 12. Code and architecture behavior

- Keep domain rules pure and deterministic where the architecture requires it.
- Keep provider-specific logic in adapters.
- Keep chain-specific logic in the anchor adapter and verifier configuration.
- Use strict schemas at trust boundaries and reject malformed authority-bearing input.
- Use integer minor units for money; V0 uses USD cents.
- Use immutable versions and append-oriented evidence where specified.
- Use database constraints and transactions for correctness under concurrency.
- Use an outbox or equivalent durable handoff for provider, reconciliation, receipt, and anchor jobs.
- Do not implement cryptographic primitives or JSON canonicalization by hand.
- Do not make abstractions for unvalidated future providers or chains. Preserve clean boundaries and build the one required implementation.
- Keep errors specific enough for operation and safe enough for external exposure.
- Keep the system runnable after every integrated milestone.

Follow repository formatting, type-checking, linting, test, migration, contract, and build commands once they exist. If commands change, update the repository setup documentation in the same change.

## 13. Test minimums

Every affected change must run the smallest relevant checks. Before V0 acceptance, the combined suite must cover:

- policy branches and threshold boundaries;
- inactive, expired, revoked, replaced, and mismatched mandates;
- unauthenticated, unauthorized, revoked-agent, wrong-role, and wrong-organization access;
- approval authorization, binding, expiry, rejection, replay, and mutation;
- concurrent workers, repeated jobs, stable idempotency, provider rejection, and lost response;
- webhook signature failure, duplication, delay, and reordering;
- canonicalization, digest, signature, wrong key, missing proof, and per-field tampering;
- wrong chain, contract, issuer, digest, block, and confirmation state;
- contract issuer separation, duplicates, invalid inputs, and approved public event fields;
- all seven end-to-end scenarios from a clean test deployment.

Do not add tests that merely duplicate implementation structure without checking meaningful behavior. When a failure exposes a missing invariant, add the smallest durable regression check that proves the repair.

## 14. Failure and retry behavior

- Preserve the request, inputs, state, and observed error needed for diagnosis.
- Distinguish safe computation retry from a retry that may repeat a side effect.
- Never create a new logical provider operation to resolve an uncertain prior call.
- Stop automatic retries when authority is unclear, the outcome is uncertain, retry cost is rising, or human judgment is required.
- Resume from durable verified state, not memory or assumed success.
- Keep provider, receipt, and anchor failure states separate.
- A correction is complete only after the affected checks pass again.

“Self-healing” means detecting a defined failure, applying an authorized correction, and verifying the result. It does not grant permission to improvise indefinitely.

## 15. Documentation and decision updates

Update the canonical source in the same change when implementation alters:

- an actor, authority boundary, invariant, component, state, API, data class, receipt field, evidence claim, provider, chain, or acceptance condition;
- a recorded decision or its revisit condition;
- V0 milestone order, scope, or definition of complete;
- setup, command, migration, seed, deployment, or demo behavior.

Use `docs/DECISIONS.md` for material decisions, not ordinary task history. Preserve superseded decisions and link replacements. Keep unresolved choices in the open-decision register until Malcolm decides them.

Do not copy large sections between files. Link to the canonical explanation and keep this instruction file operational.

## 16. Delivery report

For meaningful completed work, report:

- **Built:** the concrete behavior or artifact.
- **Verified:** checks run and observable evidence.
- **Location:** relevant files, commit, environment, or external test references.
- **Decisions:** new or changed material choices.
- **Remaining:** real limitations, failed checks, or unresolved risks that affect acceptance.

Keep the report concise. Do not make Malcolm reconstruct the result from raw commands, logs, agent messages, or intermediate drafts.

## 17. V0 completion boundary

Do not call V0 complete until:

- all seven scenarios pass from a clean test deployment;
- the $750 human-approval scenario creates one Stripe test refund;
- its signed receipt verifies under the recognized Ed25519 public key;
- its digest is confirmed through the configured Base Sepolia contract;
- the verifier rejects the altered receipt;
- the console reports each state accurately;
- V0 security acceptance passes;
- the demonstration record names the exact source revision and test references without secrets;
- limitations are visible; and
- Malcolm explicitly accepts the result.

Application preparation and submission are separate outcomes. Malcolm retains final authority over any external submission.

---

**Operating anchor:** Work in bounded nodes, validate every important handoff, preserve honest state, correct failures through a verification loop, and never claim more authority, execution, evidence, or completion than the observable result supports.

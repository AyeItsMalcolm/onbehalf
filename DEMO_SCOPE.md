# Onbehalf — Demo Scope (YZi EASY Residency S5 submission)

| Field | Value |
| --- | --- |
| Owner and final decider | Malcolm Henzaga |
| Created | 2026-09-18 |
| Status | Active. **For this weekend, this file overrides `V0_EXECUTION_PLAN.md` and any milestone order in `AGENTS.md`.** |
| Deadline | Application submitted Sunday 2026-09-21 before 23:59 GMT-7. Demo must be recorded by Saturday night. |
| Company name in all UI and copy | **Onbehalf** (folder and docs still say Project Blackbox; do not rename files) |
| Tagline | Agents act on behalf. We prove who. |

## 1. What this weekend is

We are building a **demo for an application**, not the product. The product gets built during the residency (5 weeks remote + 5 weeks in Thailand). Everything in `PRODUCT_ARCHITECTURE.md`, `SECURITY_PRINCIPLES.md`, and `V0_EXECUTION_PLAN.md` remains the design of record for that build. This weekend we build only what the video needs, and we label honestly what is real and what is a prototype.

The demo has exactly two parts:

**Part A — The proof (real, working code).**
A receipt is assembled from a fixture, canonicalized, hashed, signed, its digest anchored on a public testnet, and independently verified. Then one field is altered and the verifier reports INVALID and names the failed check. This is the claim no competitor makes and it must be real.

**Part B — The flow (clickable prototype, no backend).**
Three static screens that show what a customer sees: approval queue → action detail → receipt/verifier. Buttons navigate between pages. Data is hard-coded to match the Part A fixture. No login, no database, no Stripe calls.

Plus one required document: **`EXPLAINER.md`** (see §7).

## 2. Build this

> **Superseded in part (2026-09-18):** live anchoring is out of the demo per `DECISIONS.md` PBX-021. The anchor script and verifier anchor check are implemented but not run; the package ships `anchorProof.state: NOT_SUBMITTED`.

### Part A — proof CLI (`packages/receipt/` or `proof/`)

- **Fixture receipt core** at `fixtures/receipt.s2.json` following `PRODUCT_ARCHITECTURE.md` §14.1, with `issuer.issuerId = "onbehalf-demo"`, `scope.environment = "test"`, and the S2 story: `stripe.refund`, `amountMinor: 75000`, `currency: "usd"`, `policy.decision: "REQUIRE_APPROVAL"`, `approval.decision: "APPROVED"`, `execution.observedState: "SUCCEEDED"`, `evidence.level: "PROVIDER_OBSERVED"`. Include the `limitations` array verbatim from §14.1. Include a 256-bit random `commitmentNonce` (PBX-011).
- **Canonicalize** with the `canonicalize` npm package (RFC 8785). Never hand-roll it.
- **Digest**: SHA-256 of canonical UTF-8 bytes, `0x`-prefixed lowercase hex.
- **Sign**: Ed25519 over the canonical bytes using Node's built-in `crypto` (`generateKeyPairSync('ed25519')`). Private key lives only in `.env` (`RECEIPT_SIGNING_KEY`, PKCS8 base64). Public key, key ID, and SHA-256 fingerprint go in the package per §14.2.
- **Package**: write `out/receipt.s2.package.json` with `receiptCore`, `cryptographicProof`, and `anchorProof` (anchor proof OUTSIDE the signed core, per PBX-015).
- **Contract**: `contracts/EvidenceAnchor.sol`, minimal, per `PRODUCT_ARCHITECTURE.md` §12.10: `commit(bytes32 digest, bytes32 schemaId)`, `committedAtBlock(address issuer, bytes32 digest)`, event `EvidenceCommitted(address indexed issuer, bytes32 indexed digest, bytes32 indexed schemaId)`, revert on duplicate for the same issuer, no funds, no owner, no upgrade path, pinned `pragma solidity 0.8.x`. Foundry tests: commit, lookup, duplicate revert, different issuers distinct.
- **Anchor**: `viem` script that deploys (once) and calls `commit`. Chain from env: `CHAIN_ID` (default `97` = BNB Smart Chain testnet), `RPC_URL`, `ANCHOR_PRIVATE_KEY`. Record tx hash, block number, block hash, confirmations into `anchorProof`. Save deployment details (chain, address, deployer, tx) to `out/deployment.json`. **Never print any private key.**
- **Verifier**: `pnpm verify <package.json>` prints one line per check, each PASS / FAIL / SKIPPED with a reason: schema → canonical digest matches → signature valid under included public key → public key fingerprint matches configured issuer → anchor (chain id, contract, issuer address, digest found, block, confirmations). Overall result VALID, VALID_UNANCHORED, INVALID, or INCOMPLETE. Never a single unexplained "verified" badge.
- **Tamper demo**: `pnpm tamper` copies the package, changes `receiptCore.action.amountMinor` from `75000` to `95000`, writes `out/receipt.s2.tampered.json`. Running `pnpm verify` on it must show digest FAIL and signature FAIL, overall INVALID.
- **Tests**: canonicalization vector stable across runs; wrong key fails; every material field changed in turn fails; missing proof material returns INCOMPLETE.

### Part B — prototype screens (`demo/` static HTML)

Plain HTML + CSS (Tailwind via CDN is fine), served with `pnpm demo` (any static server). Follow `docs/DESIGN_NOTES.md` exactly. Three pages, hard-coded to the S2 fixture:

1. `index.html` — **Approvals queue.** One pending row: "Refund $750.00 USD · Requested by refund-agent v1 · Awaiting approval · expires in 14:32". Top nav shows Onbehalf wordmark and a persistent badge "Sandbox · Stripe test · BNB testnet".
2. `action.html` — **Action detail + approve.** Sections: Request (action type, target `pi_…`, amount, currency, reason), Authority (mandate ref, version 3, autonomous limit $500, active), Policy (REQUIRE_APPROVAL, reason code `HUMAN_APPROVAL_REQUIRED`, evaluated at), Approval binding (digest `sha256:…` shown in mono, expiry), Execution (NOT_STARTED), Evidence (NOT_ISSUED). Buttons: **Approve exact action** and **Reject**. Approve navigates to `receipt.html`. Reject navigates back with a "Rejected by approver · no provider call" state.
3. `receipt.html` — **Receipt + verifier.** Shows the same five rows as the hero mockup (Mandate / Policy / Approval / Execution / Evidence) filled from `out/receipt.s2.package.json` values (copy them in at build time), a "Download receipt package" link, a BscScan link to the anchor tx, and a verifier panel listing each check with PASS. A toggle "Show tampered copy" swaps in the tampered results with the two FAILs highlighted.

Every page footer: "Prototype screens. Receipt, anchor, and verifier are live — see repo."

### Part C — `EXPLAINER.md` (see §7)

## 3. Do NOT build this weekend

Stripe API integration, database of any kind, authentication, webhooks, idempotency/reconciliation, policy engine code, Next.js app, deployment to Vercel, multiple scenarios, multiple chains, tokens, ZK, anything from the "Do not build in V0" list in `AGENTS.md` §8. If a task seems to need one of these, stop and ask Malcolm.

## 4. Decisions in force for this weekend (record in `DECISIONS.md` as PBX-021)

- Chain for the demo: **BNB Smart Chain testnet, chain ID 97** (supersedes PBX-014 for the demo only; portable per PBX-017). Fallback if no tBNB by Saturday noon: whichever testnet Malcolm already has funds on; chain is env-only.
- No provider call in the demo; `evidence.level` in the fixture is labeled honestly as fixture data, and `EXPLAINER.md` says so.
- Prototype screens are static; labeled on every page.

## 5. Chain setup and faucet fallbacks

> **Superseded (2026-09-18):** no chain setup, faucet, or chain key for the demo per `DECISIONS.md` PBX-021. Kept for the residency build.

BNB testnet public RPC endpoints are listed in BNB Chain's official docs; use one from there (do not hardcode a third-party RPC without noting it). tBNB: try the official BNB testnet faucet first; if it requires mainnet balance, try QuickNode's or Chainlink's multi-chain faucets with the wallet address. Anchoring is the LAST step of Part A so nothing else blocks on it. If anchoring is not possible by Saturday evening, the package must still verify as `VALID_UNANCHORED`, and the demo says "anchor pending" honestly.

## 6. Acceptance for the demo (all must be true)

- [ ] `pnpm test` passes (receipt vectors, tamper cases, contract tests).
- [ ] `pnpm verify out/receipt.s2.package.json` → VALID (or VALID_UNANCHORED with a stated reason).
- [ ] `pnpm verify out/receipt.s2.tampered.json` → INVALID, digest and signature FAIL named.
- [ ] Anchor tx visible on BscScan testnet with the digest in the event log.
- [ ] `pnpm demo` serves the three screens; Approve navigates to the receipt; tampered toggle works.
- [ ] `git grep` for `sk_`, `PRIVATE`, and the actual key values returns nothing tracked; `.env` is gitignored; `.env.example` has names only.
- [ ] `EXPLAINER.md` exists and Malcolm can read it in under 10 minutes.
- [ ] `DEMO_MANIFEST.md` records commit hash, chain ID, contract address, tx hash, receipt digest — no secrets.

## 7. `EXPLAINER.md` — required, written for Malcolm

Malcolm learns by doing and by plain examples. He will narrate this demo on camera and answer questions from investors. Write `EXPLAINER.md` so he can rehearse from it:

- Short sections, one idea each, bold key line first.
- For each piece (receipt core, canonicalization, digest, signature, nonce, anchor contract, verifier, tamper check, the prototype screens) answer the five questions from `BUILD_PHILOSOPHY.md` §16: what is it in plain English, why it matters here, what happens in the concrete $750 scenario, how it works technically (two sentences max), and how to say it to an investor in one sentence.
- Include a "Questions a judge will ask" list with one-breath answers: why a chain and not a database; what goes on-chain (only the fingerprint); do customers need a wallet (no); what the receipt does NOT prove (completeness, legal authority, safe behavior); why BNB Chain.
- Include a "Demo run order" card: the exact commands in the exact order for the recording, with what to say at each step.

## 8. How to work with Malcolm during the build

- Work in the order: fixture → canonicalize/digest/sign → verifier → tamper → tests → contract + tests → anchor → screens → explainer → manifest. Report after each step using the Built / Verified / Location / Remaining format from `AGENTS.md` §16, in under 10 lines.
- One decision at a time. If something is ambiguous, ask one question and propose a default.
- Never expand scope to "make it more real." Real is Part A; the rest is a labeled prototype.
- Never print, log, or echo secrets. Never commit `.env`.
- When Malcolm asks "what does this do," answer in plain English first, then the technical term.

# Onbehalf demo — Explainer (rehearsal copy for Malcolm)

**Agents act on behalf. We prove who.**

This is the document to rehearse from. Short sections, one idea each, bold line first.

**Status:** complete. Part A (the proof), Part B (the screens), the video, and the judge questions.

**Numbers to say out loud:** 38 tests, 48 fields, every one caught. 11 contract tests. One $750.00 refund.

---

## The story in four sentences

**A software agent asks to refund $750.00. Policy says a human must approve. J. Tan approves exactly that action. Onbehalf signs a receipt that anyone can check, and if anyone changes one number afterwards, the check fails and says which part broke.**

That is the whole demo. Everything below is one piece of it.

---

## What is real and what is a prototype

**Real:** the receipt, the canonical bytes, the hash, the signature, the verifier, the tamper detection, the 38 tests, the contract and its 11 tests. All of that runs from the repository with `pnpm test`, `pnpm verify`, and `pnpm tamper`.

**Prototype:** the three screens. They are static pages hard-coded to the same receipt. Two things inside them are real code running in the browser: the approval-binding hash (SHA-256) and the receipt signature check (Ed25519).

**Not in this demo:** a Stripe call, a database, a login, a chain transaction. The receipt's execution and evidence sections describe the story; no refund was sent. No chain transaction was submitted and no chain private key was created (decision PBX-021). Say this on camera before anyone asks.

---

## Piece 1: the receipt

**Plain English:** one page of facts about one action. Who asked, under what permission, what the rule said, who approved, what the provider reported, and what this receipt does not claim.

**Why it matters:** an agent acting with money needs a record that is not the agent's own word. This is that record.

**In the $750 scenario:** the receipt says refund-agent v1 asked for $750.00 on payment `pi_3Q…8d`, mandate v3 allows refunds up to $1,000.00 with human approval above $500.00, policy v1 said REQUIRE_APPROVAL, J. Tan approved at 21:02, the provider reported success at 21:04, evidence level PROVIDER_OBSERVED.

**Technically:** a JSON object with 48 fields in nine sections (issuer, scope, subject, authority, action, policy, approval, execution, evidence) plus a random nonce. Every `sha256:` value inside it is the hash of a real source file in `fixtures/s2/`.

**To an investor:** "It's a one-page audit record for one agent action, and every fingerprint on it points to a document we can open."

---

## Piece 2: canonicalization

**Plain English:** the same facts can be written a hundred ways: different spacing, different key order. Canonicalization picks one exact spelling so every computer produces identical bytes.

**Why it matters:** a hash of the bytes only means something if everyone hashes the same bytes. Without this, two honest verifiers could disagree.

**In the $750 scenario:** the receipt becomes one line of 1,974 bytes, keys sorted, no spaces. That line is saved as `out/receipt.s2.canonical.json` and is the thing that gets hashed and signed.

**Technically:** RFC 8785, the JSON Canonicalization Scheme, via the `canonicalize` library by the RFC's author. We do not write our own; a test checks the RFC's own worked example.

**To an investor:** "We use the internet standard for turning JSON into one exact byte string, so any verifier anywhere gets the same fingerprint."

---

## Piece 3: the digest

**Plain English:** a fingerprint. Thirty-two bytes that change completely if any single character of the receipt changes.

**Why it matters:** the fingerprint is the only thing that would ever leave our system for a public record. It reveals nothing about the receipt, but proves the receipt has not changed.

**In the $750 scenario:** the digest is `0xfe87e8ca…2ed1`. Change the amount to $950.00 and it becomes `0xc7e08f30…39f2`.

**Technically:** SHA-256 over the canonical UTF-8 bytes, written as `0x` plus 64 lowercase hex characters, which is the same shape as a `bytes32` on an EVM chain.

**To an investor:** "The fingerprint is 32 bytes; you can publish it anywhere without revealing the receipt."

---

## Piece 4: the signature

**Plain English:** Onbehalf's stamp. Only our private key can produce it; anyone with our public key can check it.

**Why it matters:** the digest proves the receipt didn't change. The signature proves who issued it.

**In the $750 scenario:** the issuer `onbehalf-demo` signs the canonical bytes with key `key_2a4a68fc9d874bfb`. The package carries the signature, the public key, and the key's fingerprint. The private key lives only in `.env` and is never printed or committed.

**Technically:** Ed25519 over the canonical bytes using Node's built-in crypto. Deterministic, so signing the same bytes twice gives the same signature.

**To an investor:** "Every receipt is signed with a key we publish the public half of; if the signature checks, we issued it."

---

## Piece 5: the nonce

**Plain English:** a random 256-bit number inside every receipt. A secret salt.

**Why it matters:** many receipt fields have only a few likely values. Without the nonce, someone who saw a public fingerprint could guess receipts until one matched. With it, guessing is hopeless.

**In the $750 scenario:** `commitmentNonce` is generated once and stored in the fixture, so re-signing never changes the bytes by accident.

**Technically:** 32 bytes from a cryptographically secure generator, base64url, inside the signed core (decision PBX-011). Disclosed only with the private package, never on its own.

**To an investor:** "Even if the fingerprint is public, nobody can reverse-engineer the receipt from it."

---

## Piece 6: the anchor contract

**Plain English:** a public notice board. An issuer pins a fingerprint once, and everyone can see which block it went up in. It cannot be edited, taken down, or hold money.

**Why it matters:** a database can be quietly rewritten. A public commitment cannot. It lets a third party check that the receipt existed at a point in time without trusting us.

**In the $750 scenario:** the contract is written and tested (11 Foundry tests: commit, lookup, duplicate rejected, issuers kept separate, zero inputs rejected, ether rejected, fuzz). It is not deployed and no transaction is sent this weekend. The package says `anchorProof.state: NOT_SUBMITTED`, reason "not submitted in demo".

**Why no chain transaction in the demo (say this plainly):** holding a funded chain key for an application demo adds custody risk with no proof value; faucet and testnet timing were a schedule risk for the recording; and an honest "not submitted" state shows the verifier keeps receipt integrity and anchor state separate, which a green line would hide. Deployment and the chain used are a configuration step, not a design change.

**Technically:** `commit(bytes32 digest, bytes32 schemaId)` stores the block number under (issuer, digest) and emits an event; `committedAtBlock(issuer, digest)` reads it. 45 lines, Solidity 0.8.28, no owner, no upgrade path.

**To an investor:** "The on-chain part is a 45-line notice board we chose not to deploy for a demo rather than hold a key we don't need."

---

## Piece 7: the verifier

**Plain English:** a separate program that takes a receipt package and asks five questions, one at a time, and never answers with a single green badge.

**Why it matters:** the value is that someone who does not trust us can run it.

**In the $750 scenario:** `pnpm verify out/receipt.s2.package.json` prints:

```
Schema     PASS     onbehalf.action-receipt@0.1.0, profile RFC8785-JCS / SHA-256 / Ed25519
Digest     PASS     0xfe87e8ca…2ed1 recomputed from 1974 canonical bytes
Signature  PASS     Ed25519 over canonical bytes verifies under the packaged public key
Issuer     PASS     fingerprint sha256:2a4a68fc…7ae9 matches configured issuer onbehalf-demo (key_2a4a68fc9d874bfb)
Anchor     SKIPPED  NOT_SUBMITTED: not submitted in demo

Result     VALID_UNANCHORED  receipt integrity and issuer verified; anchor NOT_SUBMITTED: not submitted in demo
```

**Technically:** the check logic has no Node dependencies; the CLI feeds it Node crypto and the browser feeds it WebCrypto, and a test proves both produce identical reports. Results are VALID, VALID_UNANCHORED, INVALID, or INCOMPLETE. The verifier trusts its own config file (issuer ID, key fingerprint), never the package.

**To an investor:** "Anyone can run this without trusting us, and it tells you which check failed instead of a badge."

---

## Piece 8: the tamper check

**Plain English:** change one number in a signed receipt and try to pass it off. The verifier catches it and names what broke.

**Why it matters:** this is the claim: a receipt cannot be quietly edited after the fact.

**In the $750 scenario:** `pnpm tamper` copies the package and changes the amount from 75000 to 95000 cents ($750.00 → $950.00), leaving the digest, signature, and key untouched. `pnpm verify out/receipt.s2.tampered.json` prints Digest FAIL, Signature FAIL, `Result INVALID failed: Digest, Signature`.

**Technically:** the test suite mutates each of the 48 signed fields in turn and asserts both checks fail every time; it also tries a signature from a wrong key (Signature FAIL) and an impostor who re-signs with their own key (Signature PASS but Issuer FAIL).

**To an investor:** "We changed one number, $750 to $950, and the verifier named exactly which two checks broke. 38 tests, 48 fields, every one caught."

---

## Questions a judge will ask (one-breath answers)

**Why a chain and not a database?** A database we run can be rewritten by us. A public commitment can't, so a third party can check the receipt existed without trusting us.

**What goes on chain?** Only the 32-byte fingerprint and a schema ID. No amount, no customer, no receipt.

**Do customers need a wallet?** No. Onbehalf holds the anchor key on the server side; customers see a link and a verifier.

**But you didn't anchor in the demo?** Correct, on purpose. The contract is written and tested; sending a transaction needs a funded key and that's a configuration step, not something to fake for a video. The verifier says "not submitted" honestly.

**What does the receipt NOT prove?** Completeness (actions taken outside our gateway), legal authority, or that the agent behaved sensibly. It proves this record hasn't changed and that we issued it.

**Why BNB Chain?** The anchor is chain-agnostic and configured by environment; BNB Smart Chain testnet is the configured default for this program. Swapping the chain is configuration, not a rewrite.

**Is this using an LLM to decide anything?** No. Policy is deterministic; approval is a human; signing is a key. No model touches authorization or evidence.

**Was there a real Stripe refund?** Not this weekend. The execution and evidence sections are story data and the receipt says the evidence level is PROVIDER_OBSERVED. The cryptography around it is real.

---

## Piece 9: the prototype screens

**Plain English:** three pages a customer would see: the approvals queue, the action an approver decides on, and the receipt with its verifier. They are static pages hard-coded to the same $750 receipt, labeled as a prototype in every footer.

**Why it matters:** investors need to see the product, not a terminal. The screens show where the human sits in the loop and what "proof" looks like on a normal screen.

**In the $750 scenario:** the queue shows one refund awaiting approval (and a $300 refund that went through on its own). The detail page shows what the agent asked, what the mandate allows, what policy decided, and the binding fingerprint. Approve plays the sequence: approved, executing, provider confirmed, receipt signed, anchor pending. The receipt page shows the document on the left and the verifier on the right.

**What is real inside them (say this if asked):** two things run real code in the browser. The binding fingerprint on the detail page is a real SHA-256 over the exact facts: edit the amount and it recomputes. The verifier on the receipt page runs the same checks as the command line, with the browser's own Ed25519 and SHA-256, on the real signed package and on the real tampered copy. Everything else on the screens is the story: no Stripe call, no database, no login.

**Technically:** plain HTML and CSS, no framework. The verifier core is bundled once for the browser from the same source as the CLI; a test proves the two produce identical reports. Motion is transform and opacity only, respects reduced-motion, and every state uses the amber / green / red vocabulary from the design notes.

**To an investor:** "The screens are a prototype, and I'll say so. But the fingerprint you watched change and the two red lines at the end were computed by your browser, not drawn."

---

## The video

**`pnpm capture:demo` renders the silent demo video** from `docs/NARRATION.md`: an opening card, nine beats across the three pages with a caption bar and a visible cursor, a closing card. Holds are derived from the spoken lines (words ÷ 2.3 + 1.5 s) so the pacing reads calm. Output: `demo/captures/onbehalf-demo.mp4` (1920×1080, H.264) and `onbehalf-demo-timestamps.txt`. Runtime about 2:32. The recorder captures at 25 fps.

**Beats, in order:** card → queue → pending row → Review → amount to $950 (invalidated) → restore $750 → Approve (sequence to "Anchor pending") → View receipt (four PASS, Anchor pending) → Show tampered copy (two FAIL) → scroll to the command-line card → closing card.

---

## Live demo (only if a judge asks to see it run)

Before: `pnpm test` (38 passed, 11 passed), `pnpm build:demo`, `pnpm demo`, browser at http://localhost:4173/ at 1920×1080.

**1. Terminal: `pnpm sign`**
Say: "This takes the receipt, turns it into one exact byte string, hashes it, and signs it. That fingerprint is the only thing that ever leaves our system."

**2. Terminal: `pnpm verify out/receipt.s2.package.json`**
Say: "Five separate checks. Schema, digest, signature, issuer, anchor. Not one badge. The anchor is honestly marked not submitted."

**3. Terminal: `pnpm tamper` then `pnpm verify out/receipt.s2.tampered.json`**
Say: "One number changed, $750 to $950. Two checks fail and they say which. 38 tests, 48 fields, every one caught."

**4. Browser:** Approvals → Review → edit the amount to 950 → restore 750.00 → Approve exact action → View receipt → Show tampered copy. Same lines as the video captions.

---

## Glossary, one line each

- **Mandate:** the permission an agent has been given (what, how much, until when).
- **Policy:** the deterministic rule that decides ALLOW, REQUIRE_APPROVAL, or DENY.
- **Binding digest:** the hash of the exact facts an approval covers.
- **Canonical bytes:** the one exact spelling of the receipt (RFC 8785).
- **Digest:** SHA-256 fingerprint of the canonical bytes.
- **Signature:** Ed25519 stamp over the canonical bytes.
- **Nonce:** random salt inside the receipt so the digest can't be guessed.
- **Anchor:** a public commitment of the digest on a chain; separate from the signature.
- **Evidence level:** how strong the provider evidence is (here PROVIDER_OBSERVED: a direct response, no reconciled webhook).

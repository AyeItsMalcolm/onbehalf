# Onbehalf

**Agents act on behalf. We prove who.**

This repository is the demo built for the YZi Labs EASY Residency application: a signed, independently verifiable receipt for one agent action, plus a three-screen prototype of the console that produces it. It is a demo, not the product.

## The story in four sentences

A software agent asks to refund $750.00. Policy says a human must approve. J. Tan approves exactly that action. Onbehalf signs a receipt anyone can check, and if anyone changes one number afterwards, the check fails and says which part broke.

## What is real

- `fixtures/receipt.s2.json`: the receipt core, 48 signed fields. Every `sha256:` value in it is the hash of a source file in `fixtures/s2/`.
- `proof/`: canonicalization (RFC 8785 via the `canonicalize` package), SHA-256 digest, Ed25519 signature, and a verifier that reports five checks separately: Schema, Digest, Signature, Issuer, Anchor.
- `out/receipt.s2.package.json`: the signed package. `out/receipt.s2.tampered.json`: the same package with the amount changed after signing.
- `contracts/`: `EvidenceAnchor.sol`, a 45-line public commitment contract with 11 Foundry tests. Written and tested, **not deployed** in this demo.
- 38 vitest tests, including every one of the 48 signed fields mutated in turn.

## What is a prototype

- `demo/`: three static pages (approvals queue, action detail, receipt and verifier), hard-coded to the same receipt. Two things inside them are real code running in the browser: the approval-binding SHA-256 and the receipt Ed25519 verification, using the same verifier core as the command line.
- No Stripe call, database, login, or chain transaction. The receipt's execution and evidence sections are story data. No chain private key was created or stored.

## Run it

```bash
nvm use 22 && corepack enable && pnpm install
forge install --no-git foundry-rs/forge-std --root contracts
pnpm test                                   # 38 vitest + 11 forge
pnpm verify out/receipt.s2.package.json     # VALID_UNANCHORED
pnpm verify out/receipt.s2.tampered.json    # INVALID: Digest, Signature
pnpm build:demo && pnpm demo                # http://localhost:4173/
```

`pnpm verify` needs no private key. `DEMO_MANIFEST.md` records what is real, what is not, and the exact revision. `EXPLAINER.md` explains each piece in plain English.

## Documents

- `EXPLAINER.md`: each piece in plain English, judge questions, the video.
- `DEMO_MANIFEST.md`: revision, digest, issuer key, acceptance, limitations.
- `DEMO_SCOPE.md`: what this weekend built and did not build.
- `PRODUCT_ARCHITECTURE.md`, `SECURITY_PRINCIPLES.md`: the design of record for the product build.
- `DESIGN_NOTES.md`, `docs/DESIGN_BRIEF.md`, `docs/MOTION_PLAN.md`, `docs/NARRATION.md`: the screens and the video.
- `AGENTS.md`: operating rules for the engineering agents that built this.

Internal planning records (company context, build philosophy, the decision log, and the execution plan) are kept privately. Where a document here cites a decision by its `PBX-` number, the decision text lives in that private log; the relevant facts are restated in `DEMO_MANIFEST.md` and `EXPLAINER.md`.

## Limits, stated plainly

A valid receipt proves the disclosed content has not changed since signing and that the recognised key signed it. It does not prove completeness, legal authority, correct human judgment, or safe agent behavior. The demo submits no chain transaction; the anchor is reported honestly as not submitted.

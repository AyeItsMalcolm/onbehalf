# Onbehalf demo — Manifest

| Field | Value |
| --- | --- |
| Purpose | YZi EASY Residency S5 application demo. Not the product. |
| Source revision | `24c4e2410c4d` (this manifest is committed on top of it) |
| Written | 2026-09-19T22:18Z |
| Company name in UI and copy | Onbehalf. Repository folder keeps the Project Blackbox codename. |
| Decisions in force | `DECISIONS.md` PBX-021 |

## What is real

- Fixture receipt core: `fixtures/receipt.s2.json` (48 signed fields, every `sha256:` value is the hash of a file in `fixtures/s2/`).
- Canonicalization RFC 8785 via the `canonicalize` package; canonical bytes: 1974 (`out/receipt.s2.canonical.json`).
- Digest: SHA-256, `0xfe87e8cab852fbd98df2f0e281d89709ad8cf2576ec0a67cd014995cdf6a2ed1`.
- Signature: Ed25519 over the canonical bytes, in `out/receipt.s2.package.json`. Issuer `onbehalf-demo`, key ID `key_2a4a68fc9d874bfb`, public-key fingerprint `sha256:2a4a68fc9d874bfba2dd2fbada945913114b351312a07f64d47c7429ae8b7ae9`.
- Verifier CLI (`pnpm verify`): five checks reported separately; genuine package → `VALID_UNANCHORED`; tampered copy (`out/receipt.s2.tampered.json`, amount 75000 → 95000) → `INVALID`, Digest FAIL, Signature FAIL.
- Tests: 38 vitest (`proof/test/`) + 11 Foundry (`contracts/test/`), all passing at this revision.
- Contract: `contracts/src/EvidenceAnchor.sol`, Solidity 0.8.28, warnings denied. Written and tested. **Not deployed.**
- In the screens: the approval-binding SHA-256 and the receipt Ed25519 verification run in the browser (`demo/assets/verifier.js`, bundled from the same core as the CLI).

## What is not in this demo (PBX-021)

- **No chain transaction was submitted and no chain private key was created or stored.** Chain ID configured: 97 (BNB Smart Chain testnet), unused. Contract address: none. Transaction hash: none. `anchorProof.state` is `NOT_SUBMITTED`, reason "not submitted in demo". The anchor script's read side (`proof/src/anchor/reader.ts`) and the verifier's anchor check are implemented and environment-driven but never run.
- No Stripe call, database, login, webhook, or policy engine. The receipt's execution and evidence sections are fixture data; evidence level is `PROVIDER_OBSERVED`.
- The three screens are a labeled prototype (`demo/`).

## Secrets

- `.env` holds only `RECEIPT_SIGNING_KEY` (Ed25519, PKCS8 base64). It is gitignored and untracked. `.env.example` documents four names with no values.
- `pnpm scan:secrets` at this revision: CLEAN (`.env` ignored and untracked; `.env.example` names only; no Stripe key prefixes, PEM private-key markers, env assignments with values, or live `.env` values in any tracked file).
- The receipt's `commitmentNonce` is inside the private package by design (PBX-011) and is not listed here.

## The video

- `pnpm capture:demo` → `demo/captures/onbehalf-demo.mp4` (1920×1080, H.264, 30 fps container; Playwright captures at 25 fps), `onbehalf-demo.webm`, `onbehalf-demo-timestamps.txt`, `frames/beat-<n>.png`, `gate-log.json`. Runtime ≈ 79 s. Silent; captions, cursor, and cards per `docs/NARRATION.md` v3; event-driven pacing (2.6 s read, 3.0 s register).
- Render gate (runs after every render): per-beat frame pulled from the mp4; caption present in pixels, text matches the beat table, no overlap with the anchor, clicked controls, nav, footer, or page content; card beats show the card. Last render: PASS on all 13 checks.
- `pnpm capture:demo --plan` is a dry run with real pacing that prints the schedule and measured runtime.
- `demo/captures/` is gitignored; re-render from this revision to reproduce.

## Commands

```bash
nvm use 22 && corepack enable && pnpm install
forge install --no-git foundry-rs/forge-std --root contracts   # forge-std is not vendored
pnpm test              # 38 vitest + 11 forge
pnpm verify out/receipt.s2.package.json    # VALID_UNANCHORED
pnpm verify out/receipt.s2.tampered.json   # INVALID: Digest, Signature
pnpm build:demo && pnpm demo               # http://localhost:4173/
pnpm capture:demo                          # renders the video (needs ffmpeg for the mp4)
pnpm scan:secrets
```

Signing again (`pnpm keygen`, `pnpm fixture`, `pnpm sign`) on a fresh clone creates a new key and therefore a new key ID, fingerprint, and signature; the committed package in `out/` is the artifact this manifest describes, and `pnpm verify` needs no private key.

## Acceptance (DEMO_SCOPE.md §6, as amended by PBX-021)

- [x] `pnpm test` passes (38 + 11).
- [x] `pnpm verify out/receipt.s2.package.json` → VALID_UNANCHORED, reason stated.
- [x] `pnpm verify out/receipt.s2.tampered.json` → INVALID, Digest and Signature named.
- [ ] Anchor tx on BscScan: **intentionally not done** (PBX-021).
- [x] `pnpm demo` serves three screens; Approve leads to the receipt; tampered toggle works with real browser verification.
- [x] Secrets scan clean; `.env` gitignored; `.env.example` names only.
- [x] `EXPLAINER.md` complete.
- [x] This manifest.

## Known limitations

- The verifier's anchor sub-checks are exercised only against an in-memory chain in tests, never a live RPC.
- No fallback Ed25519 verifier in the browser; unsupported browsers see a plain message and are pointed at the CLI (Chrome 137+, Safari 17+, Firefox 130+ are fine).
- Video capture is 25 fps.
- Google Fonts (Geist, Geist Mono) load from the network; the pages fall back to system fonts offline.

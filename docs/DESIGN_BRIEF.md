# Onbehalf — Design Brief (demo screens)

| Field | Value |
| --- | --- |
| Owner | Malcolm Henzaga |
| Written | 2026-09-18, from the eight-question design interview |
| Governs | `demo/index.html`, `demo/action.html`, `demo/receipt.html` and their shared assets |
| Sits under | `DESIGN_NOTES.md` (tokens, copy, layout). Where this brief is more specific, follow this brief. |

## Malcolm's answers, as rules I follow

1. **Reference feel: Mercury.** A bank's calm. Warm off-white, near-black type, one restrained accent, generous margins, money in tabular mono. Not Linear's density, not Stripe's panels, not Vercel's monochrome.
2. **Light theme.** `bg #F4F1EC`, `surface #FFFFFF`, `ink #14161A`. Dark mode is not built.
3. **Wow order: live binding first, tamper flip last.** Action detail carries the live-binding moment; the receipt page's tamper flip ends the video and must land.
4. **Motion: subtle.** 150–250 ms micro, 300–450 ms state changes, one staggered reveal on load, five choreographed moments. Nothing decorative, nothing looping without a job. See `MOTION_PLAN.md`.
5. **Receipt is a document.** Certificate-like: header with receipt ID and issue time, five ledger rows, a small seal-like mark carrying the issuer key ID, digest and signature in mono at the foot.
6. **One developer card, verify only.** The exact `pnpm verify` command and its output, under the verifier panel. No invented SDK.
7. **Spacious.** 20–24 px card padding, one idea per card, 14 px body. Readable at a glance in a 1080p recording.
8. **Never:** purple-blue gradients or glow; random stat cards, sparklines, donut charts; emoji, an icon on every label, shield or checkmark badges, robot or brain art; a generic green "Verified" badge.

## Standard of work

"A product a bank would pay for and a developer would screenshot." If a detail would not survive a Stripe design review, it does not ship.

## Tokens (CSS custom properties)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#F4F1EC` | page |
| `--surface` | `#FFFFFF` | cards, rows, nav |
| `--ink` | `#14161A` | primary text, primary buttons |
| `--muted` | `#5B564F` | secondary text |
| `--caption` | `#857F76` | labels, timestamps, footers; 12–13 px only, on bg or surface only |
| `--border` | `#DDD7CD` | 1 px borders, dividers |
| `--amber` | `#B7791F` | waiting: Awaiting approval, anchor pending, executing |
| `--green` | `#0F6E56` | confirmed only: provider confirmed, check PASS |
| `--red` | `#B42318` | denial, rejection, invalid, FAIL, approval invalidated |
| `--link` | `#1F4FB3` | the one accent: links and focus rings only |
| `--shadow` | `0 1px 2px rgba(20,22,26,0.06)` | the only shadow |
| `--radius-card` | `12px` | cards |
| `--radius-control` | `8px` | buttons, inputs, chips |

Amber, green, red appear only as an 8 px dot plus text, or as text on a PASS/FAIL line, or as the 1 px underline sweep on a failed check. Never as a filled pill, never as a background wash.

## Type

- **Geist** for UI, **Geist Mono** for every `sha256:`, `0x`, `rcpt_`, `pi_`, `re_`, `key_`, address, and for amounts in tables. Google Fonts, `font-display: swap`, fallback `system-ui`.
- Page title 28/600, letter-spacing −0.01em. Section title 16/600. Body 14/400, line-height 1.5. Labels 12/500 uppercase, 0.06em tracking, `--caption`.
- Amounts: `font-variant-numeric: tabular-nums`, Geist for the on-page amount, Geist Mono inside tables and the receipt.
- Hashes: middle-ellipsized (first 10, last 6) with the full value in `title` and revealed on hover in a mono tooltip. Copy on click.

## Layout

- Content max 1120 px, centered, 32 px side padding. At 1920×1080 the content sits in a 1120 px column with equal margins; nothing important below the fold on action detail and receipt.
- Top nav: `Onbehalf` wordmark (Geist 20/700, −0.02em) with the 28 px mark (outer open bracket in ink, small solid dot offset inside in green); right side links `Approvals · Actions · Receipts · Verifier` and the persistent pill `Sandbox · Stripe test · BNB testnet` in caption on surface with border.
- Cards: surface, 1 px border, 12 px radius, 24 px padding, `--shadow`.
- Key/value rows: two-column grid, 140 px label column in caption uppercase, value in ink 14 px. Row gap 12 px.
- Buttons: primary = ink background, bg text, 8 px radius, 12 px 18 px padding, 600 weight, min height 44 px. Secondary = transparent, 1 px border. Danger = secondary with red text. Hover: primary darkens to `#000`, secondary gets `--bg` background. Active: scale 0.97 for 120 ms. Focus: 2 px `--link` ring, 2 px offset.
- Chips: 8 px dot + text. No fill.
- Footer on every page, caption: "Prototype screens. Receipt, anchor, and verifier are live — see repository."

## Screens

**Queue (`index.html`).** Title "Approvals". One card row: left "Refund · $750.00 USD" 16/600 with "Requested by refund-agent v1 · pi_3Q…8d" muted; middle amber chip "Awaiting approval"; right "Expires in 14:32" caption and primary "Review". Below: "No other actions pending." in caption. The card carries `view-transition-name: action-card` so it expands into the detail page.

**Action detail (`action.html`).** Title "Refund · $750.00 USD". Four cards: Request (action type, target, amount as an inline editable field, currency, reason), Authority (mandate ref, version 3, autonomous limit $500.00, active), Policy (REQUIRE_APPROVAL, `HUMAN_APPROVAL_REQUIRED`, evaluated at), Approval binding (digest in mono, expiry). Status strip: Policy · Approval · Execution · Evidence. Footer actions right-aligned: danger "Reject", primary "Approve exact action". Caption under the buttons: "Approving binds your decision to this exact amount, target, mandate v3, and policy v1. Any change requires a new approval."

**Receipt (`receipt.html`).** Title "Receipt rcpt_s2_7f3a9c2e". Left: the document. Header band with receipt ID, issued time, issuer `onbehalf-demo`, seal mark with `key_2a4a68fc9d874bfb`. Five ledger rows: Mandate, Policy, Approval, Execution, Evidence. Foot: digest and signature in mono, the two limitations in caption. Right: "Verifier" card with the five checks on their own lines, the overall banner ("Verification valid" green / "Verification invalid" red naming the failed checks), the toggle "Show tampered copy", then "Anchor details" (state `NOT_SUBMITTED`: "Receipt signed; anchor pending" in amber, one paragraph: contract written and tested with 11 Foundry tests; deployment is a configuration step; no chain transaction in this demo), then links "Download receipt package" and the developer card with `pnpm verify` and its output. Caption under the card: "Covers the configured gateway route only. Does not prove completeness, legal authority, or safe agent behavior."

## Copy

Use the required state language from `DESIGN_NOTES.md` exactly. Sentence case everywhere except tracked labels. No exclamation marks. No "successfully". Numbers as `$750.00 USD`, never `$750`.

## Accessibility and recording

- Text contrast ≥ 4.5:1 on its background (caption color only at 12–13 px on bg or surface, where it measures 4.6:1).
- Visible focus rings on every interactive element; cursor `pointer` only where clickable.
- `prefers-reduced-motion: reduce` collapses every animation to an instant state change.
- Empty, loading, and error states are designed: the queue's empty line, the verifier's "Checking…" state while WebCrypto runs, and a plain error line if the browser lacks Ed25519 and the fallback also fails.

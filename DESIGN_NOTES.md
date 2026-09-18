# Onbehalf — Design Notes (demo screens)

Stands in for the unwritten `DESIGN_SYSTEM.md`. Expands `MASTER_CONTEXT.md` §21 ("institutional trust with a forward-looking infrastructure feel"). Follow exactly for the prototype screens; a future design system may replace it.

## Feel in one line

A bank's audit report designed by a good developer-tools team. Calm, legible, generous space, no decoration. Approval is a normal state, not an alarm.

## Colors (light theme for the console)

| Token | Hex | Use |
| --- | --- | --- |
| `bg` | `#F4F1EC` | Page background (warm white) |
| `surface` | `#FFFFFF` | Cards, table rows |
| `ink` | `#14161A` | Primary text, primary buttons |
| `muted` | `#5B564F` | Secondary text |
| `caption` | `#857F76` | Labels, timestamps, footers (use only at 12–13px and only on `bg`/`surface`) |
| `border` | `#DDD7CD` | 1px borders and dividers |
| `amber` | `#B7791F` | Attention: Awaiting approval, Anchor pending, Outcome unknown |
| `green` | `#0F6E56` | Confirmed only: provider confirmed, receipt anchored, check PASS |
| `red` | `#B42318` | Danger only: Denied by policy, Rejected, Verification INVALID, check FAIL |
| `link` | `#1F4FB3` | Links (BscScan, download) |

Rules: never a generic green "verified" badge; green only on a specific confirmed check. Amber for anything waiting. Red only for denial, rejection, failure, invalid. No gradients, no glows, no neon, no emoji, no robot or brain illustrations.

## Type

- UI and headings: **Geist** (Google Fonts). Fallback `system-ui, sans-serif`.
- Hashes, IDs, amounts in tables, addresses: **Geist Mono**. Always mono for `sha256:…`, `0x…`, `rcpt_…`, `pi_…`, `re_…`.
- Sizes: page title 28px/600; section title 16px/600; body 14px; labels 12px uppercase with 0.06em tracking in `caption`.

## Layout

- Max content width 1120px, centered, 32px side padding.
- Top nav: left = wordmark "Onbehalf" (Geist 20px/700, letter-spacing −0.02em) with a small mark (see below); right = links "Approvals · Actions · Receipts · Verifier" and a persistent pill badge **"Sandbox · Stripe test · BNB testnet"** in `caption` on `surface` with `border`.
- Cards: `surface`, 1px `border`, 12px radius, 20–24px padding. No shadows heavier than `0 1px 2px rgba(20,22,26,0.06)`.
- Key/value rows: two-column grid, label column 140px in `caption` uppercase, value in `ink` 14px.
- Buttons: primary = `ink` background, `bg` text, 8px radius, 12px 18px padding, 600 weight. Secondary = transparent with 1px `border`. Danger (Reject) = secondary with `red` text. Minimum height 44px.
- Status chips: 8px colored dot + text, never filled pill backgrounds. Dot color = amber/green/red per rules above.

## Wordmark and mark

- Wordmark: "Onbehalf", one word, capital O only.
- Mark (inline SVG, 28px): two concentric shapes reading as "acting for": an outer open bracket/arc in `ink` and a small solid dot offset inside in `green`. Keep it abstract; if unsure, use the wordmark alone.

## Required state language (copy exactly)

`Awaiting approval` · `Approved by J. Tan` · `Rejected by approver` · `Denied by policy` · `Execution not started` · `Outcome unknown` · `Provider confirmed` · `Receipt signed; anchor pending` · `Receipt anchored` · `Verification valid` · `Verification invalid`

Each verifier check is its own line: `Schema PASS` · `Digest PASS/FAIL` · `Signature PASS/FAIL` · `Issuer PASS` · `Anchor PASS/PENDING`.

## Page-by-page

**Approvals queue (`index.html`)**: title "Approvals"; one card row: left = "Refund · $750.00 USD" in ink 16px/600 with "Requested by refund-agent v1 · pi_3Q…8d" in muted below; middle = amber chip "Awaiting approval"; right = "Expires in 14:32" caption and a primary button "Review". Empty-state line below: "No other actions pending."

**Action detail (`action.html`)**: title "Refund · $750.00 USD"; four cards stacked: Request, Authority, Policy, Approval binding (binding digest in mono, expiry). Then a compact status strip: Policy REQUIRE_APPROVAL (amber) · Approval Awaiting (amber) · Execution Not started · Evidence Not issued. Footer actions right-aligned: secondary-danger "Reject", primary "Approve exact action". Under the buttons, caption: "Approving binds your decision to this exact amount, target, mandate v3, and policy v1. Any change requires a new approval."

**Receipt (`receipt.html`)**: title "Receipt rcpt_…"; left card = the five rows (Mandate / Policy / Approval / Execution / Evidence) as in the hero mockup; right card = "Verifier" with each check on its own line, overall "Verification valid" in green; links "Download receipt package" and "View anchor on BscScan"; toggle "Show tampered copy" that re-renders the right card with Digest FAIL and Signature FAIL in red and overall "Verification invalid". Caption under the card: "Covers the configured gateway route only. Does not prove completeness, legal authority, or safe agent behavior."

Every page footer (caption): "Prototype screens. Receipt, anchor, and verifier are live — see repository."

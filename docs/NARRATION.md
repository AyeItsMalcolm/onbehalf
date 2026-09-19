# Onbehalf demo — narration v3 (silent, event-driven)

This file is the source of truth for `pnpm capture:demo`. The video is silent: no voice-over, no narration track. Captions and two cards carry the story. There are no fixed holds; every beat is paced by its own events.

## Pacing per beat

caption fades in (200 ms) → 2.6 s read time → perform the action → wait for the animation to fully settle → 3.0 s so the result registers → 300 ms caption fade-out → next beat. (Malcolm set read and register to 2.6 s and 3.0 s on 2026-09-19, up from 1.2 s and 1.5 s, to reach the 80–95 s target; the measured plan at 2.0/2.2 was 68 s.)

Where a beat swaps its caption after the action (beats 3, 5, 7), the second caption gets the same 200 ms fade-in and its own 3.0 s settle before the 300 ms fade-out.

"Settled" means: navigation complete, fonts loaded, and no animation running anywhere on the page for 250 ms, plus the beat's own condition (for example, the red chip text present, the View receipt button visible, the red banner present).

Target total runtime: 80–95 s. `pnpm capture:demo --plan` prints the measured estimate before rendering.

## Cards

- Opening card, 2 s: mark + "Onbehalf" wordmark (Geist 48px/700), tagline "Agents act on behalf. We prove who." beneath in `#5B564F` 22px.
- Closing card, 3 s: same, tagline `#14161A` 28px.
- Warm-white `#F4F1EC` background. 300 ms cross-fades to and from the pages.

## Caption style

One floating card. Warm-white `#F4F1EC` at 92% opacity, 1 px `#DDD7CD` border, 10 px radius, near-black `#14161A` Geist 20px/500, max 10 words, max width 420 px, padding 14 px 18 px.

Placement: the largest empty region nearest the beat's anchor element, never covering the anchor, any control about to be clicked, the nav, or the footer. On the detail page prefer the empty space left of the footer buttons, or the top-right under the status chip. Captions and cards are injected during capture only; the shipped demo pages stay unchanged.

## Cursor

Visible injected arrow, 400–600 ms eased moves, 150 ms press indication on click, typing at ~80 ms per character.

## Beats

| # | Page | Anchor | Caption | Action | Then |
|---|---|---|---|---|---|
| A | Opening card | — | — | 2 s | 300 ms cross-fade to the queue |
| 1 | Queue | pending row | One action waiting. $750 needs a person. | click **Review** | |
| 2 | Detail | Approval binding card | The approval is bound to these exact facts. | move cursor to the amount field | |
| 3 | Detail | amount field | Change the amount… | type `950.00`, click away, let the scramble and red chip land | swap caption to "…and the approval is invalidated." (anchor: red status chip) for the settle time |
| 4 | Detail | amount field | Restore it. Same fingerprint. | type `750.00`, click away, settle | |
| 5 | Detail | Approve button | Approve the exact action. | click, let the full sequence play | swap caption to "Executed once. Receipt signed. Anchor honestly pending." (anchor: status strip) for the settle time |
| 6 | Receipt | verifier card | Your browser re-checks the receipt. Four checks pass. | slow cursor drift down the PASS lines, no click | |
| 7 | Receipt | tamper switch | Same receipt, one number changed after signing. | flip it, let the re-evaluation and red banner land | swap caption to "Two checks fail, and say which." (anchor: red banner) |
| 8 | Receipt | "Run it yourself" card | Same answer from the command line. | smooth-scroll (600 ms) to it, settle | |
| 9 | Closing card | — | — | 3 s | end |

## Output

- 1920×1080. `demo/captures/onbehalf-demo.mp4` (H.264, yuv420p via ffmpeg from the Playwright webm; Playwright records at 25 fps).
- `demo/captures/onbehalf-demo-timestamps.txt`: one line per beat and caption swap, `mm:ss beat caption`.
- `demo/captures/frames/beat-<n>.png`: one frame per beat at its settle point.

## Render gate (automated, runs after every render, fails the render on any miss)

For every beat, one frame is pulled from the mp4 at the beat's settle point with ffmpeg and checked:

- a page beat's frame must contain its caption (pixel check of the caption region: card-colored background with dark text pixels);
- the caption text at settle time must equal the table above;
- the caption box must not overlap its anchor, any clicked control, the nav, or the footer (DOM boxes recorded at settle time);
- a card beat's frame must show the card (warm-white frame with the wordmark in the center).

The per-beat check table is printed. Any miss exits non-zero and the video is not delivered.

## Process

`pnpm capture:demo --plan` performs a dry run without video and prints the schedule (beat, caption, planned placement, estimated seconds). Malcolm okays it. `pnpm capture:demo` renders, runs the gate, and prints the table.

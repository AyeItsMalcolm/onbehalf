# Onbehalf demo — narration, captions, and capture timing

This file is the source of truth for `pnpm capture:demo` and `pnpm demo:autopilot`. Each beat's on-screen hold is derived from the spoken line: **hold = words ÷ 2.3 + 1.5 s** (Malcolm speaks at ~140 wpm). Animations and page transitions add their own time on top; they never shorten a hold. Malcolm reads the "Say" column while the finished video plays.

Voice: same as the founder video. Plain, first person, short sentences. Amounts spoken as words ("seven hundred fifty dollars"). Captions are shorter than the spoken line so a muted viewer can read each one in under three seconds.

## Beats

| # | On screen | Action Claude Code performs | Caption (bottom bar) | Say | Words | Hold |
|---|---|---|---|---|---|---|
| A | **Opening card**: warm-white frame, Onbehalf mark and wordmark centered, tagline beneath in muted text | Static card, 200 ms fade in. | *(none; the card is the caption)* | *(silence)* | 0 | 3 s |
| 0 | Approvals queue, freshly loaded | 300 ms cross-fade from the card. Cursor idle. | One mandate. A human when it matters. Execute once. Sign a receipt. | This is Onbehalf. In my video I said we put one mandate on every rail an agent uses, pause for a human when it matters, execute once, and sign a receipt. This is what that looks like. | 36 | 17 s |
| 1 | Approvals queue | Cursor moves to the pending row; no click yet. | $750 refund requested. Over the $500 limit, so a person decides. | One action is waiting. A support agent asked to refund seven hundred fifty dollars. Under five hundred, the agent could do it alone. This one needs a person. | 27 | 13 s |
| 2 | Action detail, after Review | Click **Review**. Let the page transition finish. Cursor drifts to the Approval binding card. | The approval is bound to a fingerprint of the exact facts. | This is what the finance lead sees. What the agent asked for. What it's allowed to do. What the rule decided. And this fingerprint: the exact amount, target, mandate, and policy she is about to approve. | 36 | 17 s |
| 3 | Action detail, amount edited to 950, red state | Click the amount field, type `950.00`, click away. Let the scramble and the red chip land. Cursor rests near the binding digest. | Change the amount, and the approval is invalidated. | Change the amount, and watch the fingerprint. Every character changes, and the approval dies. You cannot approve seven fifty and have the agent refund nine fifty. | 27 | 13 s |
| 4 | Action detail, amount restored, amber state | Click the amount field, type `750.00`, click away. Let the hash settle. | Restore it. Same facts, same fingerprint. | Put it back. Same facts, same fingerprint. | 8 | 5 s |
| 5 | Action detail, approve sequence through "Anchor pending" | Click **Approve exact action**. Let the whole choreography play. Hold after it finishes. | Approved once. Executed once. Receipt signed. Anchor shown honestly as pending. | She approves that exact action. One refund executes. Stripe confirms it. The receipt is signed. The anchor is a separate state, and we show it as pending instead of faking a green line. | 33 | 16 s (clock starts when the sequence starts) |
| 6 | Receipt page, verifier all PASS | Click **View receipt**. Let the transition finish. Cursor drifts down the four PASS lines. | A verifier running in your browser. Four checks pass. | Here is the receipt. The left side is what an auditor keeps. The right side is a verifier running in your browser, not a screenshot. Structure, fingerprint, signature, issuer. All pass. | 32 | 15 s |
| 7 | Receipt page, tampered, two FAILs | Click **Show tampered copy**. Let the top-to-bottom re-evaluation and red banner land. Cursor rests on the banner. | One number changed after signing. Two checks fail and say which. | Now the same receipt with one number changed after signing. Two checks fail, and they tell you which. That is what an insurer gets from us that a log cannot give them. | 32 | 15 s |
| 8 | Receipt page, scrolled to "Run it yourself" | Smooth-scroll (600 ms) so the terminal card is fully visible. | Same result from the command line. No trust in our dashboard required. | And the same answer from the command line. Nothing here depends on trusting our dashboard. | 15 | 8 s |
| 9 | **Closing card**: same as the opening card, tagline larger | Cursor leaves the frame; 300 ms cross-fade to the card. | *(none; the card is the caption)* | Onbehalf. Agents act on behalf. We prove who. | 8 | 4 s |

**Estimated runtime:** ~2:05 spoken + 7 s of cards + ~15 s of transitions and animations ≈ **2:25–2:30**.

If the $300 completed row is in the queue, append to beat 1's "Say": *"The three-hundred-dollar refund below it went through on its own."* (11 words → hold becomes 18 s) and change its caption to: *$750 needs a person. $300 went through on its own.*

## Caption bar spec

- One fixed bar, bottom of frame, full content width (1120 px, centered), 56 px tall, 16 px above the footer so it never covers footer text or any clicked control.
- Warm-white surface `#F4F1EC` at 96% opacity, 1 px `#DDD7CD` border, 10 px radius, near-black `#14161A` text, Geist 22px / 500, centered.
- Appears at the start of each beat with a 200 ms fade; cross-fades to the next caption at the beat boundary. Never changes mid-animation.
- Minimum on-screen time for any caption is the beat's hold; the shortest is 5 s. A 12-word caption reads in ~3 s.
- Injected only during capture. The shipped demo pages never contain the bar.

## Cursor spec

- Injected visible cursor (standard arrow, 24 px, subtle drop shadow). Moves on 400–600 ms eased paths, never teleports.
- Click shows a 150 ms press indication (cursor scales to 90% and back). Typing into the amount field happens at ~80 ms per character so the viewer sees it.

## Opening and closing cards

- Same palette and type as the product. Mark + "Onbehalf" wordmark (Geist 48px / 700) centered; tagline "Agents act on behalf. We prove who." beneath in `#5B564F` 22px on the opening card, `#14161A` 28px on the closing card.
- No motion on the cards beyond the fade.

## Capture rules

- 1920×1080. Prefer 60 fps; if Playwright's recorder caps lower, note the fps in the report and offer `pnpm demo:autopilot` (below) as the higher-fidelity path.
- Never cut a hold short because an animation finished early; the hold is for the voice.
- If a "Say" line is edited, recompute its hold from the new word count. Do not hand-tune holds.
- No audio track. Output `demo/captures/onbehalf-demo.mp4` (H.264, yuv420p) via ffmpeg from the Playwright webm.
- Write `demo/captures/onbehalf-demo-timestamps.txt`: one line per beat, `mm:ss  beat  first four words of Say`.

## Autopilot mode (best picture quality)

`pnpm demo:autopilot` runs the same beats, captions, cursor, and cards in a **headed** Chromium window sized 1920×1080 on Malcolm's screen, at native frame rate, while Malcolm screen-records it with QuickTime and narrates live. Same timing file, so the read-along works identically. A 3-second countdown appears before beat A so he can start the recording.

## Recording the voice (Malcolm)

**Option 1, voice over the mp4:** open the mp4 full-screen; QuickTime → New Screen Recording → mic on → record the screen while it plays; read each "Say" line when its beat appears. If you finish early, wait; the hold is built for you.

**Option 2, autopilot (sharper video):** start QuickTime screen recording with mic on, run `pnpm demo:autopilot`, read along as it drives.

One take either way. Stumbles are fine. Stop after the closing card.

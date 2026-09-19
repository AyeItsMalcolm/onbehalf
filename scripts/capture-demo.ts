/**
 * pnpm capture:demo
 *
 * Renders the silent demo video exactly as docs/NARRATION.md specifies:
 * opening card → nine beats across the three pages → closing card, with the
 * caption bar, an injected cursor, and holds derived from the spoken lines
 * (hold = words ÷ 2.3 + 1.5 s). No audio. The overlay (bar, cursor, cards)
 * is injected only during capture; the shipped pages never contain it.
 *
 * Outputs:
 *   demo/captures/onbehalf-demo.webm             Playwright recording (25 fps)
 *   demo/captures/onbehalf-demo.mp4              H.264 yuv420p via ffmpeg, if installed
 *   demo/captures/onbehalf-demo-timestamps.txt   mm:ss  beat  first four words of Say
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";

const ROOT = process.cwd();
const PORT = 4176;
const OUT = resolve(ROOT, "demo/captures");
const BASE = `http://localhost:${PORT}`;
const WPM_DIVISOR = 2.3;
const HOLD_PAD_S = 1.5;

interface Beat {
  id: string;
  caption: string | null;
  say: string | null;
  /** Fixed hold for the cards; otherwise derived from `say`. */
  fixedHoldS?: number;
}

// The $300 completed row IS in the queue, so beat 1 carries the appended line (NARRATION.md).
const BEATS: Beat[] = [
  { id: "A", caption: null, say: null, fixedHoldS: 3 },
  {
    id: "0",
    caption: "One mandate. A human when it matters. Execute once. Sign a receipt.",
    say: "This is Onbehalf. In my video I said we put one mandate on every rail an agent uses, pause for a human when it matters, execute once, and sign a receipt. This is what that looks like.",
  },
  {
    id: "1",
    caption: "$750 needs a person. $300 went through on its own.",
    say: "One action is waiting. A support agent asked to refund seven hundred fifty dollars. Under five hundred, the agent could do it alone. This one needs a person. The three-hundred-dollar refund below it went through on its own.",
  },
  {
    id: "2",
    caption: "The approval is bound to a fingerprint of the exact facts.",
    say: "This is what the finance lead sees. What the agent asked for. What it's allowed to do. What the rule decided. And this fingerprint: the exact amount, target, mandate, and policy she is about to approve.",
  },
  {
    id: "3",
    caption: "Change the amount, and the approval is invalidated.",
    say: "Change the amount, and watch the fingerprint. Every character changes, and the approval dies. You cannot approve seven fifty and have the agent refund nine fifty.",
  },
  { id: "4", caption: "Restore it. Same facts, same fingerprint.", say: "Put it back. Same facts, same fingerprint." },
  {
    id: "5",
    caption: "Approved once. Executed once. Receipt signed. Anchor shown honestly as pending.",
    say: "She approves that exact action. One refund executes. Stripe confirms it. The receipt is signed. The anchor is a separate state, and we show it as pending instead of faking a green line.",
  },
  {
    id: "6",
    caption: "A verifier running in your browser. Four checks pass.",
    say: "Here is the receipt. The left side is what an auditor keeps. The right side is a verifier running in your browser, not a screenshot. Structure, fingerprint, signature, issuer. All pass.",
  },
  {
    id: "7",
    caption: "One number changed after signing. Two checks fail and say which.",
    say: "Now the same receipt with one number changed after signing. Two checks fail, and they tell you which. That is what an insurer gets from us that a log cannot give them.",
  },
  {
    id: "8",
    caption: "Same result from the command line. No trust in our dashboard required.",
    say: "And the same answer from the command line. Nothing here depends on trusting our dashboard.",
  },
  { id: "9", caption: null, say: "Onbehalf. Agents act on behalf. We prove who.", fixedHoldS: 4 },
];

const words = (s: string | null) => (s ? s.trim().split(/\s+/).length : 0);
const holdMs = (b: Beat) => Math.round(1000 * (b.fixedHoldS ?? words(b.say) / WPM_DIVISOR + HOLD_PAD_S));
const firstFour = (s: string | null) => (s ? s.trim().split(/\s+/).slice(0, 4).join(" ") : "(card)");
const mmss = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Overlay: caption bar, cursor, opening/closing card. Injected on every
// document; state survives cross-document navigation via sessionStorage so
// the bar and cursor look continuous through View Transitions.
// ---------------------------------------------------------------------------
const OVERLAY = String.raw`(() => {
  const KEY = "onbehalf.capture";
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const write = (patch) => sessionStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
  const MARK = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M20 4.5A10.5 10.5 0 1 0 20 23.5" fill="none" stroke="#14161A" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="14" r="3.4" fill="#0f6e56"/></svg>';
  const CURSOR = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 3l14 9-6.2 1.2L16 20l-2.6 1.2-3.2-6.7L5 19z" fill="#fff" stroke="#14161A" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function build() {
    if (document.getElementById("cap-bar")) return;
    const st = read();
    const style = document.createElement("style");
    style.textContent = [
      "#cap-bar{position:fixed;left:50%;bottom:80px;width:1120px;height:56px;transform:translateX(-50%);",
      "background:rgba(244,241,236,0.96);border:1px solid #DDD7CD;border-radius:10px;color:#14161A;",
      "font:500 22px/1 'Geist',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;",
      "z-index:9999;pointer-events:none;view-transition-name:cap-bar;}",
      "#cap-bar .t{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;white-space:nowrap;}",
      "#cap-cursor{position:fixed;left:0;top:0;width:24px;height:24px;z-index:10000;pointer-events:none;",
      "filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));view-transition-name:cap-cursor;will-change:transform;}",
      "#cap-card{position:fixed;inset:0;background:#F4F1EC;z-index:10001;display:flex;flex-direction:column;",
      "align-items:center;justify-content:center;gap:22px;font-family:'Geist',system-ui,sans-serif;color:#14161A;}",
      "#cap-card .wm{display:flex;align-items:center;gap:18px;font-size:48px;font-weight:700;letter-spacing:-0.02em;}",
      "#cap-card .wm svg{width:64px;height:64px;}",
      "#cap-card .tag{font-size:22px;font-weight:400;color:#5B564F;}",
      "#cap-card[data-kind=close] .tag{font-size:28px;color:#14161A;font-weight:500;}",
      "::view-transition-group(cap-bar),::view-transition-group(cap-cursor){animation-duration:0s;}",
    ].join("");
    document.head.appendChild(style);

    const bar = document.createElement("div");
    bar.id = "cap-bar";
    bar.innerHTML = '<span class="t"></span>';
    bar.style.opacity = st.caption ? "1" : "0";
    bar.querySelector(".t").textContent = st.caption || "";

    const cursor = document.createElement("div");
    cursor.id = "cap-cursor";
    cursor.innerHTML = CURSOR;
    cursor.style.transform = "translate(" + (st.cx ?? 960) + "px," + (st.cy ?? 540) + "px)";
    cursor.style.opacity = st.cursorHidden ? "0" : "1";

    const card = document.createElement("div");
    card.id = "cap-card";
    card.innerHTML = '<div class="wm">' + MARK + '<span>Onbehalf</span></div><div class="tag">Agents act on behalf. We prove who.</div>';
    card.style.opacity = "0";
    card.style.display = "none";
    if (st.card) { card.dataset.kind = st.card; card.style.display = "flex"; card.style.opacity = "1"; }

    document.body.append(bar, cursor, card);
  }

  const el = (id) => document.getElementById(id);
  const fade = (node, from, to, ms) => new Promise((res) => {
    const a = node.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: "ease-in-out", fill: "forwards" });
    a.onfinish = () => { node.style.opacity = String(to); a.cancel(); res(); };
  });

  window.__cap = {
    setCaption: async (text, ms = 200) => {
      const bar = el("cap-bar");
      const old = bar.querySelector(".t");
      write({ caption: text });
      if (!text) { await fade(bar, 1, 0, ms); old.textContent = ""; return; }
      if (bar.style.opacity === "0" || !old.textContent) {
        old.textContent = text; bar.style.opacity = "0"; await fade(bar, 0, 1, ms); return;
      }
      const next = old.cloneNode(false); next.textContent = text; next.style.opacity = "0";
      bar.appendChild(next);
      await Promise.all([fade(old, 1, 0, ms), fade(next, 0, 1, ms)]);
      old.remove(); next.style.opacity = "";
    },
    showCard: async (kind, ms) => {
      const card = el("cap-card"); card.dataset.kind = kind; card.style.display = "flex";
      write({ card: kind }); await fade(card, 0, 1, ms);
    },
    hideCard: async (ms) => {
      const card = el("cap-card"); write({ card: null }); await fade(card, 1, 0, ms); card.style.display = "none";
    },
    moveCursor: (x, y, ms) => new Promise((res) => {
      const c = el("cap-cursor"); const st = read();
      const x0 = st.cx ?? 960, y0 = st.cy ?? 540; const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms); const e = ease(p);
        c.style.transform = "translate(" + (x0 + (x - x0) * e) + "px," + (y0 + (y - y0) * e) + "px)";
        if (p < 1) requestAnimationFrame(step); else { write({ cx: x, cy: y }); res(); }
      };
      requestAnimationFrame(step);
    }),
    press: () => new Promise((res) => {
      const c = el("cap-cursor").firstElementChild;
      const a = c.animate([{ transform: "scale(1)" }, { transform: "scale(0.9)" }, { transform: "scale(1)" }], { duration: 150, easing: "ease-in-out" });
      a.onfinish = () => res();
    }),
    hideCursor: async (ms) => { write({ cursorHidden: true }); await fade(el("cap-cursor"), 1, 0, ms); },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();`;

// ---------------------------------------------------------------------------

async function waitForServer(url: string, tries = 50): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("server did not start");
}

function ffmpegPath(): string | null {
  for (const p of ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"]) {
    const r = spawnSync(p, ["-version"], { stdio: "ignore" });
    if (r.status === 0) return p;
  }
  return null;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [resolve(ROOT, "scripts/serve.mjs"), "demo", String(PORT)], { stdio: "ignore" });
  const timestamps: string[] = [];
  let videoStart = 0;
  const stamp = (b: Beat) => timestamps.push(`${mmss(performance.now() - videoStart)}  ${b.id.padEnd(2)} ${firstFour(b.say)}`);

  try {
    await waitForServer(`${BASE}/index.html`);
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
    });
    await context.addInitScript(OVERLAY);
    const page = await context.newPage();
    videoStart = performance.now();

    const cap = async (fn: string, ...args: unknown[]) =>
      page.evaluate(({ fn, args }) => (window as unknown as { __cap: Record<string, (...a: unknown[]) => Promise<void>> }).__cap[fn]!(...args), { fn, args });
    const settle = async () => {
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
    };
    const center = async (selector: string, dx = 0, dy = 0) => {
      const box = await page.locator(selector).first().boundingBox();
      if (!box) throw new Error(`no box for ${selector}`);
      return { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy };
    };
    const glide = async (x: number, y: number, ms = 500) => {
      await Promise.all([cap("moveCursor", x, y, ms), page.mouse.move(x, y, { steps: Math.max(8, Math.round(ms / 40)) })]);
    };
    const click = async (x: number, y: number) => {
      await cap("press");
      await page.mouse.click(x, y);
    };
    const beatOf = (id: string) => BEATS.find((b) => b.id === id)!;
    const startBeat = async (id: string) => {
      const b = beatOf(id);
      stamp(b);
      if (b.caption) await cap("setCaption", b.caption, 200);
      return b;
    };
    const hold = (b: Beat, since = performance.now()) => sleep(Math.max(0, holdMs(b) - (performance.now() - since)));

    // Beat A: opening card over the freshly loaded queue.
    await page.goto(`${BASE}/index.html`, { waitUntil: "networkidle" });
    await settle();
    await page.evaluate(() => sessionStorage.setItem("onbehalf.capture", JSON.stringify({ cx: 960, cy: 620 })));
    const A = await startBeat("A");
    await cap("showCard", "open", 200);
    await hold(A);

    // Beat 0: queue, cross-fade from the card, cursor idle.
    const b0 = beatOf("0");
    stamp(b0);
    await Promise.all([cap("hideCard", 300), cap("setCaption", b0.caption, 300)]);
    await hold(b0);

    // Beat 1: cursor moves to the pending row, no click.
    const b1 = await startBeat("1");
    const rowPt = await center("#row", -60, 0);
    await glide(rowPt.x, rowPt.y, 600);
    await hold(b1);

    // Beat 2: click Review, let the transition finish, drift to the binding card.
    const b2 = await startBeat("2");
    const review = await center("#review");
    await glide(review.x, review.y, 500);
    await click(review.x, review.y);
    await page.waitForURL("**/action.html");
    await settle();
    await sleep(600); // view transition + reveal
    const digestPt = await center("#binding-digest", 250, 0);
    await glide(digestPt.x, digestPt.y + 40, 600);
    await hold(b2);

    // Beat 3: edit the amount to 950.00, click away, cursor rests near the digest.
    const b3 = await startBeat("3");
    const amount = await center("#amount");
    await glide(amount.x, amount.y, 500);
    await click(amount.x, amount.y);
    await page.keyboard.press("Meta+A");
    await page.keyboard.type("950.00", { delay: 80 });
    await glide(300, 600, 400);
    await click(300, 600);
    await glide(digestPt.x, digestPt.y + 40, 500);
    await sleep(500); // scramble + shake land
    await hold(b3);

    // Beat 4: restore 750.00, click away, let the hash settle.
    const b4 = await startBeat("4");
    await glide(amount.x, amount.y, 500);
    await click(amount.x, amount.y);
    await page.keyboard.press("Meta+A");
    await page.keyboard.type("750.00", { delay: 80 });
    await glide(300, 600, 400);
    await click(300, 600);
    await sleep(500);
    await hold(b4);

    // Beat 5: approve; the hold clock starts when the sequence starts.
    const b5 = await startBeat("5");
    const approve = await center("#approve");
    await glide(approve.x, approve.y, 550);
    const seqStart = performance.now();
    await click(approve.x, approve.y);
    await glide(approve.x - 320, approve.y, 400); // drift left of the buttons so the swap is clear
    await hold(b5, seqStart);

    // Beat 6: view receipt, drift down the PASS lines.
    const b6 = await startBeat("6");
    await page.locator("#view-receipt").waitFor({ state: "visible" });
    const view = await center("#view-receipt");
    await glide(view.x, view.y, 500);
    await click(view.x, view.y);
    await page.waitForURL("**/receipt.html");
    await settle();
    await sleep(1400); // transition, reveal, and the browser verification
    const schema = await center('.check[data-name="Schema"] .status', 40, 0);
    const issuer = await center('.check[data-name="Issuer"] .status', 40, 0);
    await glide(schema.x, schema.y, 500);
    await glide(issuer.x, issuer.y, 1600);
    await hold(b6);

    // Beat 7: show tampered copy, rest on the banner.
    const b7 = await startBeat("7");
    const toggle = await center("#toggle");
    await glide(toggle.x, toggle.y, 500);
    await click(toggle.x, toggle.y);
    await sleep(1400); // re-evaluation + banner
    const banner = await center("#banner", -150, 0);
    await glide(banner.x, banner.y, 500);
    await hold(b7);

    // Beat 8: smooth-scroll so the terminal card is fully visible above the bar.
    const b8 = await startBeat("8");
    await page.evaluate(() => {
      const pre = document.getElementById("cli")!;
      const barTop = window.innerHeight - 80 - 56 - 16;
      const bottom = pre.getBoundingClientRect().bottom;
      window.scrollBy({ top: Math.max(0, bottom - barTop), behavior: "smooth" });
    });
    await sleep(700);
    const cli = await center("#cli", -200, -40);
    await glide(cli.x, cli.y, 500);
    await hold(b8);

    // Beat 9: cursor leaves the frame, closing card.
    const b9 = beatOf("9");
    stamp(b9);
    await Promise.all([glide(1960, 700, 500), cap("setCaption", "", 200)]);
    await cap("hideCursor", 100);
    await cap("showCard", "close", 300);
    await hold(b9);

    const total = performance.now() - videoStart;
    const videoPath = await page.video()?.path();
    await context.close();
    await browser.close();

    const webm = resolve(OUT, "onbehalf-demo.webm");
    if (videoPath) renameSync(videoPath, webm);
    writeFileSync(resolve(OUT, "onbehalf-demo-timestamps.txt"), `${timestamps.join("\n")}\n${mmss(total)}  end\n`);

    console.log(`video      ${webm}  (${mmss(total)}, Playwright records at 25 fps)`);
    for (const b of BEATS) console.log(`  beat ${b.id.padEnd(2)} ${words(b.say).toString().padStart(2)} words  hold ${(holdMs(b) / 1000).toFixed(1)} s`);
    console.log(`timestamps ${resolve(OUT, "onbehalf-demo-timestamps.txt")}`);

    const ff = ffmpegPath();
    if (ff) {
      const mp4 = resolve(OUT, "onbehalf-demo.mp4");
      const r = spawnSync(ff, ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", mp4], { stdio: "inherit" });
      console.log(r.status === 0 ? `mp4        ${mp4}` : `mp4        ffmpeg failed (exit ${r.status}); webm kept`);
    } else {
      console.log("mp4        ffmpeg not found; webm kept. Install ffmpeg and re-run to produce the mp4.");
    }
  } finally {
    server.kill();
  }
  if (!existsSync(resolve(OUT, "onbehalf-demo.webm"))) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

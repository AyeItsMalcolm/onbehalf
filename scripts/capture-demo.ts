/**
 * pnpm capture:demo [--plan] [--gate-only]
 *
 * Renders the silent demo video from docs/NARRATION.md v3. Event-driven
 * pacing: caption in (200 ms) → 1.2 s read → action → settle → 1.5 s →
 * caption out (300 ms). Two cards (2 s open, 3 s close, 300 ms cross-fades).
 * Captions, cursor, and cards are injected only during capture.
 *
 *   --plan       dry run without video: measures each beat, prints the
 *                schedule (beat, caption, placement, estimated seconds).
 *   --gate-only  re-run the render gate on the existing mp4 + gate log.
 *
 * Outputs (demo/captures/): onbehalf-demo.webm, onbehalf-demo.mp4,
 * onbehalf-demo-timestamps.txt, frames/beat-<n>.png, gate-log.json.
 * The gate runs after every render and exits non-zero on any miss.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";

const ROOT = process.cwd();
const PORT = 4176;
const OUT = resolve(ROOT, "demo/captures");
const FRAMES = resolve(OUT, "frames");
const BASE = `http://localhost:${PORT}`;
const PLAN = process.argv.includes("--plan");
const GATE_ONLY = process.argv.includes("--gate-only");

// Pacing (NARRATION.md v3)
const CAPTION_IN = 200;
const READ = 2600;
const REGISTER = 3000;
const CAPTION_OUT = 300;
const CARD_OPEN = 2000;
const CARD_CLOSE = 3000;
const CARD_FADE = 300;

type Rect = { x: number; y: number; w: number; h: number };

interface GateEntry {
  beat: string;
  kind: "page" | "card";
  caption: string | null;
  /** seconds into the video at which to pull the frame */
  t: number;
  captionRect?: Rect | undefined;
  anchorRect?: Rect | undefined;
  avoidRects?: Rect[] | undefined;
  contentRects?: Rect[] | undefined;
  domCaption?: string | null | undefined;
  domCaptionVisible?: boolean | undefined;
  domCardVisible?: boolean | undefined;
  placement?: string | undefined;
  estimateS?: number | undefined;
}

interface Beat {
  id: string;
  page: "queue" | "detail" | "receipt";
  anchor: string;
  caption: string;
  avoid: readonly string[];
  prefer: readonly string[];
  /** Mid-beat caption swap. */
  caption2?: string;
  anchor2?: string;
  /** After an in-beat navigation, re-place the caption against this anchor on the new page. */
  postAnchor?: string;
  postPrefer?: readonly string[];
  /** Anchor to check at settle time when the original anchor is replaced during the action. */
  gateAnchor?: string;
}

// The beat table. `caption2`/`anchor2` is the mid-beat swap.
const BEATS: Beat[] = [
  { id: "1", page: "queue", anchor: "#row", caption: "One action waiting. $750 needs a person.", avoid: ["#review"], prefer: [], postAnchor: ".title-block", postPrefer: ["left-of-actions", "top-right"] },
  { id: "2", page: "detail", anchor: ".binding-card", caption: "The approval is bound to these exact facts.", avoid: [], prefer: ["left-of-actions", "top-right"] },
  { id: "3", page: "detail", anchor: ".amount-field", caption: "Change the amount…", avoid: [".amount-field"], prefer: ["left-of-actions", "top-right"], caption2: "…and the approval is invalidated.", anchor2: "#s-approval" },
  { id: "4", page: "detail", anchor: ".amount-field", caption: "Restore it. Same fingerprint.", avoid: [".amount-field"], prefer: ["left-of-actions", "top-right"] },
  { id: "5", page: "detail", anchor: "#approve", caption: "Approve the exact action.", avoid: ["#approve", "#view-receipt"], prefer: ["left-of-actions", "top-right"], caption2: "Executed once. Receipt signed. Anchor honestly pending.", anchor2: ".strip", gateAnchor: "#view-receipt" },
  { id: "6", page: "receipt", anchor: "aside.card", caption: "Your browser re-checks the receipt. Four checks pass.", avoid: [], prefer: [] },
  { id: "7", page: "receipt", anchor: "#toggle", caption: "Same receipt, one number changed after signing.", avoid: ["#toggle"], prefer: [], caption2: "Two checks fail, and say which.", anchor2: "#banner" },
  { id: "8", page: "receipt", anchor: "#cli", caption: "Same answer from the command line.", avoid: [], prefer: [] },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Overlay injected into every document during capture.
// ---------------------------------------------------------------------------
const OVERLAY = String.raw`(() => {
  const KEY = "onbehalf.capture";
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const write = (patch) => sessionStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
  const MARK = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M20 4.5A10.5 10.5 0 1 0 20 23.5" fill="none" stroke="#14161A" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="14" r="3.4" fill="#0f6e56"/></svg>';
  const CURSOR = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 3l14 9-6.2 1.2L16 20l-2.6 1.2-3.2-6.7L5 19z" fill="#fff" stroke="#14161A" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const MARGIN = 24, GAP = 24;

  function build() {
    if (document.getElementById("cap-caption")) return;
    const st = read();
    const style = document.createElement("style");
    style.textContent = [
      "#cap-caption{position:fixed;left:0;top:0;max-width:420px;padding:14px 18px;box-sizing:border-box;",
      "background:rgba(244,241,236,0.92);border:1px solid #DDD7CD;border-radius:10px;color:#14161A;",
      "font:500 20px/1.35 'Geist',system-ui,sans-serif;z-index:9999;pointer-events:none;opacity:0;",
      "view-transition-name:cap-caption;}",
      "#cap-cursor{position:fixed;left:0;top:0;width:24px;height:24px;z-index:10000;pointer-events:none;",
      "filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));view-transition-name:cap-cursor;will-change:transform;}",
      "#cap-card{position:fixed;inset:0;background:#F4F1EC;z-index:10001;display:none;flex-direction:column;",
      "align-items:center;justify-content:center;gap:22px;font-family:'Geist',system-ui,sans-serif;color:#14161A;opacity:0;}",
      "#cap-card .wm{display:flex;align-items:center;gap:18px;font-size:48px;font-weight:700;letter-spacing:-0.02em;}",
      "#cap-card .wm svg{width:64px;height:64px;}",
      "#cap-card .tag{font-size:22px;font-weight:400;color:#5B564F;}",
      "#cap-card[data-kind=close] .tag{font-size:28px;color:#14161A;font-weight:500;}",
      "::view-transition-group(cap-caption),::view-transition-group(cap-cursor){animation-duration:0s;}",
    ].join("");
    document.head.appendChild(style);

    const cap = document.createElement("div"); cap.id = "cap-caption";
    if (st.caption) { cap.textContent = st.caption; cap.style.opacity = "1"; }
    if (st.capRect) { cap.style.left = st.capRect.x + "px"; cap.style.top = st.capRect.y + "px"; cap.style.width = st.capRect.w + "px"; }

    const cursor = document.createElement("div"); cursor.id = "cap-cursor"; cursor.innerHTML = CURSOR;
    cursor.style.transform = "translate(" + (st.cx ?? 960) + "px," + (st.cy ?? 540) + "px)";
    cursor.style.opacity = st.cursorHidden ? "0" : "1";

    const card = document.createElement("div"); card.id = "cap-card";
    card.innerHTML = '<div class="wm">' + MARK + '<span>Onbehalf</span></div><div class="tag">Agents act on behalf. We prove who.</div>';
    if (st.card) { card.dataset.kind = st.card; card.style.display = "flex"; card.style.opacity = "1"; }

    document.body.append(cap, cursor, card);
  }

  const el = (id) => document.getElementById(id);
  const fade = (node, from, to, ms) => new Promise((res) => {
    const a = node.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: "ease-in-out", fill: "forwards" });
    a.onfinish = () => { node.style.opacity = String(to); a.cancel(); res(); };
  });
  const rectOf = (node) => { const r = node.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const q = (sel) => Array.from(document.querySelectorAll(sel)).filter((n) => n.getClientRects().length > 0);

  // Choose the largest empty region nearest the anchor that covers nothing it must not.
  // Preferred spots win when they are empty; otherwise a grid search where any overlap
  // with page content is penalised far more than distance from the anchor.
  function place(text, anchorSel, avoidSels, prefer) {
    const cap = el("cap-caption");
    cap.textContent = text;
    cap.style.left = "0px"; cap.style.top = "0px";
    const measure = (width) => { cap.style.width = width ? width + "px" : ""; const r = cap.getBoundingClientRect(); return { w: Math.min(420, r.width), h: r.height }; };
    const full = measure(null);
    const vw = window.innerWidth, vh = window.innerHeight;
    const anchor = rectOf(q(anchorSel)[0]);
    const avoid = avoidSels.flatMap((s) => q(s).map(rectOf));
    const hard = [anchor, ...avoid, ...q(".nav, .foot").map(rectOf)];
    const soft = q(".card, .strip, .title-block, .crumb, .empty-line, .reset, .btn, .chip, pre, .banner, .toggle, .page-title, .page-sub, .actions-note, .caption").map(rectOf);
    const main = q("main.container")[0] ? rectOf(q("main.container")[0]) : { x: 0, y: 0, w: vw, h: vh };
    const foot = q(".foot")[0] ? rectOf(q(".foot")[0]) : null;
    const nav = q(".nav")[0] ? rectOf(q(".nav")[0]) : null;
    const top = Math.max(MARGIN, nav ? nav.y + nav.h + 16 : MARGIN), bottom = Math.min(vh - MARGIN, foot ? foot.y - 16 : vh - MARGIN);
    const marginW = Math.max(200, Math.min(420, main.x - 2 * MARGIN));
    const evaluate = (c) => {
      c.x = Math.max(MARGIN, Math.min(vw - MARGIN - c.w, c.x));
      c.y = Math.max(top, Math.min(bottom - c.h, c.y));
      if (hard.some((r) => inter(c, r) > 0)) return null;
      const softArea = soft.reduce((s, r) => s + inter(c, r), 0);
      const dx = (c.x + c.w / 2) - (anchor.x + anchor.w / 2), dy = (c.y + c.h / 2) - (anchor.y + anchor.h / 2);
      const softAreaT = softArea <= 600 ? 0 : softArea;
      return { ...c, softArea: softAreaT, dist: Math.hypot(dx, dy), score: softAreaT * 50 + Math.hypot(dx, dy) };
    };
    let best = null;
    // 1. Preferred spots, in order, if empty.
    for (const p of prefer) {
      let c = null;
      if (p === "left-of-actions") { const a = q("#actions")[0]; const btn = q("#actions .btn")[0]; if (a && btn) { const r = rectOf(a), bx = rectOf(btn).x; c = { name: "left of footer buttons", x: bx - GAP - full.w, y: r.y + (r.h - full.h) / 2, w: full.w, h: full.h }; } }
      if (p === "top-right") { const t = q(".title-right")[0]; if (t) { const r = rectOf(t); c = { name: "top-right under status chip", x: r.x + r.w - full.w, y: r.y + r.h + 12, w: full.w, h: full.h }; } }
      const e = c && evaluate(c);
      if (e && e.softArea === 0) { best = e; break; }
    }
    // 2. Margins beside the content column, narrowed to fit.
    if (!best) {
      const m = measure(marginW);
      const cands = [
        { name: "right margin", x: main.x + main.w + MARGIN, y: anchor.y, w: m.w, h: m.h },
        { name: "left margin", x: MARGIN, y: anchor.y, w: m.w, h: m.h },
      ].map(evaluate).filter(Boolean);
      // 3. Grid search across the viewport at full width.
      const g = measure(null);
      for (let y = top; y <= bottom - g.h; y += 40) for (let x = MARGIN; x <= vw - MARGIN - g.w; x += 40) {
        const e = evaluate({ name: "grid", x, y, w: g.w, h: g.h }); if (e) cands.push(e);
      }
      cands.sort((p, q2) => p.score - q2.score);
      best = cands[0] || null;
      window.__capDebug = cands.slice(0, 4).map((c) => c.name + "@" + Math.round(c.x) + "," + Math.round(c.y) + " soft=" + Math.round(c.softArea) + " dist=" + Math.round(c.dist));
      if (best && best.name === "grid") {
        const cx = best.x + best.w / 2, cy = best.y + best.h / 2, ax = anchor.x + anchor.w / 2, ay = anchor.y + anchor.h / 2;
        best.name = Math.abs(cy - ay) > Math.abs(cx - ax) ? (cy > ay ? "below anchor" : "above anchor") : (cx > ax ? "right of anchor" : "left of anchor");
        if (best.softArea > 0) best.name += " (partly over content)";
      }
    }
    if (!best) best = { name: "fallback below anchor", x: anchor.x, y: Math.min(vh - full.h - MARGIN, anchor.y + anchor.h + GAP), w: full.w, h: full.h, softArea: 0 };
    cap.style.left = best.x + "px"; cap.style.top = best.y + "px"; cap.style.width = best.w + "px";
    write({ capRect: { x: best.x, y: best.y, w: best.w, h: best.h } });
    return { rect: { x: best.x, y: best.y, w: best.w, h: best.h }, anchor, avoid, placement: best.name, softArea: best.softArea, debug: window.__capDebug || [], main };
  }

  window.__cap = {
    place,
    captionIn: async (ms) => { const c = el("cap-caption"); write({ caption: c.textContent }); await fade(c, 0, 1, ms); },
    captionOut: async (ms) => { const c = el("cap-caption"); await fade(c, 1, 0, ms); c.textContent = ""; write({ caption: null, capRect: null }); },
    captionState: () => { const c = el("cap-caption"); return { text: c.textContent, visible: getComputedStyle(c).opacity === "1", rect: rectOf(c) }; },
    showCard: async (kind, ms) => { const card = el("cap-card"); card.dataset.kind = kind; card.style.display = "flex"; write({ card: kind }); await fade(card, 0, 1, ms); },
    hideCard: async (ms) => { const card = el("cap-card"); write({ card: null }); await fade(card, 1, 0, ms); card.style.display = "none"; },
    cardVisible: () => { const c = el("cap-card"); return c.style.display !== "none" && getComputedStyle(c).opacity === "1"; },
    moveCursor: (x, y, ms) => new Promise((res) => {
      const c = el("cap-cursor"); const st = read(); const x0 = st.cx ?? 960, y0 = st.cy ?? 540; const t0 = performance.now();
      const step = (now) => { const p = Math.min(1, (now - t0) / ms), e = ease(p);
        c.style.transform = "translate(" + (x0 + (x - x0) * e) + "px," + (y0 + (y - y0) * e) + "px)";
        if (p < 1) requestAnimationFrame(step); else { write({ cx: x, cy: y }); res(); } };
      requestAnimationFrame(step);
    }),
    press: () => new Promise((res) => { const c = el("cap-cursor").firstElementChild;
      const a = c.animate([{ transform: "scale(1)" }, { transform: "scale(0.9)" }, { transform: "scale(1)" }], { duration: 150, easing: "ease-in-out" }); a.onfinish = () => res(); }),
    hideCursor: async (ms) => { write({ cursorHidden: true }); await fade(el("cap-cursor"), 1, 0, ms); },
    /** True when no page animation has been running for 250 ms. Overlay animations are ignored. */
    settled: () => new Promise((res) => {
      const overlay = new Set(["cap-caption", "cap-cursor", "cap-card"]);
      const running = () => document.getAnimations().some((a) => { const t = a.effect && a.effect.target; const id = t && (t.id || (t.parentElement && t.parentElement.id));
        return a.playState === "running" && !overlay.has(id) && !(t && t.closest && t.closest("#cap-caption,#cap-cursor,#cap-card")); });
      let quiet = 0; const t0 = performance.now();
      const tick = () => { if (running()) quiet = 0; else quiet += 50; if (quiet >= 250 || performance.now() - t0 > 8000) res(quiet >= 250); else setTimeout(tick, 50); };
      tick();
    }),
    rects: (sels) => sels.map((s) => q(s).map(rectOf)),
    contentRects: () => q(".card, .strip, .title-block, .btn, pre, .banner, .toggle, .page-title, .page-sub, .actions-note").map(rectOf),
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();`;

// ---------------------------------------------------------------------------

async function waitForServer(url: string, tries = 50): Promise<void> {
  for (let i = 0; i < tries; i++) { try { if ((await fetch(url)).ok) return; } catch {} await sleep(100); }
  throw new Error("server did not start");
}
function ffmpeg(): string {
  for (const p of ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"]) if (spawnSync(p, ["-version"], { stdio: "ignore" }).status === 0) return p;
  throw new Error("ffmpeg not found");
}

type CapApi = Record<string, (...a: unknown[]) => Promise<unknown>>;

async function run(record: boolean): Promise<{ log: GateEntry[]; webm: string | null; total: number }> {
  const server = spawn(process.execPath, [resolve(ROOT, "scripts/serve.mjs"), "demo", String(PORT)], { stdio: "ignore" });
  const log: GateEntry[] = [];
  try {
    await waitForServer(`${BASE}/index.html`);
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      ...(record ? { recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } } } : {}),
    });
    await context.addInitScript(OVERLAY);
    const page = await context.newPage();
    const t0 = performance.now();
    const now = () => (performance.now() - t0) / 1000;
    const cap = (fn: string, ...args: unknown[]) => page.evaluate(({ fn, args }) => (window as unknown as { __cap: CapApi }).__cap[fn]!(...args), { fn, args });
    const settle = async (extra?: () => Promise<boolean>) => {
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      if (extra) { const t = performance.now(); while (!(await extra()) && performance.now() - t < 8000) await sleep(50); }
      await cap("settled");
    };
    const center = async (sel: string, dx = 0, dy = 0) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error(`no box ${sel}`); return { x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy }; };
    const glide = async (x: number, y: number, ms = 500) => { await Promise.all([cap("moveCursor", x, y, ms), page.mouse.move(x, y, { steps: Math.max(8, Math.round(ms / 40)) })]); };
    const click = async (x: number, y: number) => { await cap("press"); await page.mouse.click(x, y); };
    const wait = (ms: number) => sleep(ms); // the plan uses real waits so its estimate is the real runtime

    const gateAt = (entry: GateEntry) => { entry.t = now() + (PLAN ? 0 : 0.6); log.push(entry); };
    const captionShow = async (b: Beat, text: string, anchor: string, avoid: readonly string[], sub: string) => {
      const start = now();
      const p = (await cap("place", text, anchor, [...avoid], [...b.prefer])) as { rect: Rect; anchor: Rect; avoid: Rect[]; placement: string; debug: string[]; main: Rect };
      if (PLAN && process.env.CAP_DEBUG) console.error(`[${b.id}${sub}] main=${JSON.stringify(p.main)} anchor=${JSON.stringify(p.anchor)} chosen=${p.placement}@${Math.round(p.rect.x)},${Math.round(p.rect.y)} ${p.rect.w}x${p.rect.h} | ${p.debug.join(" | ")}`);
      await cap("captionIn", CAPTION_IN);
      return { start, placement: p.placement, rect: p.rect, anchorRect: p.anchor, avoidRects: p.avoid, sub };
    };
    const registerAndGate = async (b: Beat, shown: Awaited<ReturnType<typeof captionShow>>, caption: string, extraAvoid: readonly string[] = [], anchorOverride?: string) => {
      // Re-read boxes at settle time: the anchor or controls may have moved (button swap, scroll).
      const st = (await cap("captionState")) as { text: string; visible: boolean; rect: Rect };
      const [anchorRects, avoidRects, navFoot] = (await cap("rects", [anchorOverride ?? (shown.sub === "b" ? b.anchor2 ?? b.anchor : b.anchor), ...b.avoid, ...extraAvoid, ".nav, .foot"] as string[])) as Rect[][];
      const contentRects = (await cap("contentRects")) as Rect[];
      const beatId = `${b.id}${shown.sub}`;
      gateAt({ beat: beatId, kind: "page", caption, t: 0, captionRect: st.rect, anchorRect: anchorRects?.[0], avoidRects: [...(avoidRects ?? []), ...(navFoot ?? [])], contentRects, domCaption: st.text, domCaptionVisible: st.visible, placement: shown.placement });
      await wait(REGISTER);
    };
    const finishBeat = async () => { await cap("captionOut", CAPTION_OUT); };
    // For swap beats: log the first caption at its settle point (no extra wait; the swap follows).
    const gateFirst = async (b: Beat, shown: Awaited<ReturnType<typeof captionShow>>, caption: string) => {
      const st = (await cap("captionState")) as { text: string; visible: boolean; rect: Rect };
      const [anchorRects, avoidRects, navFoot] = (await cap("rects", [b.gateAnchor ?? b.anchor, ...b.avoid, ".nav, .foot"] as string[])) as Rect[][];
      const contentRects = (await cap("contentRects")) as Rect[];
      log.push({ beat: b.id, kind: "page", caption, t: now() - (PLAN ? 0 : 0.15), captionRect: st.rect, anchorRect: anchorRects?.[0], avoidRects: [...(avoidRects ?? []), ...(navFoot ?? [])], contentRects, domCaption: st.text, domCaptionVisible: st.visible, placement: shown.placement });
    };
    const estimate = (id: string, start: number) => { const e = log.find((l) => l.beat === id); if (e) e.estimateS = now() - start; };

    // Card A
    await page.goto(`${BASE}/index.html`, { waitUntil: "networkidle" });
    await settle();
    await page.evaluate(() => sessionStorage.setItem("onbehalf.capture", JSON.stringify({ cx: 960, cy: 620 })));
    const tA = now();
    await cap("showCard", "open", 0);
    log.push({ beat: "A", kind: "card", caption: null, t: now() + (PLAN ? 0 : 1.0), domCardVisible: (await cap("cardVisible")) as boolean, placement: "full frame", estimateS: 0 });
    await wait(CARD_OPEN);
    await cap("hideCard", CARD_FADE);
    await wait(CARD_FADE);
    log[log.length - 1]!.estimateS = now() - tA;

    // Beat 1: queue → Review
    let b: Beat = BEATS[0]!; let tb = now();
    let s = await captionShow(b, b.caption, b.anchor, b.avoid, "");
    await wait(READ);
    const review = await center("#review"); await glide(review.x, review.y, 500); await click(review.x, review.y);
    await page.waitForURL("**/action.html"); await settle();
    { const p = (await cap("place", b.caption, b.postAnchor!, [], [...(b.postPrefer ?? [])])) as { placement: string }; s.placement = p.placement + " (re-placed after navigation)"; await page.evaluate(() => { const c = document.getElementById("cap-caption")!; c.style.opacity = "1"; }); }
    await registerAndGate(b, s, b.caption, [], b.postAnchor); await finishBeat(); estimate("1", tb);

    // Beat 2: binding card → cursor to amount
    b = BEATS[1]!; tb = now();
    s = await captionShow(b, b.caption, b.anchor, b.avoid, "");
    await wait(READ);
    const amount = await center("#amount"); await glide(amount.x, amount.y, 600); await settle();
    await registerAndGate(b, s, b.caption); await finishBeat(); estimate("2", tb);

    // Beat 3: change amount → invalidated
    b = BEATS[2]!; tb = now();
    s = await captionShow(b, b.caption, b.anchor, b.avoid, "");
    await wait(READ);
    await click(amount.x, amount.y); await page.keyboard.press("Meta+A"); await page.keyboard.type("950.00", { delay: 80 });
    await glide(300, 600, 400); await click(300, 600);
    await settle(async () => page.locator("#header-chip[data-tone=red]").count().then((n) => n > 0));
    await gateFirst(b, s, b.caption);
    await finishBeat();
    let s2 = await captionShow(b, b.caption2!, b.anchor2!, b.avoid, "b");
    await registerAndGate(b, s2, b.caption2!); await finishBeat(); estimate("3", tb);

    // Beat 4: restore
    b = BEATS[3]!; tb = now();
    s = await captionShow(b, b.caption, b.anchor, b.avoid, "");
    await wait(READ);
    await glide(amount.x, amount.y, 400); await click(amount.x, amount.y); await page.keyboard.press("Meta+A"); await page.keyboard.type("750.00", { delay: 80 });
    await glide(300, 600, 400); await click(300, 600);
    await settle(async () => page.locator("#header-chip[data-tone=amber]").count().then((n) => n > 0));
    await registerAndGate(b, s, b.caption); await finishBeat(); estimate("4", tb);

    // Beat 5: approve → sequence
    b = BEATS[4]!; tb = now();
    s = await captionShow(b, b.caption, b.anchor, b.avoid, "");
    await wait(READ);
    const approve = await center("#approve"); await glide(approve.x, approve.y, 550); await click(approve.x, approve.y);
    await glide(300, 900, 400); // park in the empty left margin so the swap and caption stay clear
    await settle(async () => page.locator("#view-receipt").isVisible());
    await gateFirst(b, s, b.caption);
    await finishBeat();
    s2 = await captionShow(b, b.caption2!, b.anchor2!, b.avoid, "b");
    await registerAndGate(b, s2, b.caption2!); await finishBeat(); estimate("5", tb);

    // Beat 6: view receipt → drift down PASS lines
    b = BEATS[5]!; tb = now();
    const view = await center("#view-receipt"); await glide(view.x, view.y, 500); await click(view.x, view.y);
    await page.waitForURL("**/receipt.html"); await settle(async () => page.locator('.check[data-name="Issuer"][data-status="PASS"]').count().then((n) => n > 0));
    s = await captionShow(b, b.caption, b.anchor, b.avoid, "");
    await wait(READ);
    const schema = await center('.check[data-name="Schema"] .status', 40, 0); const issuer = await center('.check[data-name="Issuer"] .status', 40, 0);
    await glide(schema.x, schema.y, 500); await glide(issuer.x, issuer.y, 1600); await settle();
    await registerAndGate(b, s, b.caption); await finishBeat(); estimate("6", tb);

    // Beat 7: tamper → invalid
    b = BEATS[6]!; tb = now();
    s = await captionShow(b, b.caption, b.anchor, b.avoid, "");
    await wait(READ);
    const toggle = await center("#toggle"); await glide(toggle.x, toggle.y, 500); await click(toggle.x, toggle.y);
    await settle(async () => page.locator("#banner[data-tone=red]").count().then((n) => n > 0));
    const banner = await center("#banner", -150, 0); await glide(banner.x, banner.y, 500);
    await gateFirst(b, s, b.caption);
    await finishBeat();
    s2 = await captionShow(b, b.caption2!, b.anchor2!, b.avoid, "b");
    await registerAndGate(b, s2, b.caption2!); await finishBeat(); estimate("7", tb);

    // Beat 8: scroll to the CLI card
    b = BEATS[7]!; tb = now();
    await page.evaluate(() => { const pre = document.getElementById("cli")!; const bottom = pre.getBoundingClientRect().bottom; window.scrollBy({ top: Math.max(0, bottom - (window.innerHeight - 40)), behavior: "smooth" }); });
    await sleep(700); await settle();
    s = await captionShow(b, b.caption, b.anchor, b.avoid, "");
    await wait(READ);
    const cli = await center("#cli", -200, -40); await glide(cli.x, cli.y, 500); await settle();
    await registerAndGate(b, s, b.caption); await finishBeat(); estimate("8", tb);

    // Card 9
    const t9 = now();
    await Promise.all([glide(1960, 700, 500)]); await cap("hideCursor", 100);
    await cap("showCard", "close", CARD_FADE); await wait(CARD_FADE);
    log.push({ beat: "9", kind: "card", caption: null, t: now() + (PLAN ? 0 : 1.5), domCardVisible: (await cap("cardVisible")) as boolean, placement: "full frame", estimateS: 0 });
    await wait(CARD_CLOSE);
    log[log.length - 1]!.estimateS = now() - t9;

    const total = now();
    const videoPath = record ? await page.video()?.path() : null;
    await context.close(); await browser.close();
    return { log, webm: videoPath ?? null, total };
  } finally {
    server.kill();
  }
}

// ---------------------------------------------------------------------------
// Render gate: pixel checks on frames pulled from the mp4 + DOM checks.
// ---------------------------------------------------------------------------
function rawFrame(ff: string, mp4: string, t: number, crop?: Rect): Uint8Array {
  const vf = crop ? ["-vf", `crop=${Math.round(crop.w)}:${Math.round(crop.h)}:${Math.round(crop.x)}:${Math.round(crop.y)}`] : [];
  const r = spawnSync(ff, ["-loglevel", "error", "-ss", t.toFixed(2), "-i", mp4, "-frames:v", "1", ...vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg frame failed at ${t}`);
  return new Uint8Array(r.stdout);
}
function stats(px: Uint8Array): { light: number; dark: number } {
  let light = 0, dark = 0; const n = px.length / 3;
  for (let i = 0; i < px.length; i += 3) { const r = px[i]!, g = px[i + 1]!, b = px[i + 2]!; if (r > 225 && g > 220 && b > 210) light++; if (r < 90 && g < 90 && b < 90) dark++; }
  return { light: light / n, dark: dark / n };
}
const overlaps = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;

function gate(mp4: string, log: GateEntry[]): boolean {
  const ff = ffmpeg();
  mkdirSync(FRAMES, { recursive: true });
  const expected = new Map<string, string>();
  for (const b of BEATS) { expected.set(b.id, b.caption); if (b.caption2) expected.set(`${b.id}b`, b.caption2); }
  let ok = true;
  const rows: string[] = [];
  const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));
  rows.push(`${pad("beat", 5)} ${pad("t", 6)} ${pad("caption in frame", 16)} ${pad("text matches", 12)} ${pad("no overlap", 10)} ${pad("clear", 8)} ${pad("card", 6)} placement`);
  for (const e of log) {
    spawnSync(ff, ["-loglevel", "error", "-y", "-ss", e.t.toFixed(2), "-i", mp4, "-frames:v", "1", resolve(FRAMES, `beat-${e.beat}.png`)], { stdio: "ignore" });
    let inFrame = "-", text = "-", noOverlap = "-", card = "-", clear = "-";
    if (e.kind === "card") {
      const full = stats(rawFrame(ff, mp4, e.t));
      const centre = stats(rawFrame(ff, mp4, e.t, { x: 720, y: 440, w: 480, h: 200 }));
      const pass = full.light > 0.9 && centre.dark > 0.01 && e.domCardVisible === true;
      card = pass ? "PASS" : `FAIL(light ${full.light.toFixed(2)}, dark ${centre.dark.toFixed(3)})`;
      ok = ok && pass;
    } else {
      const r = e.captionRect!;
      const s = stats(rawFrame(ff, mp4, e.t, r));
      const present = s.light > 0.5 && s.dark > 0.004 && s.dark < 0.4 && e.domCaptionVisible === true;
      inFrame = present ? "PASS" : `FAIL(light ${s.light.toFixed(2)}, dark ${s.dark.toFixed(3)})`;
      const want = expected.get(e.beat); const match = e.domCaption === want && e.caption === want;
      text = match ? "PASS" : `FAIL(${JSON.stringify(e.domCaption)})`;
      const hits = [e.anchorRect, ...(e.avoidRects ?? [])].filter((x): x is Rect => !!x).filter((x) => overlaps(r, x));
      noOverlap = !e.anchorRect ? "FAIL(no anchor)" : hits.length === 0 ? "PASS" : `FAIL(${hits.length})`;
      const covers = (e.contentRects ?? []).filter((x) => overlaps(r, x));
      clear = covers.length === 0 ? "PASS" : `FAIL(${covers.length})`;
      const words = (want ?? "").trim().split(/\s+/).length; if (words > 10) { text = `FAIL(${words} words)`; }
      ok = ok && present && match && !!e.anchorRect && hits.length === 0 && covers.length === 0 && words <= 10;
    }
    rows.push(`${pad(e.beat, 5)} ${pad(mmss(e.t), 6)} ${pad(inFrame, 16)} ${pad(text, 12)} ${pad(noOverlap, 10)} ${pad(clear, 8)} ${pad(card, 6)} ${e.placement ?? ""}`);
  }
  console.log(rows.join("\n"));
  console.log(ok ? "Gate     PASS" : "Gate     FAIL");
  return ok;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const mp4 = resolve(OUT, "onbehalf-demo.mp4");
  const logPath = resolve(OUT, "gate-log.json");

  if (GATE_ONLY) {
    const log = JSON.parse(readFileSync(logPath, "utf8")) as GateEntry[];
    process.exit(gate(mp4, log) ? 0 : 1);
  }

  if (PLAN) {
    const { log, total } = await run(false);
    const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));
    console.log(`${pad("beat", 5)} ${pad("caption", 58)} ${pad("placement", 30)} est s`);
    let sum = 0;
    for (const e of log) {
      const est = e.estimateS ?? 0; if (!e.beat.endsWith("b")) sum += est;
      console.log(`${pad(e.beat, 5)} ${pad(e.caption ?? "(card)", 58)} ${pad(e.placement ?? "", 30)} ${e.beat.endsWith("b") ? "" : est.toFixed(1)}`);
    }
    console.log(`\nMeasured runtime (dry run with real pacing): ${total.toFixed(0)} s (target 80–95 s)`);
    return;
  }

  rmSync(FRAMES, { recursive: true, force: true });
  const { log, webm, total } = await run(true);
  if (!webm) throw new Error("no video recorded");
  const out = resolve(OUT, "onbehalf-demo.webm");
  renameSync(webm, out);
  const ff = ffmpeg();
  const r = spawnSync(ff, ["-y", "-loglevel", "error", "-i", out, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", mp4], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg mp4 export failed");
  writeFileSync(logPath, JSON.stringify(log, null, 2));
  const ts = log.map((e) => `${mmss(e.t - (e.kind === "card" ? 0 : 0.6))} ${e.beat} ${e.caption ?? "(card)"}`).join("\n");
  writeFileSync(resolve(OUT, "onbehalf-demo-timestamps.txt"), `${ts}\n${mmss(total)} end\n`);
  console.log(`video      ${mp4}  (${mmss(total)})`);
  console.log(`timestamps ${resolve(OUT, "onbehalf-demo-timestamps.txt")}`);
  console.log("");
  const pass = gate(mp4, log);
  if (!pass) { console.error("Render gate failed; video not delivered."); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });

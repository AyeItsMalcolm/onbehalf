/**
 * pnpm stills
 *
 * 1920×1080 stills of every page state, for design review:
 *   queue, queue (rejected), receipt (genuine), receipt (tampered, mid-sweep
 *   and settled). Also records receipt-tamper.webm, the closing shot.
 * Starts its own static server on port 4175 and stops it afterwards.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const PORT = 4175;
const OUT = resolve(ROOT, "demo/captures");

async function waitForServer(url: string, tries = 50): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [resolve(ROOT, "scripts/serve.mjs"), "demo", String(PORT)], { stdio: "ignore" });
  try {
    await waitForServer(`http://localhost:${PORT}/index.html`);
    const browser = await chromium.launch();
    const base = `http://localhost:${PORT}`;

    // Stills without video.
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    const still = (name: string) => page.screenshot({ path: resolve(OUT, `${name}.png`) });

    await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await still("10-queue");

    await page.goto(`${base}/index.html?rejected=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await still("11-queue-rejected");

    await page.goto(`${base}/receipt.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    await still("12-receipt-valid");
    await page.locator("#toggle").click();
    await page.waitForTimeout(450);
    await still("13-receipt-tamper-mid");
    await page.waitForTimeout(1200);
    await still("14-receipt-invalid");
    await page.locator("#toggle").click();
    await page.waitForTimeout(1600);
    await still("15-receipt-restored");
    await ctx.close();

    // The closing shot, recorded.
    const vctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
    });
    const vpage = await vctx.newPage();
    await vpage.goto(`${base}/receipt.html`, { waitUntil: "networkidle" });
    await vpage.waitForTimeout(2500);
    await vpage.locator("#toggle").click();
    await vpage.waitForTimeout(3000);
    const videoPath = await vpage.video()?.path();
    await vctx.close();
    await browser.close();
    if (videoPath) renameSync(videoPath, resolve(OUT, "receipt-tamper.webm"));

    for (const f of readdirSync(OUT).sort()) console.log(`demo/captures/${f}`);
  } finally {
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * pnpm capture [page]
 *
 * Records a ~10 second 1920×1080 capture of the action-detail choreography:
 * load reveal → edit amount (live binding, invalidation) → restore → approve
 * sequence. Writes demo/captures/action-detail.webm plus PNG stills at the
 * key beats so the feel can be judged frame by frame.
 *
 * Starts its own static server on port 4174 and stops it afterwards.
 */
import { spawn } from "node:child_process";
import { mkdirSync, renameSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const PORT = 4174;
const OUT = resolve(ROOT, "demo/captures");

async function waitForServer(url: string, tries = 50): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [resolve(ROOT, "scripts/serve.mjs"), "demo", String(PORT)], { stdio: "ignore" });
  try {
    await waitForServer(`http://localhost:${PORT}/action.html`);

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
    });
    const page = await context.newPage();
    const still = (name: string) => page.screenshot({ path: resolve(OUT, `${name}.png`) });

    await page.goto(`http://localhost:${PORT}/action.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1400); // load reveal + fonts
    await still("01-loaded");

    // Moment 2: live binding. Type a new amount slowly so the scramble is visible.
    const amount = page.locator("#amount");
    await amount.click();
    await page.keyboard.press("Meta+A");
    await page.keyboard.type("950.00", { delay: 90 });
    await page.waitForTimeout(900);
    await still("02-invalidated");

    // Restore the approved amount.
    await page.keyboard.press("Meta+A");
    await page.keyboard.type("750.00", { delay: 60 });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(900);
    await still("03-restored");

    // Moment 1: approve.
    await page.locator("#approve").click();
    await page.waitForTimeout(1300);
    await still("04-executing");
    await page.waitForTimeout(1500);
    await still("05-signed");
    await page.waitForTimeout(1400);
    await still("06-anchor-pending");
    await page.waitForTimeout(1000);
    await still("07-view-receipt");

    const videoPath = await page.video()?.path();
    await context.close();
    await browser.close();

    if (videoPath) {
      const target = resolve(OUT, "action-detail.webm");
      renameSync(videoPath, target);
      console.log(`video   ${target}`);
    }
    for (const f of readdirSync(OUT).filter((f) => f.endsWith(".png")).sort()) console.log(`still   demo/captures/${f}`);
  } finally {
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

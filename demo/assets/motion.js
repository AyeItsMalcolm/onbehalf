// Onbehalf demo — motion helpers. WAAPI only; transform and opacity only.
// Every helper returns a Promise that resolves when its motion finishes.
// See docs/MOTION_PLAN.md for the timings these implement.

export const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
export const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";

export const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Scale a duration by the user's motion preference. */
const d = (ms) => (reduced() ? 0 : ms);

export const sleep = (ms) => new Promise((r) => setTimeout(r, d(ms)));

function finished(animation) {
  return animation.finished.catch(() => undefined);
}

/** Once, on load: children enter 30 ms apart, 6 px up, fade in, 220 ms. */
export async function revealAll(root = document, step = 30) {
  const els = Array.from(root.querySelectorAll("[data-reveal]"));
  const anims = els.map((el, i) => {
    el.classList.add("revealed");
    return el.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: d(220), delay: d(i * step), easing: EASE_OUT, fill: "backwards" },
    );
  });
  await Promise.all(anims.map(finished));
}

/** 120 ms press: scale to 0.97 and back. */
export async function press(el) {
  await finished(
    el.animate([{ transform: "scale(1)" }, { transform: "scale(0.97)" }, { transform: "scale(1)" }], {
      duration: d(120),
      easing: "ease-in-out",
    }),
  );
}

/**
 * Chip morph: dot cross-fades to the new tone while the text slides up-out
 * and the new text slides up-in. 200 ms.
 */
export async function morphChip(chip, { tone, text }) {
  const dot = chip.querySelector(".dot");
  const textEl = chip.querySelector(".chip-text");
  const oldTone = chip.dataset.tone;
  const oldText = textEl.textContent;
  if (oldTone === tone && oldText === text) return;

  const anims = [];

  if (oldTone !== tone) {
    const ghost = document.createElement("span");
    ghost.className = "ghost";
    ghost.style.background = getComputedStyle(dot).backgroundColor;
    dot.appendChild(ghost);
    chip.dataset.tone = tone;
    anims.push(
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d(200), easing: EASE_IN }).finished.then(() => ghost.remove()),
    );
  }

  if (oldText !== text) {
    const ghost = document.createElement("span");
    ghost.className = "ghost";
    ghost.textContent = oldText;
    // Keep the ghost's color from the old tone.
    ghost.style.color = getComputedStyle(textEl).color;
    textEl.textContent = text;
    textEl.appendChild(ghost);
    anims.push(
      ghost
        .animate(
          [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: "translateY(-8px)" },
          ],
          { duration: d(200), easing: EASE_IN },
        )
        .finished.then(() => ghost.remove()),
    );
    // The new text: animate the element itself (ghost is absolutely positioned inside it).
    const wrapper = document.createElement("span");
    wrapper.style.display = "inline-block";
    wrapper.textContent = text;
    textEl.textContent = "";
    textEl.appendChild(wrapper);
    textEl.appendChild(ghost);
    anims.push(
      finished(
        wrapper.animate(
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: d(200), easing: EASE_OUT },
        ),
      ).then(() => {
        if (textEl.contains(wrapper)) {
          textEl.textContent = text;
        }
      }),
    );
  }

  await Promise.all(anims.map((p) => p.catch(() => undefined)));
}

/** 2 px horizontal shake, 3 cycles, 240 ms. */
export async function shake(el) {
  await finished(
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(2px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(2px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: d(240), easing: "ease-in-out" },
    ),
  );
}

/** Soft pulse, at most two cycles, removed when the state resolves. */
export function pulse(el) {
  el.classList.add("pulse");
  return () => el.classList.remove("pulse");
}

const HEX = "0123456789abcdef";

/**
 * Scramble a hex string into a new value, character by character, left to
 * right. prefixLen characters (for example "sha256:") stay still. ≈350 ms.
 */
export function scrambleHex(el, next, prefixLen = 0) {
  if (reduced()) {
    el.textContent = next;
    return Promise.resolve();
  }
  const prefix = next.slice(0, prefixLen);
  const from = el.textContent.slice(prefixLen).padEnd(next.length - prefixLen, " ");
  const to = next.slice(prefixLen);
  const perChar = 4; // ms between character start times
  const settle = 120; // ms each character spends scrambling
  const start = performance.now();
  return new Promise((resolve) => {
    let lastTick = 0;
    function frame(now) {
      const t = now - start;
      let out = "";
      let done = true;
      const tick = Math.floor(t / 30);
      for (let i = 0; i < to.length; i++) {
        const s = i * perChar;
        if (t < s) {
          out += from[i] ?? " ";
          done = false;
        } else if (t < s + settle) {
          out += HEX[(Math.imul(i + 1, tick + 7) + i * 13) & 15];
          done = false;
        } else {
          out += to[i];
        }
      }
      if (tick !== lastTick || done) {
        el.textContent = prefix + out;
        lastTick = tick;
      }
      if (done) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

/** Fade + 6 px rise in, 220 ms. Element should start hidden via inline style or class. */
export async function fadeIn(el, { rise = 6, duration = 220 } = {}) {
  el.hidden = false;
  el.style.opacity = "";
  await finished(
    el.animate(
      [
        { opacity: 0, transform: `translateY(${rise}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: d(duration), easing: EASE_OUT, fill: "backwards" },
    ),
  );
}

/** Fade out, 160 ms, then hide. */
export async function fadeOut(el, { duration = 160 } = {}) {
  await finished(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d(duration), easing: EASE_IN, fill: "forwards" }));
  el.hidden = true;
}

/** Slide a banner: old content down-out, new content down-in, 350 ms. */
export async function slideSwap(el, apply) {
  const out = finished(
    el.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(8px)" },
      ],
      { duration: d(150), easing: EASE_IN, fill: "forwards" },
    ),
  );
  await out;
  apply();
  await finished(
    el.animate(
      [
        { opacity: 0, transform: "translateY(-8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: d(200), easing: EASE_OUT, fill: "forwards" },
    ),
  );
  el.getAnimations().forEach((a) => a.cancel());
}

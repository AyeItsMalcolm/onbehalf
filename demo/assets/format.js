// Onbehalf demo — formatting helpers shared by the pages.

export function money(minor, currency = "usd") {
  const dollars = (minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${dollars} ${currency.toUpperCase()}`;
}

/** Middle-ellipsize an id or hash, keeping a prefix like "sha256:" or "pi_". */
export function ellipsize(value, head = 10, tail = 6) {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function utc(iso) {
  return iso.replace("T", " ").replace("Z", " UTC");
}

export function mmss(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** The inline SVG mark: an open bracket/arc in ink with a solid green dot offset inside. */
export const MARK_SVG = `<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
  <path d="M20 4.5A10.5 10.5 0 1 0 20 23.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="16" cy="14" r="3.4" fill="#0f6e56"/>
</svg>`;

export function renderNav(active, data) {
  const links = ["Approvals", "Actions", "Receipts", "Verifier"]
    .map((l) => `<a href="#" ${l === active ? 'aria-current="page"' : ""}>${l}</a>`)
    .join("");
  return `<div class="container">
    <a class="wordmark" href="index.html">${MARK_SVG}<span>Onbehalf</span></a>
    <div class="nav-right">
      <nav class="nav-links" aria-label="Primary">${links}</nav>
      <span class="badge">${data.environmentBadge}</span>
    </div>
  </div>`;
}

export function renderFooter() {
  return `<div class="container">
    <span class="caption">Prototype screens. Receipt, anchor, and verifier are live — see repository.</span>
    <span class="caption">Agents act on behalf. We prove who.</span>
  </div>`;
}

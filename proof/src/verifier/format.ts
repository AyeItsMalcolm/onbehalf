/** Plain-text rendering of a verification report, shared by the CLI and the demo build. */
import type { Check, VerificationReport } from "./core.js";

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

export function formatCheck(c: Check): string {
  const head = `${pad(c.name, 10)} ${pad(c.status, 8)} ${c.reason}`;
  if (!c.lines || c.lines.length === 0) return head;
  return [head, ...c.lines.map((l) => `${" ".repeat(19)}${l}`)].join("\n");
}

export function formatReport(report: VerificationReport): string {
  return [...report.checks.map(formatCheck), "", `${pad("Result", 10)} ${report.result}  ${report.summary}`].join("\n");
}

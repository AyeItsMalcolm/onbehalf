import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReceiptCore, ReceiptPackage } from "../src/receipt.js";
import type { VerifierConfig, VerificationReport, CheckName, CheckStatus } from "../src/verifier/core.js";

const ROOT = resolve(import.meta.dirname, "../..");

export function loadPackage(): ReceiptPackage {
  return JSON.parse(readFileSync(resolve(ROOT, "out/receipt.s2.package.json"), "utf8")) as ReceiptPackage;
}

export function loadFixtureCore(): ReceiptCore {
  return JSON.parse(readFileSync(resolve(ROOT, "fixtures/receipt.s2.json"), "utf8")) as ReceiptCore;
}

export function loadConfig(): VerifierConfig {
  return JSON.parse(readFileSync(resolve(ROOT, "proof/verifier.config.json"), "utf8")) as VerifierConfig;
}

export function loadVector(): { canonical: string; digest: string; byteLength: number } {
  return JSON.parse(readFileSync(resolve(ROOT, "proof/test/vectors/receipt.s2.vector.json"), "utf8"));
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

export function status(report: VerificationReport, name: CheckName): CheckStatus {
  const c = report.checks.find((x) => x.name === name);
  if (!c) throw new Error(`no check ${name}`);
  return c.status;
}

export function statuses(report: VerificationReport): Record<CheckName, CheckStatus> {
  return Object.fromEntries(report.checks.map((c) => [c.name, c.status])) as Record<CheckName, CheckStatus>;
}

/** Every leaf path in an object, as arrays of keys. Arrays count as leaves. */
export function leafPaths(value: unknown, prefix: string[] = []): string[][] {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, [...prefix, k]));
  }
  return [prefix];
}

export function getAt(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], obj);
}

export function setAt(obj: unknown, path: string[], value: unknown): void {
  const parent = getAt(obj, path.slice(0, -1)) as Record<string, unknown>;
  parent[path[path.length - 1]!] = value;
}

/** A minimal, type-preserving mutation that must break the signature. */
export function mutate(value: unknown): unknown {
  if (typeof value === "string") return `${value}x`;
  if (typeof value === "number") return value + 1;
  if (typeof value === "boolean") return !value;
  if (Array.isArray(value)) return [...value, "extra"];
  if (value === null) return "not-null";
  throw new Error(`cannot mutate ${typeof value}`);
}

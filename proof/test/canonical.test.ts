/**
 * Canonicalization vector stability.
 *
 * Regenerate the vector ONLY when fixtures/receipt.s2.json changes on purpose:
 *   node -e 'const fs=require("fs");const c=fs.readFileSync("out/receipt.s2.canonical.json","utf8");
 *   const p=JSON.parse(fs.readFileSync("out/receipt.s2.package.json","utf8"));
 *   fs.writeFileSync("proof/test/vectors/receipt.s2.vector.json",JSON.stringify({canonical:c,
 *   digest:p.cryptographicProof.digest,byteLength:Buffer.byteLength(c)},null,2)+"\n")'
 */
import { describe, expect, it } from "vitest";
import { canonicalBytes, canonicalString, digestHex } from "../src/canonical.js";
import { clone, loadFixtureCore, loadPackage, loadVector } from "./helpers.js";

describe("RFC 8785 canonicalization", () => {
  it("fixture core canonicalizes to the committed vector, byte for byte", () => {
    const core = loadFixtureCore();
    const vector = loadVector();
    const canonical = canonicalString(core as never);
    expect(canonical).toBe(vector.canonical);
    expect(new TextEncoder().encode(canonical).length).toBe(vector.byteLength);
    expect(digestHex(canonicalBytes(core as never))).toBe(vector.digest);
  });

  it("the packaged receiptCore produces the packaged digest", () => {
    const pkg = loadPackage();
    expect(digestHex(canonicalBytes(pkg.receiptCore as never))).toBe(pkg.cryptographicProof.digest);
  });

  it("key order and whitespace do not change the canonical bytes", () => {
    const core = loadFixtureCore();
    // Rebuild with reversed key order at every level.
    const reverse = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(reverse);
      if (typeof v === "object" && v !== null) {
        return Object.fromEntries(
          Object.entries(v)
            .reverse()
            .map(([k, x]) => [k, reverse(x)]),
        );
      }
      return v;
    };
    const reordered = reverse(clone(core));
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(core));
    expect(canonicalString(reordered as never)).toBe(canonicalString(core as never));
  });

  it("is stable across repeated runs", () => {
    const core = loadFixtureCore();
    const a = canonicalString(core as never);
    const b = canonicalString(clone(core) as never);
    expect(a).toBe(b);
  });

  it("matches the RFC 8785 section 3.2.3 example", () => {
    // Built with char codes so no escape sequence can be mangled by tooling.
    // Value: euro, $, U+000F, LF, A, ', B, ", backslash, backslash, ", /
    const rfcString = String.fromCharCode(0x20ac, 0x24, 0x0f, 0x0a, 0x41, 0x27, 0x42, 0x22, 0x5c, 0x5c, 0x22, 0x2f);
    const input = {
      numbers: [333333333.33333329, 1e30, 4.5, 0.002, 1e-27],
      string: rfcString,
      literals: [null, true, false],
    };
    const BS = String.fromCharCode(0x5c);
    const Q = String.fromCharCode(0x22);
    const expectedString =
      String.fromCharCode(0x20ac) + "$" + BS + "u000f" + BS + "n" + "A'B" + BS + Q + BS + BS + BS + BS + BS + Q + "/";
    const expected =
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"' +
      expectedString +
      '"}';
    expect(canonicalString(input as never)).toBe(expected);
  });
});

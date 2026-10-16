import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * WCAG 2.2 AA guard for the colour tokens. When the real Think Digital
 * palette replaces the provisional ramps, this test says immediately which
 * role pairs need adjusting.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles/tokens/color.css", import.meta.url)), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`selector ${selector} not found`);
  const body = css.slice(start, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const root = block(":root");

function resolve(name: string, scope: Record<string, string>): string {
  let value = scope[name] ?? root[name];
  for (let i = 0; i < 10 && value?.startsWith("var("); i++) {
    const ref = value.slice(4, -1).trim();
    value = scope[ref] ?? root[ref];
  }
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} does not resolve to a hex colour (got ${value})`);
  return value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3; // non-text: borders of inputs, focus indicators, large text

const scopes: [string, Record<string, string>][] = [
  [":root", {}],
  [".surface-inverse", block(".surface-inverse")],
];

describe("color token contrast (WCAG 2.2 AA)", () => {
  for (const [label, scope] of scopes) {
    describe(label, () => {
      const pairs: [string, string, number][] = [
        ["--fg", "--bg", TEXT],
        ["--fg", "--bg-elevated", TEXT],
        ["--fg", "--bg-sunken", TEXT],
        ["--fg-muted", "--bg", TEXT],
        ["--fg-muted", "--bg-elevated", TEXT],
        ["--fg-muted", "--bg-sunken", TEXT],
        ["--accent-text", "--bg", TEXT],
        ["--accent-text", "--bg-elevated", TEXT],
        ["--tech-text", "--bg", TEXT],
        ["--success", "--bg", TEXT],
        ["--danger", "--bg", TEXT],
        ["--warning", "--bg", TEXT],
        ["--info", "--bg", TEXT],
        ["--inverse-fg", "--inverse-bg", TEXT],
        ["--focus-color", "--bg", UI],
        ["--border-strong", "--bg-elevated", UI],
      ];
      for (const [fg, bg, min] of pairs) {
        it(`${fg} on ${bg} ≥ ${min}:1`, () => {
          expect(contrast(resolve(fg, scope), resolve(bg, scope))).toBeGreaterThanOrEqual(min);
        });
      }
    });
  }

  it("button fills keep text readable", () => {
    expect(contrast(resolve("--primary-fg", {}), resolve("--primary", {}))).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(resolve("--primary-fg", {}), resolve("--primary-hover", {}))).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(resolve("--tech-fg", {}), resolve("--tech", {}))).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(resolve("--tech-fg", {}), resolve("--tech-hover", {}))).toBeGreaterThanOrEqual(TEXT);
  });

  it("brand surface keeps text readable", () => {
    const brand = block(".surface-brand");
    expect(contrast(resolve("--fg", brand), resolve("--bg", brand))).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(resolve("--fg-muted", brand), resolve("--bg", brand))).toBeGreaterThanOrEqual(TEXT);
  });
});

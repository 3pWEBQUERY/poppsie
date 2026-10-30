#!/usr/bin/env node
/**
 * Projektregeln prüfen:
 *  1. Keine Datei mit mehr als 700 Zeilen (Lockfile und generierte Drizzle-Snapshots ausgenommen).
 *  2. Keine Verläufe (gradient) und keine Schatten (shadow-*, box-shadow, drop-shadow, text-shadow).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAX = 700;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".uploads", "meta"]);
const SKIP_FILES = new Set(["package-lock.json"]);
const CODE = /\.(ts|tsx|js|mjs|cjs|css|sql|json|md)$/;
const STYLE = /\.(ts|tsx|css)$/;
const FORBIDDEN = [
  /gradient/i,
  /\bshadow-(?!none\b)[a-z0-9[\]-]+/,
  /box-shadow\s*:/,
  /text-shadow\s*:/,
  /drop-shadow(?!-(xs|sm|md|lg|xl|2xl):\s*none)/,
];
// Die Regel-Definitionen selbst (Theme setzt Schatten auf none) sind erlaubt.
const ALLOW = [/--(shadow|drop-shadow|text-shadow)-[a-z0-9]+:\s*none;/, /^\s*--shadow:\s*none;/, /\* Design-Regeln/, /keine Schatten/i, /Keine Schatten/];

const errors = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (CODE.test(name)) check(full);
  }
}
function check(file) {
  const rel = path.relative(ROOT, file);
  if (rel.startsWith("scripts/check-rules")) return;
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  if (lines.length > MAX) errors.push(`${rel}: ${lines.length} Zeilen (max. ${MAX})`);
  if (!STYLE.test(file)) return;
  lines.forEach((line, i) => {
    if (ALLOW.some((a) => a.test(line))) return;
    for (const re of FORBIDDEN) if (re.test(line)) errors.push(`${rel}:${i + 1}: verbotener Stil (${re.source}) → ${line.trim().slice(0, 100)}`);
  });
}
walk(ROOT);
if (errors.length) {
  console.error(`Regelverstösse (${errors.length}):\n` + errors.join("\n"));
  process.exit(1);
}
console.log("Regeln eingehalten: keine Datei > 700 Zeilen, keine Verläufe, keine Schatten.");

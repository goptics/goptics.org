#!/usr/bin/env node
/**
 * Render scripts/og-image.html → assets/og-image.png (1200×630).
 *
 * Requires Google Chrome or Chromium on PATH.
 * Usage: node scripts/render-og.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "scripts", "og-image.html");
const outPath = join(root, "assets", "og-image.png");
const fileUrl = pathToFileURL(htmlPath).href;

const chromeCandidates = [
  process.env.CHROME_PATH,
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
].filter(Boolean);

function findChrome() {
  for (const bin of chromeCandidates) {
    if (bin.includes("/") && existsSync(bin)) return bin;
    const check = spawnSync("which", [bin], { encoding: "utf8" });
    if (check.status === 0) return check.stdout.trim();
  }
  return null;
}

const chrome = findChrome();
if (!chrome) {
  console.error("Could not find Chrome/Chromium. Set CHROME_PATH or install google-chrome.");
  process.exit(1);
}

if (!existsSync(htmlPath)) {
  console.error(`Missing template: ${htmlPath}`);
  process.exit(1);
}

const args = [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  `--window-size=1200,630`,
  `--screenshot=${outPath}`,
  "--default-background-color=00000000",
  fileUrl,
];

const result = spawnSync(chrome, args, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "Chrome screenshot failed");
  process.exit(result.status ?? 1);
}

if (!existsSync(outPath)) {
  console.error("Screenshot ran but output file was not created.");
  process.exit(1);
}

console.log(`Wrote ${outPath}`);

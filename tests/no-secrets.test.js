import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const self = path.resolve(import.meta.dirname, "no-secrets.test.js");
const skipDirs = new Set([".git", "node_modules", "data", "coverage"]);

const patterns = [
  new RegExp("-----BEGIN " + "(RSA |OPENSSH |EC |DSA )?" + "PRIVATE KEY-----"),
  new RegExp("ghp" + "_[A-Za-z0-9]{30,}"),
  new RegExp("github" + "_pat_[A-Za-z0-9_]{30,}"),
  new RegExp("oc" + "_sk_[A-Za-z0-9]{10,}"),
  new RegExp("AKIA" + "[0-9A-Z]{16}"),
];

async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      result.push(...(await files(full)));
      continue;
    }
    if (!entry.isFile() || full === self) continue;
    const info = await stat(full);
    if (info.size > 1_000_000) continue;
    result.push(full);
  }
  return result;
}

test("no committed secrets are present in source or documentation", async () => {
  const candidates = [
    ...(await files(path.join(root, "src"))),
    ...(await files(path.join(root, "tests"))),
    ...(await files(root)).filter((file) => path.dirname(file) === root),
  ];
  const findings = [];
  for (const file of new Set(candidates)) {
    const text = await readFile(file, "utf8");
    for (const pattern of patterns) {
      if (pattern.test(text)) findings.push(`${path.relative(root, file)} matches ${pattern}`);
    }
  }
  assert.deepEqual(findings, []);
});

test("a real .env is not committed", async () => {
  await assert.rejects(() => stat(path.join(root, ".env")), (error) => error.code === "ENOENT");
});

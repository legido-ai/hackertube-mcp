import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

test("loadConfig returns production-safe defaults", () => {
  const config = loadConfig({});
  assert.equal(config.baseUrl, "https://hackertube.org");
  assert.equal(config.timeoutMs, 20_000);
  assert.equal(config.userAgent, "hackertube-mcp/0.1.0");
  assert.equal(typeof config.dataDir, "string");
});

test("loadConfig trims the base URL and keeps an explicit port", () => {
  const config = loadConfig({ HACKERTUBE_BASE_URL: " http://localhost:8787/ " });
  assert.equal(config.baseUrl, "http://localhost:8787");
});

test("loadConfig accepts a bounded timeout and custom user agent", () => {
  const config = loadConfig({
    HACKERTUBE_TIMEOUT_MS: "5000",
    HACKERTUBE_USER_AGENT: "my-agent/2.0",
    HACKERTUBE_DATA_DIR: "/tmp/ht",
  });
  assert.equal(config.timeoutMs, 5000);
  assert.equal(config.userAgent, "my-agent/2.0");
  assert.equal(config.dataDir, "/tmp/ht");
});

test("loadConfig rejects invalid URLs", () => {
  assert.throws(() => loadConfig({ HACKERTUBE_BASE_URL: "not a url" }), /valid URL/);
  assert.throws(() => loadConfig({ HACKERTUBE_BASE_URL: "file:///tmp/x" }), /http or https/);
});

test("loadConfig rejects invalid timeouts", () => {
  assert.throws(() => loadConfig({ HACKERTUBE_TIMEOUT_MS: "0" }), /between 1000 and 120000/);
  assert.throws(() => loadConfig({ HACKERTUBE_TIMEOUT_MS: "soon" }), /between 1000 and 120000/);
});

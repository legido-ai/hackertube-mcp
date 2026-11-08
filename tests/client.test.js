import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { HackerTubeClient, HackerTubeError } from "../src/client.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeClient(handler, overrides = {}) {
  const calls = [];
  const config = {
    baseUrl: "https://example.test",
    timeoutMs: 1_000,
    dataDir: "/tmp/hackertube-test",
    userAgent: "hackertube-mcp-test/1.0",
    ...overrides,
  };
  const client = new HackerTubeClient({
    config,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return handler(String(url), init);
    },
  });
  return { client, calls };
}

const video = {
  vid: "fNk_zzaMoSs",
  title: "Vectors",
  channel: "3Blue1Brown",
  summary: "A summary",
  why_hn: "HN likes it",
  tags: ["math"],
  categories: [],
};

test("search maps filters, truncates and preserves weak", async () => {
  const { client, calls } = makeClient(() =>
    json({ weak: true, results: [video, { ...video, vid: "aaaaaaaaaaa" }] }),
  );
  const result = await client.search({
    query: "linear algebra",
    limit: 1,
    contentType: "lecture",
    duration: "long",
    date: "2010s",
    sort: "hn",
    hiddenGems: true,
    evergreenOnly: true,
  });
  assert.equal(result.weak, true);
  assert.equal(result.results.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/search");
  assert.equal(url.searchParams.get("q"), "linear algebra");
  assert.equal(url.searchParams.get("type"), "lecture");
  assert.equal(url.searchParams.get("dur"), "long");
  assert.equal(url.searchParams.get("date"), "2010s");
  assert.equal(url.searchParams.get("sort"), "hn");
  assert.equal(url.searchParams.get("gems"), "1");
  assert.equal(url.searchParams.get("evergreen"), "1");
  assert.equal(calls[0].init.headers["User-Agent"], "hackertube-mcp-test/1.0");
});

test("search omits the default relevance sort", async () => {
  const { client, calls } = makeClient(() => json({ results: [video] }));
  await client.search({ query: "x", sort: "relevance" });
  assert.equal(new URL(calls[0].url).searchParams.has("sort"), false);
});

test("search rejects an empty query before fetching", async () => {
  const { client, calls } = makeClient(() => json({ results: [] }));
  await assert.rejects(() => client.search({ query: "  " }), (error) => error.code === "invalid_input");
  assert.equal(calls.length, 0);
});

test("video returns bounded comments with HN links", async () => {
  const { client } = makeClient(() =>
    json({
      video,
      comments: [
        { id: 1, author: "a", stance: "strong_rec" },
        { id: 2, author: "b", stance: "rec" },
        { id: 3, author: "c", stance: "reference" },
      ],
    }),
  );
  const result = await client.video("fNk_zzaMoSs", { maxComments: 2 });
  assert.equal(result.comments.length, 2);
  assert.equal(result.comments[0].hn_url, "https://news.ycombinator.com/item?id=1");
});

test("video can omit comments", async () => {
  const { client } = makeClient(() => json({ video, comments: [{ id: 1 }] }));
  const result = await client.video("fNk_zzaMoSs", { includeComments: false });
  assert.deepEqual(result.comments, []);
});

test("video rejects malformed ids without a request", async () => {
  const { client, calls } = makeClient(() => json({ video }));
  await assert.rejects(() => client.video("short"), (error) => error.code === "invalid_input");
  assert.equal(calls.length, 0);
});

test("video surfaces a missing video as an upstream protocol error", async () => {
  const { client } = makeClient(() => json({ comments: [] }));
  await assert.rejects(() => client.video("fNk_zzaMoSs"), (error) => error.code === "upstream_protocol");
});

test("related sends n and truncates", async () => {
  const { client, calls } = makeClient(() => json([video, video, video]));
  const result = await client.related("fNk_zzaMoSs", 2);
  assert.equal(result.count, 2);
  assert.equal(new URL(calls[0].url).searchParams.get("n"), "2");
});

test("browse, playlists, playlist, feed and stats use the expected endpoints", async () => {
  const routes = {
    "/api/browse": [{ id: "software", name: "Software", count: 1, categories: [] }],
    "/api/playlists": [{ slug: "hn-canon", title: "Canon" }],
    "/api/playlist": { slug: "hn-canon", title: "Canon", videos: [video] },
    "/api/feed": [video],
    "/api/stats": { videos: 1, comments: 2 },
  };
  const { client, calls } = makeClient((url) => json(routes[new URL(url).pathname]));
  assert.equal((await client.browse()).count, 1);
  assert.equal((await client.playlists()).count, 1);
  assert.equal((await client.playlist("hn-canon")).videos.length, 1);
  const feed = await client.feed({ limit: 1, offset: 0, seed: 42 });
  assert.equal(feed.seed, 42);
  assert.equal(feed.results.length, 1);
  assert.equal((await client.stats()).videos, 1);
  assert.equal(calls.length, 5);
  assert.equal(new URL(calls[3].url).searchParams.get("seed"), "42");
});

test("feed generates a seed when none is provided", async () => {
  const { client } = makeClient(() => json([video]));
  const result = await client.feed({ limit: 1 });
  assert.equal(Number.isInteger(result.seed), true);
});

test("HTTP statuses map to stable error codes", async () => {
  for (const [status, code] of [
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "upstream_unavailable"],
    [418, "upstream_unavailable"],
  ]) {
    const { client } = makeClient(() => new Response("", { status }));
    await assert.rejects(() => client.search({ query: "x" }), (error) => error.code === code);
  }
});

test("invalid JSON maps to upstream_protocol", async () => {
  const { client } = makeClient(() => new Response("not json", { status: 200 }));
  await assert.rejects(() => client.search({ query: "x" }), (error) => error.code === "upstream_protocol");
});

test("a slow upstream maps to timeout", async () => {
  const { client } = makeClient(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    { timeoutMs: 1_000 },
  );
  await assert.rejects(() => client.search({ query: "x" }), (error) => error.code === "timeout");
});

test("dataset enriches every file with a download URL", async () => {
  const { client } = makeClient(() =>
    json({
      name: "hackertube-data",
      zip: { name: "hackertube-data.zip", bytes: 10 },
      files: [{ name: "videos.jsonl", bytes: 5, rows: 1 }],
    }),
  );
  const manifest = await client.dataset();
  assert.equal(manifest.zip.download_url, "https://hackertube.org/download/hackertube-data.zip");
  assert.equal(manifest.files[0].download_url, "https://hackertube.org/download/videos.jsonl");
});

test("downloadDataset rejects traversal before fetching", async () => {
  const { client, calls } = makeClient(() => json({ files: [] }));
  await assert.rejects(
    () => client.downloadDataset("../secret"),
    (error) => error.code === "download_rejected",
  );
  assert.equal(calls.length, 0);
});

test("downloadDataset rejects a file outside the manifest", async () => {
  const { client } = makeClient(() => json({ files: [{ name: "videos.jsonl" }] }));
  await assert.rejects(
    () => client.downloadDataset("other.jsonl"),
    (error) => error.code === "download_rejected",
  );
});

test("downloadDataset writes an advertised file under the data directory", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "hackertube-mcp-"));
  try {
    const { client } = makeClient((url) => {
      if (new URL(url).pathname === "/api/export") {
        return json({ files: [{ name: "videos.jsonl", bytes: 5, rows: 1 }] });
      }
      return new Response("hello", { status: 200 });
    }, { dataDir: dir });
    const result = await client.downloadDataset("videos.jsonl");
    assert.equal(result.path, path.join(dir, "videos.jsonl"));
    assert.equal(result.bytes, 5);
    assert.equal(await readFile(result.path, "utf8"), "hello");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("HackerTubeError keeps a stable code and status", () => {
  const error = new HackerTubeError("rate_limited", "slow down", { status: 429 });
  assert.equal(error.name, "HackerTubeError");
  assert.equal(error.code, "rate_limited");
  assert.equal(error.status, 429);
});

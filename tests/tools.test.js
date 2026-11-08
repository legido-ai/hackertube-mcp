import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { HackerTubeError } from "../src/client.js";
import { createServer } from "../src/server.js";

const video = {
  vid: "fNk_zzaMoSs",
  title: "Vectors",
  channel: "3Blue1Brown",
  summary: "A summary",
  why_hn: "HN likes it",
  tags: ["math"],
  categories: [],
  hn: { recommenders: 17 },
};

function stubClient(overrides = {}) {
  return {
    search: async ({ query, limit }) => ({ query, weak: false, count: 1, results: [video].slice(0, limit) }),
    video: async (vid) => ({ video: { ...video, vid }, comments: [{ id: 1, author: "a", hn_url: "https://news.ycombinator.com/item?id=1" }] }),
    related: async (vid, limit) => ({ vid, count: 1, results: [video].slice(0, limit) }),
    browse: async () => ({ count: 1, areas: [{ id: "software", name: "Software", count: 1, categories: [] }] }),
    playlists: async () => ({ count: 1, playlists: [{ slug: "hn-canon", title: "Canon" }] }),
    playlist: async (slug) => ({ slug, title: "Canon", videos: [video] }),
    feed: async ({ seed }) => ({ seed: seed ?? 7, offset: 0, count: 1, results: [video] }),
    stats: async () => ({ videos: 6454, comments: 39834 }),
    dataset: async () => ({ name: "hackertube-data", files: [{ name: "videos.jsonl", download_url: "https://hackertube.org/download/videos.jsonl" }] }),
    downloadDataset: async (filename) => ({ filename, path: `/data/${filename}`, bytes: 5, rows: 1 }),
    ...overrides,
  };
}

async function withServer(stub, fn) {
  const server = createServer({ client: stub });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  try {
    return await fn(client);
  } finally {
    await client.close();
    await server.close();
  }
}

test("all ten tools are registered", async () => {
  await withServer(stubClient(), async (client) => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      "hackertube_browse",
      "hackertube_dataset",
      "hackertube_dataset_download",
      "hackertube_feed",
      "hackertube_playlist",
      "hackertube_playlists",
      "hackertube_related",
      "hackertube_search",
      "hackertube_stats",
      "hackertube_video",
    ]);
  });
});

test("search returns compact JSON content", async () => {
  await withServer(stubClient(), async (client) => {
    const result = await client.callTool({ name: "hackertube_search", arguments: { query: "math", limit: 1 } });
    assert.equal(result.isError, undefined);
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.query, "math");
    assert.equal(payload.results[0].vid, "fNk_zzaMoSs");
  });
});

test("video, related, browse, playlists and playlist return their shapes", async () => {
  await withServer(stubClient(), async (client) => {
    const videoResult = JSON.parse((await client.callTool({ name: "hackertube_video", arguments: { vid: "fNk_zzaMoSs" } })).content[0].text);
    assert.equal(videoResult.video.vid, "fNk_zzaMoSs");
    assert.equal(videoResult.comments.length, 1);

    const related = JSON.parse((await client.callTool({ name: "hackertube_related", arguments: { vid: "fNk_zzaMoSs", limit: 1 } })).content[0].text);
    assert.equal(related.count, 1);

    const browse = JSON.parse((await client.callTool({ name: "hackertube_browse", arguments: {} })).content[0].text);
    assert.equal(browse.areas[0].id, "software");

    const playlists = JSON.parse((await client.callTool({ name: "hackertube_playlists", arguments: {} })).content[0].text);
    assert.equal(playlists.playlists[0].slug, "hn-canon");

    const playlist = JSON.parse((await client.callTool({ name: "hackertube_playlist", arguments: { slug: "hn-canon" } })).content[0].text);
    assert.equal(playlist.videos.length, 1);
  });
});

test("feed, stats, dataset and download return their shapes", async () => {
  await withServer(stubClient(), async (client) => {
    const feed = JSON.parse((await client.callTool({ name: "hackertube_feed", arguments: { seed: 42, limit: 1 } })).content[0].text);
    assert.equal(feed.seed, 42);

    const stats = JSON.parse((await client.callTool({ name: "hackertube_stats", arguments: {} })).content[0].text);
    assert.equal(stats.videos, 6454);

    const dataset = JSON.parse((await client.callTool({ name: "hackertube_dataset", arguments: {} })).content[0].text);
    assert.equal(dataset.files[0].name, "videos.jsonl");

    const download = JSON.parse((await client.callTool({ name: "hackertube_dataset_download", arguments: { filename: "videos.jsonl" } })).content[0].text);
    assert.equal(download.path, "/data/videos.jsonl");
  });
});

test("upstream failures become stable tool errors", async () => {
  const stub = stubClient({
    search: async () => {
      throw new HackerTubeError("rate_limited", "HackerTube is rate limiting requests; retry shortly.");
    },
  });
  await withServer(stub, async (client) => {
    const result = await client.callTool({ name: "hackertube_search", arguments: { query: "x" } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^rate_limited:/);
  });
});

test("invalid tool input is rejected by the schema", async () => {
  await withServer(stubClient(), async (client) => {
    const result = await client.callTool({ name: "hackertube_video", arguments: { vid: "short" } });
    assert.equal(result.isError, true);
  });
});

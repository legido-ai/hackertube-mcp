import assert from "node:assert/strict";
import test from "node:test";

import {
  compactComment,
  compactPlaylist,
  compactVideo,
  normalizeSearch,
  normalizeVideoList,
} from "../src/format.js";

const video = {
  vid: "fNk_zzaMoSs",
  title: "Vectors",
  channel: "3Blue1Brown",
  published: "2016-08-06T00:05:49Z",
  duration_s: 592,
  views: 12,
  likes: 3,
  summary: "A summary",
  why_hn: "HN likes it",
  content_type: "course",
  level: "intro",
  shelf_life: "evergreen",
  primary_topic: "linear algebra",
  tags: ["math", 7],
  categories: [
    { id: "pure-mathematics", name: "Pure mathematics", description: "Long text", area: "math", area_name: "Math" },
    { id: "", name: "" },
  ],
  score: 25,
  hn: { recommenders: 17 },
  quote: { text: "great" },
};

test("compactVideo keeps decision fields and adds canonical links", () => {
  const result = compactVideo(video);
  assert.equal(result.vid, "fNk_zzaMoSs");
  assert.equal(result.hackertube_url, "https://hackertube.org/watch/fNk_zzaMoSs");
  assert.equal(result.youtube_url, "https://www.youtube.com/watch?v=fNk_zzaMoSs");
  assert.deepEqual(result.tags, ["math"]);
  assert.deepEqual(result.categories, [
    { id: "pure-mathematics", name: "Pure mathematics", area: "math", area_name: "Math" },
  ]);
  assert.equal(result.hn.recommenders, 17);
  assert.equal(result.thumbnail, "https://i.ytimg.com/vi/fNk_zzaMoSs/mqdefault.jpg");
});

test("compactVideo rejects records without an id", () => {
  assert.throws(() => compactVideo({ title: "x" }), /missing a vid/);
});

test("compactComment adds the HN thread URL", () => {
  const result = compactComment({ id: 123, author: "alice", stance: "rec" });
  assert.equal(result.hn_url, "https://news.ycombinator.com/item?id=123");
});

test("normalizeSearch handles the documented envelope and truncates", () => {
  const result = normalizeSearch({ weak: true, results: [video, video] }, 1);
  assert.equal(result.weak, true);
  assert.equal(result.results.length, 1);
});

test("normalizeSearch tolerates a bare array and a malformed payload", () => {
  assert.equal(normalizeSearch([video], 5).results.length, 1);
  assert.deepEqual(normalizeSearch(null, 5), { weak: false, results: [] });
});

test("normalizeVideoList truncates related results", () => {
  assert.equal(normalizeVideoList([video, video, video], 2).length, 2);
});

test("compactPlaylist supports summary and detail forms", () => {
  const summary = compactPlaylist({ slug: "hn-canon", title: "Canon", count: 10 });
  assert.equal(summary.hackertube_url, "https://hackertube.org/p/hn-canon");
  assert.equal(summary.videos, undefined);

  const detail = compactPlaylist({ slug: "hn-canon", title: "Canon", videos: [video] }, { includeVideos: true });
  assert.equal(detail.videos.length, 1);
  assert.equal(detail.count, 1);
});

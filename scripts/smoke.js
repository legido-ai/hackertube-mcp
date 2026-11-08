#!/usr/bin/env node
import { HackerTubeClient } from "../src/client.js";

const client = new HackerTubeClient();

const stats = await client.stats();
console.error(`stats: ${stats.videos} videos, ${stats.comments} HN comments`);

const search = await client.search({ query: "distributed systems", limit: 3 });
console.error(`search: ${search.count} result(s), weak=${search.weak}`);
for (const video of search.results) {
  console.error(`- ${video.vid} ${video.title}`);
}

if (search.results[0]) {
  const detail = await client.video(search.results[0].vid, { maxComments: 2 });
  console.error(`video: ${detail.video.title} (${detail.comments.length} comment(s))`);
}

console.log(JSON.stringify({ stats, search }, null, 2));

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { HackerTubeClient, HackerTubeError } from "./client.js";

const CONTENT_TYPES = [
  "talk",
  "lecture",
  "explainer",
  "tutorial",
  "documentary",
  "interview",
  "demo",
  "commentary",
  "comedy",
  "music",
];

const DURATIONS = ["short", "medium", "long", "xlong"];
const DATES = ["year", "2020s", "2010s", "2000s"];
const SORTS = ["relevance", "recent", "date", "old", "views", "liked", "hn"];

/**
 * @param {any} result
 */
function ok(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result,
  };
}

/**
 * @param {unknown} error
 */
function fail(error) {
  const code = error instanceof HackerTubeError ? error.code : "internal_error";
  const message = error instanceof Error ? error.message : "Unexpected error";
  return {
    isError: true,
    content: [{ type: "text", text: `${code}: ${message}` }],
  };
}

/**
 * Wrap a tool implementation so every failure becomes a stable MCP tool error.
 * @param {() => Promise<any>} fn
 */
async function run(fn) {
  try {
    return ok(await fn());
  } catch (error) {
    return fail(error);
  }
}

/**
 * Build the MCP server. Exported for tests and for embedding.
 * @param {{client?: HackerTubeClient}} [options]
 */
export function createServer(options = {}) {
  const client = options.client ?? new HackerTubeClient();
  const server = new McpServer(
    { name: "hackertube", version: "0.1.0" },
    {
      instructions:
        "HackerTube indexes YouTube videos that Hacker News has repeatedly recommended over nearly two decades. " +
        "Use hackertube_search for natural-language topic discovery, then hackertube_video for the full record and HN comments. " +
        "This server is read-only: it never downloads or hosts YouTube videos.",
    },
  );

  server.registerTool(
    "hackertube_search",
    {
      title: "Search HackerTube",
      description:
        "Semantic search over ~6,450 YouTube videos repeatedly recommended on Hacker News. " +
        "Use natural-language topics ('distributed systems', 'how to learn faster'), not YouTube URLs. " +
        "Returns compact records with the HN endorsement summary, score and links. " +
        "The `weak` flag means HackerTube found no strong semantic match.",
      inputSchema: {
        query: z.string().min(1).describe("Natural-language topic or question."),
        limit: z.number().int().min(1).max(25).optional().describe("Results to return (default 10)."),
        content_type: z.enum(CONTENT_TYPES).optional().describe("Filter by HackerTube content type."),
        duration: z.enum(DURATIONS).optional().describe("short <4m, medium 4-20m, long 20-60m, xlong >1h."),
        date: z.enum(DATES).optional().describe("Upload-date bucket."),
        sort: z.enum(SORTS).optional().describe("Result ordering (default relevance)."),
        hidden_gems: z.boolean().optional().describe("Only videos recommended on HN but under 100k YouTube views."),
        evergreen_only: z.boolean().optional().describe("Drop news-only videos."),
      },
    },
    async (args) =>
      run(() =>
        client.search({
          query: args.query,
          limit: args.limit,
          contentType: args.content_type,
          duration: args.duration,
          date: args.date,
          sort: args.sort,
          hiddenGems: args.hidden_gems,
          evergreenOnly: args.evergreen_only,
        }),
      ),
  );

  server.registerTool(
    "hackertube_video",
    {
      title: "Get a HackerTube video",
      description:
        "Full HackerTube record for one 11-character YouTube id: summary, why HN recommends it, " +
        "recommendation statistics, representative quote, and actual Hacker News comments with stance labels " +
        "and links to the original threads.",
      inputSchema: {
        vid: z.string().regex(/^[A-Za-z0-9_-]{11}$/).describe("11-character YouTube video id."),
        include_comments: z.boolean().optional().describe("Include HN comments (default true)."),
        max_comments: z.number().int().min(0).max(20).optional().describe("Comments to return (default 10)."),
      },
    },
    async (args) =>
      run(() =>
        client.video(args.vid, {
          includeComments: args.include_comments,
          maxComments: args.max_comments,
        }),
      ),
  );

  server.registerTool(
    "hackertube_related",
    {
      title: "Related HackerTube videos",
      description:
        "Videos that Hacker News readers also recommended alongside a given video. " +
        "Useful for following a thread of related talks after a search hit.",
      inputSchema: {
        vid: z.string().regex(/^[A-Za-z0-9_-]{11}$/).describe("11-character YouTube video id."),
        limit: z.number().int().min(1).max(25).optional().describe("Results to return (default 10)."),
      },
    },
    async (args) => run(() => client.related(args.vid, args.limit)),
  );

  server.registerTool(
    "hackertube_browse",
    {
      title: "Browse HackerTube topics",
      description:
        "The HackerTube topic tree: 16 areas and 150 categories with video counts. " +
        "Use it to discover the shape of the corpus before searching.",
      inputSchema: {},
    },
    async () => run(() => client.browse()),
  );

  server.registerTool(
    "hackertube_playlists",
    {
      title: "List HackerTube playlists",
      description:
        "Curated editorial playlists such as 'The HN canon' and 'Talks every programmer should watch'. " +
        "Returns summaries; use hackertube_playlist with a slug for the ordered videos.",
      inputSchema: {},
    },
    async () => run(() => client.playlists()),
  );

  server.registerTool(
    "hackertube_playlist",
    {
      title: "Get a HackerTube playlist",
      description: "One curated playlist with its editorial intro and ordered videos.",
      inputSchema: {
        slug: z.string().min(1).describe("Playlist slug, e.g. 'hn-canon'."),
      },
    },
    async (args) => run(() => client.playlist(args.slug)),
  );

  server.registerTool(
    "hackertube_feed",
    {
      title: "HackerTube home feed",
      description:
        "A reproducible page of the HackerTube home feed. Likes and dislikes steer recommendations; " +
        "seen ids are kept out. Pass a seed to reproduce the same page.",
      inputSchema: {
        limit: z.number().int().min(1).max(36).optional().describe("Items to return (default 20)."),
        offset: z.number().int().min(0).max(10_000).optional().describe("Pagination offset (default 0)."),
        seed: z.number().int().optional().describe("Deterministic seed; omit for a random page."),
        liked: z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)).max(50).optional().describe("Video ids you liked."),
        disliked: z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)).max(50).optional().describe("Video ids you disliked."),
        seen: z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)).max(200).optional().describe("Video ids already seen."),
      },
    },
    async (args) =>
      run(() =>
        client.feed({
          limit: args.limit,
          offset: args.offset,
          seed: args.seed,
          liked: args.liked,
          disliked: args.disliked,
          seen: args.seen,
        }),
      ),
  );

  server.registerTool(
    "hackertube_stats",
    {
      title: "HackerTube corpus stats",
      description: "Corpus counts: videos, HN comments, distinct recommenders, areas, categories and year range.",
      inputSchema: {},
    },
    async () => run(() => client.stats()),
  );

  server.registerTool(
    "hackertube_dataset",
    {
      title: "HackerTube dataset manifest",
      description:
        "Manifest of HackerTube's open dataset (videos.jsonl, mentions.jsonl, taxonomy, related, embeddings, zip) " +
        "with sizes, row counts and download URLs. Use hackertube_dataset_download to fetch one file.",
      inputSchema: {},
    },
    async () => run(() => client.dataset()),
  );

  server.registerTool(
    "hackertube_dataset_download",
    {
      title: "Download a HackerTube dataset file",
      description:
        "Download one file advertised by the HackerTube export manifest into the server's data directory. " +
        "Filenames outside the manifest are rejected.",
      inputSchema: {
        filename: z.string().min(1).describe("Advertised filename, e.g. 'videos.jsonl' or 'hackertube-data.zip'."),
      },
    },
    async (args) => run(() => client.downloadDataset(args.filename)),
  );

  return server;
}

# Research: HackerTube MCP Server

## Upstream survey

HackerTube exposes an unauthenticated JSON API under `https://hackertube.org/api/`.
The endpoints used here were verified on 2026-11-08:

| Endpoint | Observed shape | Notes |
|---|---|---|
| `/api/search?q=...` | `{weak: boolean, results: Video[]}` | Semantic search; supports `type`, `dur`, `date`, `gems`, `evergreen`, `sort`. |
| `/api/video?vid=...` | `{video: Video, comments: Comment[]}` | `video` includes `hn`, `quote`, `score`, `hn_related`. |
| `/api/related?vid=...&n=...` | `Video[]` | Also available as `hn_related` on the video. |
| `/api/browse` | `Area[]` | 16 areas, 150 categories with counts. |
| `/api/playlists` | `Playlist[]` | 27 curated playlists at time of writing. |
| `/api/playlist?slug=...` | `Playlist` | Includes ordered `videos`. |
| `/api/feed?seed=&offset=&n=&like=&dislike=&seen=` | `Video[]` | Deterministic with a fixed seed. |
| `/api/stats` | `{videos, comments, recommenders, first_year, last_year, areas, categories}` | Corpus metadata. |
| `/api/export` | `{name, generated, videos, mentions, zip, files[]}` | Manifest for the open dataset. |
| `/download/<name>` | file | Advertised files only. |

## Decisions

### Node.js 24 ESM, no build step

The host already runs Node.js and OpenCode is Node-native. The MCP TypeScript
SDK is stable on Node 24, and native `fetch`/`node:test` remove the need for an
HTTP client or test framework. A build step would add Docker stages without
improving a ~500-line server. JSDoc typedefs document the shapes.

### Official MCP SDK, stdio transport

`@modelcontextprotocol/sdk` 1.32.x provides `McpServer` and
`StdioServerTransport`. Stdio is the correct transport for a local, single-user
tool server: no ports, no auth, no CORS, and OpenCode owns the process
lifecycle.

### Thin client, compact projections

The upstream returns rich records. Returning them verbatim would flood an
agent's context. `format.js` keeps the decision-relevant fields (title,
channel, duration, summary, why HN recommends it, tags, categories, score) and
adds a canonical HackerTube URL. Full records and comments remain available
through `hackertube_video`.

### Read-only, allowlisted downloads

The only write operation is `hackertube_dataset_download`, and it can only
write files advertised by `/api/export`, after a basename/path-traversal check,
under a configured data directory. This keeps the server a consumer, not a
mirror.

### Error translation over retries

HackerTube may return 429/503. The server does not retry automatically because
an MCP tool call has its own latency budget and the agent can decide whether to
retry. It translates status codes into stable error codes and messages.

## Alternatives rejected

- **Python/FastMCP**: viable and consistent with other `legido-ai` MCP servers,
  but the host has no Python runtime, so every local test would require Docker.
  Node keeps the feedback loop fast and matches OpenCode.
- **Scraping YouTube**: rejected by the constitution and unnecessary; HackerTube
  already provides the curated metadata and ids.
- **Snapshotting the dataset into the image**: rejected because it would stale
  immediately and bloat the image. The manifest and controlled download cover
  the use case.
- **HTTP transport**: rejected for the default deployment. It adds ports and
  auth without a current multi-user requirement.

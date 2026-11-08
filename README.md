# hackertube-mcp

Read-only **MCP server** for [HackerTube](https://hackertube.org), the
HN-curated YouTube discovery layer built by Karpathy and Claude Opus 5.5.
HackerTube indexes videos that Hacker News commenters repeatedly recommended
over nearly two decades, enriches them with summaries and topics, and exposes a
public JSON API. This server lets an OpenCode agent search and inspect that
collection without scraping YouTube or reimplementing the ranking pipeline.

- Transport: **stdio** (no ports)
- Runtime: **Node.js 24**, ESM, no build step
- Container: non-root, `--cap-drop=ALL`, no credentials
- Upstream: `https://hackertube.org/api/*` (read-only)

Not affiliated with YouTube, Google, Hacker News, Y Combinator, or HackerTube.

## Tools

| Tool | Purpose |
|---|---|
| `hackertube_search` | Semantic search over ~6,450 HN-recommended videos; filters by type, duration, decade, gems, evergreen; returns `weak` when no strong match. |
| `hackertube_video` | Full record for one id, including HN recommendation stats, representative quote, and actual HN comments with thread links. |
| `hackertube_related` | Videos HN readers also recommended alongside a given video. |
| `hackertube_browse` | Topic tree: 16 areas and 150 categories with counts. |
| `hackertube_playlists` | Curated editorial playlists. |
| `hackertube_playlist` | One playlist with its intro and ordered videos. |
| `hackertube_feed` | Reproducible home feed; likes, dislikes, seen ids, and seed. |
| `hackertube_stats` | Corpus counts and covered year range. |
| `hackertube_dataset` | Manifest for the open dataset (files, sizes, rows, download URLs). |
| `hackertube_dataset_download` | Download one manifest-advertised file into `HACKERTUBE_DATA_DIR`. |

All video results include `hackertube_url` and `youtube_url`. Tools never
download or host video streams.

## Quickstart

```bash
npm ci
npm test
npm start
```

`npm start` speaks MCP over stdio and logs to stderr only.

### Docker

```bash
make docker
docker run --rm -i \
  --cap-drop=ALL --security-opt=no-new-privileges \
  -v hackertube-data:/data \
  hackertube-mcp:local
```

A public multi-arch image is published at
`ghcr.io/legido-ai/hackertube-mcp` (current feature tag:
`001-hackertube-mcp`; `latest` follows the default branch).

### OpenCode

Add to `~/.config/opencode/opencode.json`, preserving existing settings:

```jsonc
{
  "mcp": {
    "servers": {
      "hackertube": {
        "type": "local",
        "command": [
          "docker", "run", "--rm", "-i",
          "--cap-drop=ALL", "--security-opt=no-new-privileges",
          "-v", "hackertube-data:/data",
          "hackertube-mcp:local"
        ],
        "enabled": true,
        "timeout": 30000
      }
    }
  }
}
```

Verify with `opencode mcp list`, then ask: *"Search HackerTube for the best talk
on distributed systems."*

## Architecture

```text
OpenCode / MCP client
        │  stdio (JSON-RPC)
        ▼
src/server.js  ── ten typed tools ──► src/client.js
                                            │  HTTPS GET
                                            ▼
                                  https://hackertube.org/api/*
```

- `src/config.js` parses and validates environment settings.
- `src/client.js` owns HTTP, timeouts, status-to-error mapping, video-id
  validation, and the dataset allowlist.
- `src/format.js` projects rich upstream records into compact, link-bearing
  results.
- `src/server.js` registers the tools and turns failures into stable MCP errors.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `HACKERTUBE_BASE_URL` | `https://hackertube.org` | Upstream base URL. |
| `HACKERTUBE_TIMEOUT_MS` | `20000` | Per-request timeout (1000-120000). |
| `HACKERTUBE_DATA_DIR` | `/data` in Docker, `./data` locally | Dataset downloads. |
| `HACKERTUBE_USER_AGENT` | `hackertube-mcp/0.1.0` | Descriptive client identity. |

No credentials are required. See `.env.example`.

## Testing

```bash
make test    # hermetic: stubbed fetch, no network, no credentials
make lint    # syntax checks
make smoke   # opt-in live read-only check against HackerTube
make smoke-docker # live MCP handshake through the built image
```

The suite covers config validation, search/filter mapping, video id validation,
comment bounding, discovery endpoints, dataset allowlisting and path-traversal
rejection, MCP tool registration, tool errors, and a secret audit.

## Security and limits

- The server is read-only against HackerTube and never touches YouTube pages or
  video streams.
- Dataset downloads must exactly match an entry in `/api/export`; traversal and
  non-advertised names are rejected before any request.
- No secrets, tokens, or private keys exist in the repository or image.
- The container runs as the unprivileged `node` user and publishes no port.
- Coverage is HackerTube's corpus: ~6,450 videos, English-centric, with a few
  percent of LLM labels expected to be noisy. It is not a general YouTube
  search engine.

## Data attribution

HackerTube's dataset is published under [ODC-By 1.0](https://opendatacommons.org/licenses/by/1-0/).
Video metadata comes from the YouTube Data API and comments from the public
Hacker News archive. This project consumes the public API and does not
redistribute the dataset.

## License

MIT. See [LICENSE](LICENSE).

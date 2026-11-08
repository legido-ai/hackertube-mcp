# Implementation Plan: HackerTube MCP Server

**Branch**: `001-hackertube-mcp` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-hackertube-mcp/spec.md`

## Summary

Build a read-only stdio MCP server in Node.js 24 that wraps HackerTube's public
JSON API. It exposes ten tools: semantic search, video details with HN comments,
related videos, topic browse, playlists, playlist detail, home feed, corpus
stats, dataset manifest, and controlled dataset download. The server is
packaged as a small non-root Docker image and registered in OpenCode as a local
MCP server.

The implementation deliberately does not scrape YouTube, reimplement ranking,
or store user profiles. It is a thin, well-tested adapter over
`https://hackertube.org/api/*`.

## Technical Context

**Language/Version**: Node.js 24 LTS (ESM, no build step)

**Primary Dependencies**: `@modelcontextprotocol/sdk` 1.32.x, `zod` 4.x.
Node's native `fetch`, `node:test`, and `node:assert` cover HTTP and testing;
no HTTP client or test framework dependency is needed.

**Storage**: Optional local dataset downloads under `HACKERTUBE_DATA_DIR`
(default `/data` in Docker, `./data` locally). No database.

**Testing**: `node --test` with an injected `fetch` implementation. Hermetic
tests use fixtures and stubs; live smoke checks are opt-in.

**Target Platform**: Linux amd64/arm64 containers; any host with Node.js 24.

**Project Type**: Single-project CLI/MCP server.

**Performance Goals**: Cold start under 2 seconds; search round-trip bounded by
the upstream timeout (default 20 seconds); compact responses under ~25 results.

**Constraints**: stdio only, no ports; no credentials; read-only upstream;
unprivileged container; JSON-RPC stdout must stay clean.

**Scale/Scope**: 6,454 videos and ~40k HN mentions upstream; ten tools; one
process per MCP client.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|---|---|---|
| Specification-driven | PASS | `spec.md` defines five prioritized stories and acceptance criteria. |
| Test-first, hermetic | PASS | `tests/` covers config, client, format, tools, and secret hygiene with stubs. |
| Read-only public upstream | PASS | Only `GET /api/*` and manifest-advertised `/download/*`; no YouTube scraping. |
| Security and secret hygiene | PASS | No credentials; non-root image; secret audit test; `.env.example` only. |
| Small, composable surface | PASS | Ten named tools, typed inputs, compact output. |
| Observability without leakage | PASS | stderr-only operational logs; no payload or prompt logging. |

No violations; complexity tracking is empty.

## Project Structure

### Documentation

```text
specs/001-hackertube-mcp/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── tools.md
├── checklists/
│   └── requirements.md
├── tasks.md
└── verification.md
```

### Source Code

```text
src/
├── index.js          # stdio entry point and startup logging
├── server.js         # McpServer creation, tool registration, error envelope
├── client.js         # HackerTube HTTP client, validation, dataset download
├── config.js         # environment parsing and defaults
└── format.js         # compact video/search/playlist projections
tests/
├── config.test.js
├── client.test.js
├── format.test.js
├── tools.test.js
└── no-secrets.test.js
Dockerfile
.dockerignore
.env.example
Makefile
README.md
package.json
package-lock.json
```

**Structure Decision**: Single project. The MCP surface is small enough that a
flat `src/` and `tests/` tree is clearer than layered directories.

## API Mapping

| Tool | Upstream | Notes |
|---|---|---|
| `hackertube_search` | `GET /api/search` | `q`, `type`, `dur`, `date`, `gems`, `evergreen`, `sort`; client truncates to `limit`. |
| `hackertube_video` | `GET /api/video?vid=` | Returns `{video, comments}`; client bounds comments. |
| `hackertube_related` | `GET /api/related?vid=&n=` | Returns an array; client truncates. |
| `hackertube_browse` | `GET /api/browse` | Areas with nested categories and counts. |
| `hackertube_playlists` | `GET /api/playlists` | Editorial playlist summaries. |
| `hackertube_playlist` | `GET /api/playlist?slug=` | Ordered videos and intro text. |
| `hackertube_feed` | `GET /api/feed` | `seed`, `offset`, `n`, `like`, `dislike`, `seen`. |
| `hackertube_stats` | `GET /api/stats` | Corpus counts and year range. |
| `hackertube_dataset` | `GET /api/export` | Manifest plus `/download/<name>` URLs. |
| `hackertube_dataset_download` | `GET /api/export`, `GET /download/<name>` | Manifest allowlist, basename check, bounded size. |

All requests use `Accept: application/json` and a descriptive `User-Agent`.
Search and feed responses are arrays in some upstream versions; the client
normalizes both `{results: [...]}` and bare arrays.

## Error Model

`HackerTubeError` carries a stable `code` and optional HTTP status:

| Code | Trigger | Agent-facing message |
|---|---|---|
| `invalid_input` | Local validation fails | Specific field and expected shape |
| `not_found` | HTTP 404 | "No HackerTube video/playlist found for ..." |
| `rate_limited` | HTTP 429 | "HackerTube is rate limiting; retry shortly." |
| `upstream_unavailable` | HTTP 5xx | "HackerTube is temporarily unavailable." |
| `upstream_protocol` | Invalid JSON or unexpected shape | "Unexpected HackerTube response." |
| `timeout` | AbortController fires | "HackerTube did not respond within N ms." |
| `download_rejected` | Filename not advertised or unsafe | "File is not in the HackerTube export manifest." |
| `download_failed` | Disk or network write error | "Could not save dataset file: <class>." |

Tool handlers catch these and return `{ isError: true, content: [...] }`; they
never leak stack traces or upstream bodies.

## Security

- No secrets in package, Dockerfile, tests, or configuration.
- `HACKERTUBE_BASE_URL` is validated as `http:` or `https:`; default is HTTPS.
- Dataset filenames must exactly match a manifest entry and must equal their
  basename; output is written under `HACKERTUBE_DATA_DIR`.
- Docker image runs as `node`/UID 1000, `--cap-drop=ALL`,
  `--security-opt=no-new-privileges`, no published ports.
- Stdout is reserved for JSON-RPC; all logs use `console.error`.

## Testing Strategy

1. **Config tests**: defaults, trimming, invalid timeout, invalid URL.
2. **Client tests**: URL/query construction, filter mapping, weak results,
   malformed payloads, 404/429/5xx, timeout, video id validation, dataset
   allowlist and path traversal.
3. **Format tests**: compact projections preserve provenance and truncate.
4. **Tool tests**: in-memory MCP client lists all ten tools and calls each with a
   stub client; errors return `isError`.
5. **Secret audit**: scan tracked text files for private-key blocks, `ghp_`,
   `github_pat_`, `oc_sk_`, and committed `.env`.
6. **Live smoke (opt-in)**: `make smoke` calls real search and video endpoints.

## Deployment

- GitHub Actions builds and pushes a multi-arch image to
  `ghcr.io/legido-ai/hackertube-mcp`.
- OpenCode registers the local image over stdio:

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
          "ghcr.io/legido-ai/hackertube-mcp:latest"
        ],
        "enabled": true,
        "timeout": 30000
      }
    }
  }
}
```

The server needs no credentials. The data volume is only for optional dataset
downloads.

## Complexity Tracking

No constitution violations. No additional projects, databases, or background
services are introduced.

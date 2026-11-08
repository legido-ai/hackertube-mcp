# Verification: HackerTube MCP Server

**Feature**: `001-hackertube-mcp`
**Date**: 2026-11-08
**Environment**: OpenCode container (Debian 12, Node.js 26.13.0 host, Docker
29.9.3), image `hackertube-mcp:local` on `node:24-alpine`.

## Automated results

| Check | Command | Result |
|---|---|---|
| Syntax | `npm run lint` | PASS (7 files) |
| Hermetic suite | `npm test` | PASS — 37 tests, 0 failures, ~2.1 s |
| Container build | `make docker` | PASS — `hackertube-mcp:local` |
| MCP handshake (container) | `node scripts/container-smoke.mjs` | PASS — 10 tools listed |
| Live stats | `hackertube_stats` | PASS — 6,454 videos, 39,834 comments, 15,041 recommenders |
| Live search | `hackertube_search("distributed systems")` | PASS — Martin Kleppmann results |

The hermetic suite uses an injected `fetch`; it makes no network calls and needs
no credentials. The live checks are separate and read-only.

## Coverage highlights

- Config defaults, URL normalization, timeout bounds.
- Search filter mapping (`type`, `dur`, `date`, `sort`, `gems`, `evergreen`),
  limit truncation, `weak` preservation.
- Video id validation, comment bounding, HN thread URL derivation.
- Related, browse, playlists, playlist, feed, stats.
- HTTP 404/429/5xx, invalid JSON, timeout, and protocol-shape errors.
- Dataset manifest enrichment, allowlist enforcement, traversal rejection,
  successful file write.
- MCP tool registration (all ten), structured JSON responses, tool error
  envelopes, schema rejection.
- Secret audit: no private keys, GitHub tokens, OpenCode keys, or AWS keys in
  source; no committed `.env`.

## OpenCode integration

Registered as `hackertube` in `/root/.config/opencode/opencode.json` using the
local image over stdio. The running OpenCode session exposes the ten tools under
the `hackertube` namespace; `hackertube_stats` and `hackertube_search` were
invoked successfully through the live MCP connection.

`opencode mcp list` could not complete in this container because the CLI tried
to start a second managed service on port 49374, which the running server
already owns. That is an existing harness port conflict, not a server failure:
the same server connected and served tool calls in the active session.

## Container

- Base: `node:24-alpine`.
- Runtime user: `node` (non-root).
- No published ports; stdio only.
- `/data` volume for optional dataset downloads.
- No secrets baked into the image; `npm ci --omit=dev` only.
- Uncompressed image size: 202 MB.

## Known limits

- Live checks depend on `https://hackertube.org` availability and rate limits.
- HackerTube's LLM labels are expected to contain a few percent of noise.
- The corpus is English-centric and limited to ~6,450 videos.
- Dataset downloads are capped by the upstream manifest; the zip is ~17 MB and
  `mentions.jsonl` ~35 MB.

## Unverified at this stage

- GHCR image publication and multi-arch manifest, pending the first push.
- Package visibility on GHCR (source repository is public).

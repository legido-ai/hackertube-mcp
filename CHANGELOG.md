# Changelog

## 0.1.0 — 2026-11-08

- Initial public release of `hackertube-mcp`.
- Ten read-only MCP tools: semantic search, video details with HN comments,
  related videos, topic browse, playlists, playlist detail, home feed, corpus
  stats, dataset manifest, and manifest-allowlisted dataset download.
- Node.js 24 ESM server over stdio with compact projections and stable error
  codes.
- Hermetic test suite (`node --test`) covering config, client, formatting, MCP
  tools, timeout/status handling, dataset path safety, and secret hygiene.
- Multi-arch Docker image workflow for `ghcr.io/legido-ai/hackertube-mcp`.

# Requirements Checklist: HackerTube MCP Server

**Purpose**: Verify that the implemented server satisfies the specification,
contract, and constitution before merge.
**Created**: 2026-11-08
**Feature**: [spec.md](../spec.md)

## Functional surface

- [x] CHK001 `hackertube_search` exposes query, limit, type, duration, decade,
      sort, hidden-gems, and evergreen filters.
- [x] CHK002 `hackertube_video` returns metadata, HN stats, bounded comments,
      and HN thread links.
- [x] CHK003 `hackertube_related`, `hackertube_browse`, `hackertube_playlists`,
      and `hackertube_playlist` are registered and tested.
- [x] CHK004 `hackertube_feed` supports offset, limit, seed, likes, dislikes,
      and seen ids.
- [x] CHK005 `hackertube_stats` returns corpus counts.
- [x] CHK006 `hackertube_dataset` returns the manifest with download URLs.
- [x] CHK007 `hackertube_dataset_download` rejects traversal and
      non-advertised filenames.

## Quality gates

- [x] CHK008 Every tool result is compact JSON with canonical HackerTube and
      YouTube URLs.
- [x] CHK009 Inputs are validated locally; invalid ids fail without a network
      call.
- [x] CHK010 Upstream 404/429/5xx, invalid JSON, and timeouts map to stable
      error codes.
- [x] CHK011 `npm test` passes with 37 hermetic tests and no network.
- [x] CHK012 `npm run lint` passes.
- [x] CHK013 The MCP handshake lists all ten tools.
- [x] CHK014 A live search and stats call succeed through the container.

## Security and operations

- [x] CHK015 No credentials, tokens, or private keys are committed.
- [x] CHK016 `.env` is ignored; `.env.example` documents supported settings.
- [x] CHK017 The container runs as non-root with capabilities dropped.
- [x] CHK018 No port is published; transport is stdio only.
- [x] CHK019 Logs use stderr; stdout remains the JSON-RPC stream.
- [x] CHK020 The image builds and starts without secrets.

## Documentation

- [x] CHK021 README covers tools, quickstart, Docker, OpenCode, architecture,
      configuration, security, and limits.
- [x] CHK022 `specs/001-hackertube-mcp/verification.md` records actual results.
- [x] CHK023 CHANGELOG records the initial release.
- [x] CHK024 The repository is public under `legido-ai/hackertube-mcp`.

## Notes

- GHCR publication is a post-push check; the source repository is public.
- The `opencode mcp list` CLI port conflict is an existing harness issue; the
  active session connected successfully and served tool calls.

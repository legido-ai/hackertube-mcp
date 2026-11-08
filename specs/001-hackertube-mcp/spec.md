# Feature Specification: HackerTube MCP Server

**Feature Branch**: `001-hackertube-mcp`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User request: "Create an MCP [server] to interact with HackerTube,
what Karpathy built. Make it public, use GitHub, clone the template, use Spec
Kit, Docker, MCP, and the usual setup."

## Overview

HackerTube is a public discovery layer over YouTube: it indexes videos that
Hacker News commenters repeatedly recommended over nearly two decades, enriches
them with AI-written summaries and topic labels, and exposes a public JSON API.
This feature delivers a small, read-only MCP server that lets an OpenCode agent
search, inspect, and browse that collection without scraping YouTube or
reimplementing HackerTube's data pipeline.

## User Scenarios & Testing

### User Story 1 - Semantic search over curated videos (Priority: P1)

An agent needs to answer "find me the best talk about distributed systems" or
"something on learning faster" and receive a short list of videos that Hacker
News has repeatedly endorsed, with enough metadata and provenance to choose one.

**Why this priority**: Search is the highest-value interaction and the clearest
difference from YouTube search. It turns the curated corpus into an on-demand
research tool.

**Independent Test**: Call `hackertube_search` with a natural-language query and
verify the response contains ranked videos, the `weak` flag, and compact
metadata including the HackerTube URL and HN endorsement summary.

**Acceptance Scenarios**:

1. **Given** a natural-language topic query, **When** the agent calls
   `hackertube_search`, **Then** it receives up to the requested limit of
   matching videos with title, channel, duration, summary, `why_hn`, tags,
   categories, score, and URL.
2. **Given** a query with no strong matches, **When** the upstream returns
   `weak: true`, **Then** the tool preserves that signal and still returns the
   closest results.
3. **Given** filters for type, duration, decade, hidden gems, or evergreen,
   **When** the agent supplies them, **Then** they are forwarded to HackerTube
   and reflected in the response.

---

### User Story 2 - Inspect one video and its HN evidence (Priority: P2)

An agent has a video id or a search result and needs the full record: summary,
why HN recommends it, recommendation statistics, representative quote, and the
actual Hacker News comments with stance labels and thread links.

**Why this priority**: Provenance is the product's trust mechanism. Without the
HN evidence, the server is just another metadata wrapper.

**Independent Test**: Call `hackertube_video` with a known id and verify the
response includes metadata, HN counts, and a bounded list of comments with links.

**Acceptance Scenarios**:

1. **Given** a valid 11-character YouTube id, **When** the agent calls
   `hackertube_video`, **Then** it receives the video record, HN statistics,
   and up to `max_comments` comments with author, year/month, story, stance,
   quote, and HN thread URL.
2. **Given** an invalid id, **When** the tool is called, **Then** it returns a
   validation error without making a network request.
3. **Given** an upstream 404, **When** the id does not exist, **Then** the tool
   returns a clear "video not found" error.

---

### User Story 3 - Discover related videos, topics, playlists, and feeds (Priority: P3)

An agent wants to explore rather than search: related videos for a known talk,
the topic tree, curated playlists, or a fresh home feed seeded by likes and
dislikes.

**Why this priority**: Discovery complements search and exposes the shape of the
corpus. It is valuable but not required for the core search-and-inspect loop.

**Independent Test**: Call `hackertube_related`, `hackertube_browse`,
`hackertube_playlists`, `hackertube_playlist`, `hackertube_feed`, and
`hackertube_stats` independently and verify each returns a coherent payload.

**Acceptance Scenarios**:

1. **Given** a video id, **When** the agent calls `hackertube_related`, **Then**
   it receives up to the requested number of videos HN readers also recommended.
2. **Given** no arguments, **When** the agent calls `hackertube_browse`, **Then**
   it receives the 16 areas and 150 categories with counts.
3. **Given** a playlist slug, **When** the agent calls `hackertube_playlist`,
   **Then** it receives the ordered videos and playlist metadata.
4. **Given** optional likes, dislikes, seen ids, and a seed, **When** the agent
   calls `hackertube_feed`, **Then** it receives a reproducible page of feed
   items.
5. **Given** no arguments, **When** the agent calls `hackertube_stats`, **Then**
   it receives corpus counts and the covered year range.

---

### User Story 4 - Dataset manifest and controlled download (Priority: P4)

An agent or operator wants to reuse HackerTube's underlying open dataset, for
example to point another model at the zip file or inspect `videos.jsonl`.

**Why this priority**: The dataset is a first-class part of HackerTube's value,
but it is secondary to live search and inspection.

**Independent Test**: Call `hackertube_dataset` and verify it lists the manifest
and download URLs. Call `hackertube_dataset_download` with an advertised file
and verify the file is written under the configured data directory.

**Acceptance Scenarios**:

1. **Given** no arguments, **When** the agent calls `hackertube_dataset`, **Then**
   it receives the export metadata, file sizes, row counts, and download URLs.
2. **Given an advertised filename**, **When** the agent calls
   `hackertube_dataset_download`, **Then** the file is downloaded to
   `HACKERTUBE_DATA_DIR` and the tool reports its path, bytes, and row count.
3. **Given a filename not in the manifest or a path traversal attempt**, **When**
   the tool is called, **Then** it rejects the request before any network call.

---

### User Story 5 - Container and MCP integration (Priority: P5)

An operator can build the image, register it as a local stdio MCP server in
OpenCode, and confirm the tools are visible and callable.

**Why this priority**: The server only delivers value when it is easy to run and
wire into the agent harness.

**Independent Test**: Build the Docker image, run `opencode mcp list`, and invoke
a read-only tool through OpenCode or an MCP client.

**Acceptance Scenarios**:

1. **Given** Docker and the repository, **When** the operator runs
   `make docker`, **Then** a runnable image is produced without secrets.
2. **Given** the image, **When** OpenCode starts the stdio server, **Then** the
   MCP handshake succeeds and all tools are listed.
3. **Given** a live network, **When** the operator calls
   `hackertube_search`, **Then** real HackerTube results are returned.

### Edge Cases

- Upstream returns HTTP 429 or 503: return a retry-friendly error, do not retry
  indefinitely.
- Upstream returns malformed JSON or an unexpected shape: return a clear
  upstream-protocol error.
- Upstream is slow or unreachable: respect the configured timeout and return a
  timeout error.
- Search returns no results or `weak: true`: preserve the distinction; never
  fabricate matches.
- Video id is malformed: reject locally with a validation error.
- Dataset file is not advertised, is a directory, or contains `..`: reject.
- Disk write fails: return the path and OS error class without leaking data.
- HackerTube changes its schema: tests pin the expected shape; failures are
  actionable rather than silent.

## Requirements

### Functional Requirements

- **FR-001**: The server MUST expose `hackertube_search` with natural-language
  query, limit, content type, duration, date range, sort, hidden-gems, and
  evergreen filters.
- **FR-002**: The server MUST expose `hackertube_video` with a bounded comments
  option and HN provenance.
- **FR-003**: The server MUST expose `hackertube_related` with a video id and
  result limit.
- **FR-004**: The server MUST expose `hackertube_browse`, `hackertube_playlists`,
  and `hackertube_playlist` for topic and editorial discovery.
- **FR-005**: The server MUST expose `hackertube_feed` with offset, limit, seed,
  likes, dislikes, and seen ids.
- **FR-006**: The server MUST expose `hackertube_stats`.
- **FR-007**: The server MUST expose `hackertube_dataset` and
  `hackertube_dataset_download`.
- **FR-008**: All tools MUST return compact, JSON-serializable results and MUST
  include HackerTube URLs for videos.
- **FR-009**: All tools MUST validate inputs locally before making a request.
- **FR-010**: The client MUST send a descriptive `User-Agent`, use a bounded
  timeout, and translate upstream failures into typed errors.
- **FR-011**: The server MUST NOT require, store, or log credentials.
- **FR-012**: The server MUST run over stdio and MUST NOT publish a port.
- **FR-013**: The server MUST run as an unprivileged user in Docker with
  capabilities dropped and no writable application directory.
- **FR-014**: The repository MUST include hermetic tests for config, client,
  formatting, tools, and secret hygiene.
- **FR-015**: The repository MUST include a Makefile with `test`, `lint`,
  `docker`, and `run` targets, plus README and `.env.example`.

### Non-Functional Requirements

- **NFR-001**: A cold stdio start completes in under 2 seconds on the target
  container.
- **NFR-002**: Tool calls have a default 20-second upstream timeout, configurable
  via `HACKERTUBE_TIMEOUT_MS`.
- **NFR-003**: The image remains under 150 MB compressed.
- **NFR-004**: The default test suite completes in under 30 seconds and uses no
  network.
- **NFR-005**: Logs are written to stderr and never to stdout, preserving the
  JSON-RPC stream.

### Key Entities

- **Video**: HackerTube record (`vid`, title, channel, published, duration,
  views, likes, summary, why_hn, content_type, level, shelf_life, primary_topic,
  tags, categories, score, HN stats, quote).
- **HN Comment**: A Hacker News mention (`id`, author, `ym`, story, stance, why,
  quote, text) linked to a video.
- **Category**: A topic node (`id`, name, description, area, area_name).
- **Playlist**: A curated editorial list (`slug`, title, pitch, intro, minutes,
  videos).
- **Dataset File**: An export artifact (`name`, bytes, rows, download URL).

## Success Criteria

- **SC-001**: An agent can go from a natural-language request to a specific
  video with HN evidence in two tool calls or fewer.
- **SC-002**: Search results include the `weak` distinction and never invent a
  strong match.
- **SC-003**: Every video result carries a valid HackerTube URL derived from its
  id.
- **SC-004**: `make test` passes from a clean checkout with no network.
- **SC-005**: The Docker image starts, completes the MCP handshake, and lists all
  ten tools.
- **SC-006**: No secret scanner finding exists in source, tests, or image.

## Non-Goals

- Hosting, downloading, or transcoding YouTube videos.
- Scraping YouTube pages or bypassing its API terms.
- Reimplementing HackerTube's ranking or AI labeling pipeline.
- Writing to HackerTube, Hacker News, or YouTube.
- User accounts, authentication, or persistent personalization on the server.
- A web UI; the deliverable is an MCP server and its container.

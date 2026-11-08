# MCP Tool Contracts

All tools are read-only except `hackertube_dataset_download`, which writes only
manifest-advertised files under `HACKERTUBE_DATA_DIR`. All names are prefixed
`hackertube_`.

## `hackertube_search`

**Input**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `query` | string | yes | — | Natural-language topic, not a URL. |
| `limit` | integer 1-25 | no | 10 | Results returned. |
| `content_type` | enum | no | — | talk, lecture, explainer, tutorial, documentary, interview, demo, commentary, comedy, music. |
| `duration` | enum | no | — | short (<4m), medium (4-20m), long (20-60m), xlong (>1h). |
| `date` | enum | no | — | year, 2020s, 2010s, 2000s. |
| `sort` | enum | no | relevance | relevance, recent, date, old, views, liked, hn. |
| `hidden_gems` | boolean | no | false | Upstream `gems=1`. |
| `evergreen_only` | boolean | no | false | Upstream `evergreen=1`. |

**Output**: `{query, weak, count, results: Video[]}`. `weak` is true when
HackerTube has no strong semantic match.

## `hackertube_video`

**Input**: `vid` (11-char id), `include_comments` (default true),
`max_comments` (0-20, default 10).

**Output**: `{video: Video, comments: Comment[]}` with `hn_url` added to each
comment.

## `hackertube_related`

**Input**: `vid` (11-char id), `limit` (1-25, default 10).

**Output**: `{vid, count, results: Video[]}`.

## `hackertube_browse`

**Input**: none.

**Output**: `{areas: Area[], count}`.

## `hackertube_playlists`

**Input**: none.

**Output**: `{count, playlists: Playlist[]}` (summary form).

## `hackertube_playlist`

**Input**: `slug` (string).

**Output**: `Playlist` with ordered `videos`.

## `hackertube_feed`

**Input**: `limit` (1-36, default 20), `offset` (>=0, default 0), `seed`
(integer, optional), `liked` (string[]), `disliked` (string[]), `seen`
(string[]).

**Output**: `{seed, offset, count, results: Video[]}`. A fixed seed makes the
page reproducible.

## `hackertube_stats`

**Input**: none.

**Output**: upstream stats object plus `source` and `generated_at`.

## `hackertube_dataset`

**Input**: none.

**Output**: manifest with `zip` and `files`, each file enriched with a
`download_url`.

## `hackertube_dataset_download`

**Input**: `filename` (must be advertised), `output_dir` (optional; defaults to
`HACKERTUBE_DATA_DIR`).

**Output**: `{filename, path, bytes, rows}`. Rejects traversal and
non-advertised files before any request.

## Error envelope

```json
{
  "isError": true,
  "content": [
    { "type": "text", "text": "rate_limited: HackerTube is rate limiting; retry shortly." }
  ]
}
```

Stable codes: `invalid_input`, `not_found`, `rate_limited`,
`upstream_unavailable`, `upstream_protocol`, `timeout`, `download_rejected`,
`download_failed`.

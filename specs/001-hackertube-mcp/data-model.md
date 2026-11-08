# Data Model: HackerTube MCP Server

The server does not own a database. These are the upstream and transport shapes
it normalizes. All objects are JSON-serializable.

## Video

| Field | Type | Notes |
|---|---|---|
| `vid` | string (11) | YouTube id; canonical join key. |
| `url` | string | Derived: `https://hackertube.org/watch/<vid>` and `https://www.youtube.com/watch?v=<vid>`. |
| `title`, `channel` | string | Upstream metadata. |
| `published` | ISO-8601 string | Upload date. |
| `duration_s` | integer | Seconds. |
| `views`, `likes` | integer | Upstream snapshot. |
| `thumbnail` | URL | YouTube image. |
| `summary` | string | AI-written summary; may contain minor noise. |
| `why_hn` | string | Why HN recommends it. |
| `content_type` | string | talk, lecture, explainer, tutorial, documentary, interview, demo, commentary, comedy, music, course. |
| `level` | string | intro, general, intermediate, advanced. |
| `shelf_life` | string | evergreen, news, dated. |
| `primary_topic` | string | Free-text topic. |
| `tags` | string[] | Search/display tags. |
| `categories` | Category[] | Full category objects. |
| `score` | number | `rec_months + 0.5 * strong_rec_months`. |
| `hn` | HnStats | Endorsement statistics. |
| `quote` | Quote? | Representative HN quote. |

## HnStats

| Field | Type | Notes |
|---|---|---|
| `mentions` | integer | Capped at 20 by the export. |
| `recommenders` | integer | Distinct commenters who recommended it. |
| `stances` | object | Counts for `strong_rec`, `rec`, `reference`, `joke`, `critical`. |
| `rec_months` | integer | Distinct months with a recommendation. |
| `strong` | integer | Strong recommendation count. |
| `first`, `last` | string | First/last year observed. |
| `last_rec` | string | Last recommendation month (`YYYY-MM`). |

## Comment

| Field | Type | Notes |
|---|---|---|
| `id` | integer | HN comment id. |
| `author` | string | HN username. |
| `ym` | string | `YYYY-MM`. |
| `story` | string | HN story title. |
| `stance` | enum | `strong_rec`, `rec`, `reference`, `joke`, `critical`. |
| `why` | string | Short explanation. |
| `quote` | string | Verbatim excerpt. |
| `text` | string | Comment text, truncated by upstream. |
| `hn_url` | string | Derived: `https://news.ycombinator.com/item?id=<id>`. |

## Category

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug. |
| `name` | string | Display name. |
| `description` | string | What belongs here. |
| `area` | string | Parent area id. |
| `area_name` | string | Parent display name. |

## Area (browse)

| Field | Type | Notes |
|---|---|---|
| `id`, `name` | string | Stable id and display name. |
| `count` | integer | Videos in the area. |
| `categories` | Category[] | Nested categories with counts. |

## Playlist

| Field | Type | Notes |
|---|---|---|
| `slug` | string | Stable id. |
| `title`, `pitch`, `intro` | string | Editorial text. |
| `tier`, `kind` | string | Editorial grouping. |
| `minutes` | integer | Total runtime. |
| `count` | integer | Video count (summary form). |
| `cover` | string[] | Video ids. |
| `videos` | Video[] | Present in detail form. |

## DatasetFile

| Field | Type | Notes |
|---|---|---|
| `name` | string | Must equal basename and manifest entry. |
| `bytes` | integer | Size. |
| `rows` | integer? | Row count when applicable. |
| `url` | string | `https://hackertube.org/download/<name>`. |
| `path` | string | Local path after download. |

## Tool Envelope

Successful tools return MCP `content: [{type: "text", text: <JSON>}]` and, where
useful, `structuredContent`. Errors return `isError: true` with a short text
message and a stable error code. Tool names are prefixed `hackertube_` to avoid
collisions in a shared MCP namespace.

# Quickstart: HackerTube MCP Server

## Prerequisites

- Node.js 24+ for local development, or Docker.
- Network access to `https://hackertube.org`.
- No credentials.

## Run locally

```bash
npm ci
npm test
npm start
```

`npm start` speaks MCP over stdio. It prints logs to stderr only; stdout is the
JSON-RPC stream.

## Build and run the container

```bash
make docker
docker run --rm -i \
  --cap-drop=ALL --security-opt=no-new-privileges \
  -v hackertube-data:/data \
  hackertube-mcp:local
```

No ports are published.

## Register in OpenCode

Add the server to `~/.config/opencode/opencode.json` (preserve existing
settings):

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

Then verify:

```bash
opencode mcp list
```

## Example calls

Once connected, ask the agent:

- "Search HackerTube for the best talk on distributed systems."
- "Show me the HN comments for video `fNk_zzaMoSs`."
- "What videos do HN readers also recommend alongside `SxdOUGdseq4`?"
- "List the HackerTube playlists and open the HN canon."
- "Download `videos.jsonl` from the HackerTube dataset."

## Live smoke test

```bash
make smoke
```

This is opt-in and calls the real API. It is not part of `make test`.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `HACKERTUBE_BASE_URL` | `https://hackertube.org` | Upstream base URL. |
| `HACKERTUBE_TIMEOUT_MS` | `20000` | Per-request timeout. |
| `HACKERTUBE_DATA_DIR` | `/data` (container), `./data` (host) | Dataset download directory. |
| `HACKERTUBE_USER_AGENT` | `hackertube-mcp/0.1.0` | Descriptive client identity. |

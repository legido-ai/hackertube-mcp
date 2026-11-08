#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./server.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("hackertube-mcp 0.1.0 ready on stdio");
}

main().catch((error) => {
  console.error(`hackertube-mcp failed to start: ${error?.message ?? "unknown error"}`);
  process.exit(1);
});

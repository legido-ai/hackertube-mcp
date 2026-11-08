import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "docker",
  args: [
    "run", "--rm", "-i",
    "--cap-drop=ALL", "--security-opt=no-new-privileges",
    "hackertube-mcp:local",
  ],
  stderr: "inherit",
});
const client = new Client({ name: "container-smoke", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`tools=${tools.length}`);
console.log(tools.map((tool) => tool.name).sort().join(","));

const stats = await client.callTool({ name: "hackertube_stats", arguments: {} });
console.log(`stats.isError=${Boolean(stats.isError)}`);
console.log(stats.content[0].text);

const search = await client.callTool({
  name: "hackertube_search",
  arguments: { query: "distributed systems", limit: 2 },
});
console.log(`search.isError=${Boolean(search.isError)}`);
const payload = JSON.parse(search.content[0].text);
for (const video of payload.results) console.log(`${video.vid} ${video.title}`);

await client.close();

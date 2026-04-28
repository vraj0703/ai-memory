#!/usr/bin/env node
/**
 * ai-memory CLI dispatcher.
 *
 * Subcommands:
 *   serve      — start the HTTP memory service (default)
 *   mcp        — start the MCP server on stdio
 *   remember   — store a single memory item from CLI args
 *   recall     — fetch a memory by id
 *   state      — dump cognitive state snapshot
 *   --version | --help
 */

const args = process.argv.slice(2);
const cmd = args[0];

function printHelp() {
  console.log(`\
ai-memory — persistent memory organ for AI agents.

usage:
  ai-memory [serve]                    start the HTTP service
  ai-memory mcp                        start the MCP server on stdio
  ai-memory remember <content>         store a memory item
  ai-memory recall <id>                fetch a memory by id
  ai-memory state                      dump cognitive state snapshot
  ai-memory --version | --help

env:
  MEMORY_PORT                  HTTP port (default 3488)
  MEMORY_USE_REAL              comma-separated integrations to switch
                               from mock to real (e.g. "store,embedder")
                               or "all" for everything
`);
}

(async () => {
  if (!cmd || cmd === "serve") {
    require("../src/index.js");
    return;
  }
  if (cmd === "--version" || cmd === "-V") {
    console.log(require("../package.json").version);
    return;
  }
  if (cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }
  if (cmd === "remember") {
    const content = args.slice(1).join(" ");
    if (!content) {
      console.error("error: remember requires a content argument");
      process.exit(2);
    }
    const { createContainer } = require("../src/di/container.js");
    const c = createContainer({ projectRoot: process.cwd() });
    const vector = await c.embedder.embed(content);
    const id = await c.vectorStore.store({ content, vector });
    console.log(JSON.stringify({ id, mock: !c.config.useReal.includes("store") }, null, 2));
    return;
  }
  if (cmd === "recall") {
    const id = args[1];
    if (!id) {
      console.error("error: recall requires an id argument");
      process.exit(2);
    }
    const { createContainer } = require("../src/di/container.js");
    const c = createContainer({ projectRoot: process.cwd() });
    const item = await c.vectorStore.get(id);
    console.log(JSON.stringify(item, null, 2));
    return;
  }
  if (cmd === "state") {
    const { createContainer } = require("../src/di/container.js");
    const c = createContainer({ projectRoot: process.cwd() });
    const snapshot = await c.cognitiveStore.snapshot?.() ?? {
      reflection: await c.cognitiveStore.readReflection(),
      attention: await c.cognitiveStore.readAttention(),
      calibration: await c.cognitiveStore.readCalibration(),
    };
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  if (cmd === "mcp") {
    const { createContainer } = require("../src/di/container.js");
    const { createMcpServer, startStdio } = require("../src/presentation/mcp/server.js");
    const pkg = require("../package.json");
    const c = createContainer({ projectRoot: process.cwd() });
    const server = createMcpServer({
      container: c,
      info: { name: pkg.name, version: pkg.version },
    });
    await startStdio(server);
    return;
  }
  console.error(`unknown command: ${cmd}`);
  printHelp();
  process.exit(2);
})();

/**
 * MCP server — exposes ai-memory primitives as MCP tools.
 *
 * Four tools today:
 *   memory_remember   — store a content + vector
 *   memory_recall     — fetch by id
 *   memory_search     — vector similarity search
 *   memory_state      — cognitive state snapshot (reflection / attention / calibration)
 *
 * All wrap the same DI container the HTTP server uses; mock-default + real-swap
 * applies identically through MEMORY_USE_REAL.
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

function createMcpServer({ container, info = {} }) {
  const server = new McpServer({
    name: info.name || "ai-memory",
    version: info.version || "0.1.0",
  });

  // ── memory_remember ──────────────────────────────────────────
  server.registerTool(
    "memory_remember",
    {
      title: "Store a memory item",
      description:
        "Store a piece of content. The embedder converts it to a vector and the vector store persists it. Returns the assigned id.",
      inputSchema: {
        content: z.string().describe("The text content to remember"),
        metadata: z.record(z.string(), z.any()).optional().describe("Optional metadata to attach"),
      },
    },
    async (args) => {
      const vector = await container.embedder.embed(args.content);
      const id = await container.vectorStore.store({
        content: args.content,
        vector,
        metadata: args.metadata || {},
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ id, content: args.content, mock: !container.config.useReal.includes("store") }, null, 2),
        }],
      };
    },
  );

  // ── memory_recall ────────────────────────────────────────────
  server.registerTool(
    "memory_recall",
    {
      title: "Recall a memory by id",
      description:
        "Fetch a previously-stored memory item by its id. Returns null if the id is unknown.",
      inputSchema: {
        id: z.string().describe("The memory item id"),
      },
    },
    async (args) => {
      const item = await container.vectorStore.get(args.id);
      return {
        content: [{ type: "text", text: JSON.stringify(item, null, 2) }],
      };
    },
  );

  // ── memory_search ────────────────────────────────────────────
  server.registerTool(
    "memory_search",
    {
      title: "Search memory by similarity",
      description:
        "Embed the query and return the top-k most similar memory items. With the default mock, similarity is computed on hash-derived synthetic vectors — stable but not semantic. Real semantic search requires MEMORY_USE_REAL=embedder,store.",
      inputSchema: {
        query: z.string().describe("The search query"),
        topK: z.number().int().positive().optional().describe("How many results (default 5)"),
      },
    },
    async (args) => {
      const queryVector = await container.embedder.embed(args.query);
      const results = await container.vectorStore.search(queryVector, { topK: args.topK || 5 });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ count: results.length, results }, null, 2),
        }],
      };
    },
  );

  // ── memory_state ─────────────────────────────────────────────
  server.registerTool(
    "memory_state",
    {
      title: "Snapshot of cognitive state",
      description:
        "Returns reflection / attention / calibration — PROTOCOL-12 cognitive continuity surface. Useful for showing the agent its own current state of mind across sessions.",
      inputSchema: {},
    },
    async () => {
      const snapshot = await container.cognitiveStore.snapshot?.() ?? {
        reflection: await container.cognitiveStore.readReflection(),
        attention: await container.cognitiveStore.readAttention(),
        calibration: await container.cognitiveStore.readCalibration(),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }],
      };
    },
  );

  return server;
}

async function startStdio(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

module.exports = { createMcpServer, startStdio };

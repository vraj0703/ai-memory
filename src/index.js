/**
 * Raj Sadan Memory v2 — Entry Point
 *
 * Vector store (SQLite + Ollama embeddings), strategy learning,
 * cognitive state persistence. The self-evolving backbone.
 *
 * Start:  node memory/index.js
 * Test:   node --test memory/domain/use_cases/*.test.js
 * Health: curl http://127.0.0.1:3488/health
 * Store:  curl -X POST http://127.0.0.1:3488/store -H "Content-Type: application/json" -d '{"content":"test memory","collection":"decisions"}'
 * Recall: curl -X POST http://127.0.0.1:3488/recall -H "Content-Type: application/json" -d '{"query":"test","collection":"decisions"}'
 */

const path = require("path");
const { createContainer } = require("./di/container");
const { MemoryController } = require("./presentation/state_management/controllers/memory_controller");
const { createServer } = require("./presentation/pages/server");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PORT = parseInt(process.env.MEMORY_PORT) || 3488;

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║     Raj Sadan Memory v2              ║");
  console.log("║     Vector Store · Strategies · Self  ║");
  console.log("╚══════════════════════════════════════╝");
  console.log();

  const container = createContainer({ projectRoot: PROJECT_ROOT, port: PORT });
  const memory = new MemoryController(container);

  console.log(`[memory-v2] SQLite DB: ${container.config.dbPath}`);
  console.log(`[memory-v2] Embedding model: ${container.embedder.model}`);

  const { listen } = createServer({ memory, port: PORT });
  await listen();

  const shutdown = () => {
    console.log("\n[memory-v2] shutting down...");
    container.vectorStore.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(err => { console.error("[memory-v2] fatal:", err); process.exit(1); });

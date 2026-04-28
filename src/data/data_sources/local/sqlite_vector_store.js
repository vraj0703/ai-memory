/**
 * SQLiteVectorStore — vector storage backed by better-sqlite3.
 *
 * Stores embeddings as BLOBs, does brute-force cosine similarity search.
 * For <10K vectors this runs in ~1ms. No additional native extension needed.
 */

const path = require("path");
const { IVectorStore } = require("../../../domain/repositories/i_vector_store");
const { MemoryItem } = require("../../../domain/entities/memory_item");

class SQLiteVectorStore extends IVectorStore {
  constructor(opts = {}) {
    super();
    const Database = require("better-sqlite3");
    const dbPath = opts.dbPath || path.resolve(process.cwd(), "memory", "data", "data_sources", "local", "memory.db");
    require("fs").mkdirSync(path.dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_collection ON embeddings(collection);
    `);
  }

  async store(item) {
    const embBuf = Buffer.from(new Float32Array(item.embedding).buffer);
    this.db.prepare(`
      INSERT OR REPLACE INTO embeddings (id, collection, content, embedding, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(item.id, item.collection, item.content, embBuf, JSON.stringify(item.metadata), item.createdAt);
  }

  async search(queryEmbedding, collection, topK = 5) {
    const rows = this.db.prepare(
      `SELECT id, collection, content, embedding, metadata, created_at FROM embeddings WHERE collection = ?`
    ).all(collection);

    const queryArr = queryEmbedding instanceof Float32Array ? queryEmbedding : new Float32Array(queryEmbedding);

    const scored = rows.map(row => {
      const emb = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
      const similarity = cosineSimilarity(queryArr, emb);
      return {
        item: new MemoryItem({
          id: row.id,
          collection: row.collection,
          content: row.content,
          embedding: emb,
          metadata: JSON.parse(row.metadata || "{}"),
          createdAt: row.created_at,
        }),
        similarity,
      };
    });

    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  async delete(id) {
    this.db.prepare(`DELETE FROM embeddings WHERE id = ?`).run(id);
  }

  async count(collection) {
    const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM embeddings WHERE collection = ?`).get(collection);
    return row.cnt;
  }

  close() {
    this.db.close();
  }
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

module.exports = { SQLiteVectorStore };

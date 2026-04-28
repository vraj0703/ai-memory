/**
 * InMemoryVectorStore — default mock for SQLiteVectorStore.
 *
 * Map-backed; lost on restart. Implements naive cosine-similarity search
 * so search_memory returns sensible results without sqlite-vss.
 */

class InMemoryVectorStore {
  constructor() {
    this._items = new Map(); // id -> { id, content, vector, metadata, created_at }
  }

  async store({ id, content, vector, metadata = {} }) {
    const item = {
      id: id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      vector: vector || [],
      metadata: { ...metadata, mock: true },
      created_at: new Date().toISOString(),
    };
    this._items.set(item.id, item);
    return item.id;
  }

  async get(id) {
    return this._items.get(id) || null;
  }

  async list({ limit = 100 } = {}) {
    return Array.from(this._items.values()).slice(-limit);
  }

  async search(queryVector, { topK = 5 } = {}) {
    const items = Array.from(this._items.values());
    if (!queryVector || queryVector.length === 0) {
      return items.slice(-topK).map((i) => ({ ...i, similarity: 0 }));
    }
    return items
      .map((i) => ({ ...i, similarity: _cosine(queryVector, i.vector) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  async clear() {
    this._items.clear();
  }
}

function _cosine(a, b) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

module.exports = { InMemoryVectorStore };

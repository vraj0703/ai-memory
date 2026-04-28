/**
 * StubEmbeddingProvider — default mock for OllamaEmbeddingProvider.
 *
 * Deterministic synthetic vectors (hash-derived). Not semantic, but stable —
 * the same input always produces the same vector, so similarity-based recall
 * still works in tests + standalone runs without Ollama.
 */

const { EMBEDDING_DIMENSIONS } = require("../../../domain/constants");

class StubEmbeddingProvider {
  constructor({ dimensions = EMBEDDING_DIMENSIONS } = {}) {
    this._dim = dimensions;
  }

  async embed(text) {
    const vec = new Array(this._dim).fill(0);
    if (!text) return vec;
    // FNV-1a-ish hash spread across dimensions.
    for (let i = 0; i < text.length; i++) {
      const idx = (text.charCodeAt(i) * 31 + i) % this._dim;
      vec[idx] += (text.charCodeAt(i) % 17) / 100;
    }
    // Normalize so cosine similarity behaves.
    let mag = 0;
    for (const v of vec) mag += v * v;
    mag = Math.sqrt(mag) || 1;
    return vec.map((v) => v / mag);
  }

  async health() {
    return { status: "mock", mock: true };
  }
}

module.exports = { StubEmbeddingProvider };

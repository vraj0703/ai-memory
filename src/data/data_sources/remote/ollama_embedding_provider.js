/**
 * OllamaEmbeddingProvider — generates embeddings via Ollama's /api/embed endpoint.
 *
 * Uses nomic-embed-text:v1.5 (768 dimensions, already pulled).
 */

const { IEmbeddingProvider } = require("../../../domain/repositories/i_embedding_provider");
const { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, OLLAMA_EMBED_URL } = require("../../../domain/constants");
const { EmbeddingError } = require("../../../domain/exceptions");

class OllamaEmbeddingProvider extends IEmbeddingProvider {
  constructor(opts = {}) {
    super();
    this.model = opts.model || EMBEDDING_MODEL;
    this.url = opts.url || OLLAMA_EMBED_URL;
    this._dimensions = opts.dimensions || EMBEDDING_DIMENSIONS;
  }

  get dimensions() { return this._dimensions; }

  async embed(text) {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: text }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new EmbeddingError(`Ollama returned ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      // Ollama returns { embeddings: [[...]] } for single input
      const raw = data.embeddings?.[0] || data.embedding;
      if (!raw || !Array.isArray(raw)) {
        throw new EmbeddingError("No embedding in response");
      }

      return new Float32Array(raw);
    } catch (err) {
      if (err instanceof EmbeddingError) throw err;
      throw new EmbeddingError(err.message);
    }
  }

  async embedBatch(texts) {
    // Ollama supports batch via input array
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        throw new EmbeddingError(`Ollama batch returned ${res.status}`);
      }

      const data = await res.json();
      const embeddings = data.embeddings || [];
      return embeddings.map(e => new Float32Array(e));
    } catch (err) {
      if (err instanceof EmbeddingError) throw err;
      throw new EmbeddingError(err.message);
    }
  }
}

module.exports = { OllamaEmbeddingProvider };

/**
 * RecallMemory — semantic search over stored memories.
 */
const { SIMILARITY_THRESHOLD, DEFAULT_TOP_K } = require("../constants");

/**
 * @param {object} params
 * @param {string} params.query        - natural language query
 * @param {string} params.collection   - which collection to search
 * @param {number} [params.topK]
 * @param {number} [params.threshold]  - minimum similarity
 * @param {import('../repositories/i_embedding_provider').IEmbeddingProvider} params.embedder
 * @param {import('../repositories/i_vector_store').IVectorStore} params.store
 * @returns {Promise<{item: import('../entities/memory_item').MemoryItem, similarity: number}[]>}
 */
async function recallMemory({ query, collection, topK, threshold, embedder, store }) {
  const queryEmbedding = await embedder.embed(query);
  const results = await store.search(queryEmbedding, collection, topK || DEFAULT_TOP_K);
  const minSim = threshold ?? SIMILARITY_THRESHOLD;
  return results.filter(r => r.similarity >= minSim);
}

module.exports = { recallMemory };

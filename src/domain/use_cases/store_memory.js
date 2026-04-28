/**
 * StoreMemory — embed content and persist in vector store.
 */
const { MemoryItem } = require("../entities/memory_item");

/**
 * @param {object} params
 * @param {string} params.content     - text to embed and store
 * @param {string} params.collection  - which collection
 * @param {object} [params.metadata]
 * @param {string} [params.id]
 * @param {import('../repositories/i_embedding_provider').IEmbeddingProvider} params.embedder
 * @param {import('../repositories/i_vector_store').IVectorStore} params.store
 * @returns {Promise<MemoryItem>}
 */
async function storeMemory({ content, collection, metadata, id, embedder, store }) {
  const embedding = await embedder.embed(content);
  const item = new MemoryItem({
    id: id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    collection,
    content,
    embedding,
    metadata,
  });
  await store.store(item);
  return item;
}

module.exports = { storeMemory };

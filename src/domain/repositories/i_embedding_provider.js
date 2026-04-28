/**
 * IEmbeddingProvider — abstract interface for generating text embeddings.
 */
class IEmbeddingProvider {
  /**
   * @param {string} text
   * @returns {Promise<Float32Array>}
   */
  async embed(text) { throw new Error("not implemented"); }

  /**
   * @param {string[]} texts - batch embed
   * @returns {Promise<Float32Array[]>}
   */
  async embedBatch(texts) { throw new Error("not implemented"); }

  /** @returns {number} dimension of the embedding vector */
  get dimensions() { throw new Error("not implemented"); }
}

module.exports = { IEmbeddingProvider };

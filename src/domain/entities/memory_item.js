/**
 * MemoryItem — a stored piece of knowledge with a vector embedding.
 *
 * Everything memory stores gets embedded for semantic search:
 * decisions, strategies, knowledge manifests, cognitive state snapshots.
 */

const VALID_COLLECTIONS = ["decisions", "knowledge", "strategies", "cognitive", "outcomes"];

class MemoryItem {
  /**
   * @param {object} raw
   * @param {string} raw.id
   * @param {string} raw.collection  - "decisions" | "knowledge" | "strategies" | "cognitive" | "outcomes"
   * @param {string} raw.content     - the text that was embedded
   * @param {Float32Array|number[]} [raw.embedding] - vector (null until embedded)
   * @param {object} [raw.metadata]  - arbitrary JSON metadata
   * @param {string} [raw.createdAt]
   */
  constructor(raw) {
    if (!raw.id) throw new Error("MemoryItem id is required");
    if (!raw.collection || !VALID_COLLECTIONS.includes(raw.collection)) {
      throw new Error(`Invalid collection "${raw.collection}". Must be one of: ${VALID_COLLECTIONS.join(", ")}`);
    }
    if (!raw.content || typeof raw.content !== "string") {
      throw new Error("MemoryItem content must be a non-empty string");
    }

    this.id = raw.id;
    this.collection = raw.collection;
    this.content = raw.content;
    this.embedding = raw.embedding || null;
    this.metadata = raw.metadata || {};
    this.createdAt = raw.createdAt || new Date().toISOString();
  }

  hasEmbedding() {
    return this.embedding !== null && this.embedding.length > 0;
  }
}

module.exports = { MemoryItem, VALID_COLLECTIONS };

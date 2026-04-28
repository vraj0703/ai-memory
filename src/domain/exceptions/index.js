class MemoryError extends Error {
  constructor(message, code) { super(message); this.name = "MemoryError"; this.code = code; }
}
class EmbeddingError extends MemoryError {
  constructor(detail) { super(`Embedding failed: ${detail}`, "EMBEDDING_FAILED"); }
}
class StoreError extends MemoryError {
  constructor(detail) { super(`Store error: ${detail}`, "STORE_ERROR"); }
}
class StrategyNotFoundError extends MemoryError {
  constructor(id) { super(`Strategy "${id}" not found`, "STRATEGY_NOT_FOUND"); this.strategyId = id; }
}

module.exports = { MemoryError, EmbeddingError, StoreError, StrategyNotFoundError };

module.exports = {
  EMBEDDING_MODEL: "nomic-embed-text:v1.5",
  EMBEDDING_DIMENSIONS: 768,
  OLLAMA_EMBED_URL: "http://localhost:11434/api/embed",
  STRATEGY_DECAY_HALF_LIFE_DAYS: 30,
  STRATEGY_REINFORCE_RATE: 0.1,
  STRATEGY_WEAKEN_RATE: 0.05,
  SIMILARITY_THRESHOLD: 0.7,
  DEFAULT_TOP_K: 5,
  MEMORY_PORT: 3488,
  DB_PATH: "memory/data/data_sources/local/memory.db",
  NEXTCLOUD_HOST: "http://100.108.180.118:3481",
};

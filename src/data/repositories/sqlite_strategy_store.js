/**
 * SQLiteStrategyStore — persists strategies in SQLite alongside vector store.
 */
const path = require("path");
const { IStrategyStore } = require("../../domain/repositories/i_strategy_store");
const { Strategy } = require("../../domain/entities/strategy");

class SQLiteStrategyStore extends IStrategyStore {
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
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        action TEXT NOT NULL,
        weight REAL DEFAULT 0.5,
        successes INTEGER DEFAULT 0,
        failures INTEGER DEFAULT 0,
        last_used TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  async loadAll() {
    const rows = this.db.prepare(`SELECT * FROM strategies ORDER BY weight DESC`).all();
    return rows.map(r => new Strategy({
      id: r.id, pattern: r.pattern, action: r.action,
      weight: r.weight, successes: r.successes, failures: r.failures,
      lastUsed: r.last_used, createdAt: r.created_at,
    }));
  }

  async save(strategy) {
    this.db.prepare(`
      INSERT OR REPLACE INTO strategies (id, pattern, action, weight, successes, failures, last_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(strategy.id, strategy.pattern, strategy.action, strategy.weight,
      strategy.successes, strategy.failures, strategy.lastUsed, strategy.createdAt);
  }

  async update(id, action) {
    const rows = this.db.prepare(`SELECT * FROM strategies WHERE id = ?`).all(id);
    if (rows.length === 0) return;
    const s = new Strategy({
      id: rows[0].id, pattern: rows[0].pattern, action: rows[0].action,
      weight: rows[0].weight, successes: rows[0].successes, failures: rows[0].failures,
      lastUsed: rows[0].last_used, createdAt: rows[0].created_at,
    });
    const updated = action === "reinforce" ? s.reinforce() : s.weaken();
    await this.save(updated);
  }

  async decayAll(halfLifeDays = 30) {
    const all = await this.loadAll();
    for (const s of all) {
      const decayed = s.decay(halfLifeDays);
      if (decayed.weight !== s.weight) await this.save(decayed);
    }
  }
}

module.exports = { SQLiteStrategyStore };

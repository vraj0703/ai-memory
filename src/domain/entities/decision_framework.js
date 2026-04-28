/**
 * DecisionFramework — a recurring decision pattern with Hebbian learning.
 *
 * Mr. V recognizes repeated decision patterns (e.g., "build vs buy", "sql vs nosql")
 * and reinforces frameworks that lead to good outcomes, weakens ones that don't,
 * and lets unused frameworks decay over time.
 *
 * Mirrors the Strategy entity's Hebbian pattern — immutable, returns new instances.
 */

class DecisionFramework {
  /**
   * @param {object} raw
   * @param {string} raw.id              - unique framework id (e.g., "build_vs_buy")
   * @param {string} raw.name            - human-readable name
   * @param {string} [raw.description]   - one-line description
   * @param {number} [raw.weight=0.5]    - 0.0 to 1.0, higher = more trusted
   * @param {number} [raw.successes=0]
   * @param {number} [raw.failures=0]
   * @param {string} [raw.lastUsed]
   * @param {string} [raw.createdAt]
   */
  constructor(raw) {
    if (!raw.id) throw new Error("DecisionFramework id is required");
    if (!raw.name) throw new Error("DecisionFramework name is required");

    this.id = raw.id;
    this.name = raw.name;
    this.description = raw.description || "";
    this.weight = typeof raw.weight === "number" ? Math.max(0.05, Math.min(1, raw.weight)) : 0.5;
    this.successes = raw.successes || 0;
    this.failures = raw.failures || 0;
    this.lastUsed = raw.lastUsed || null;
    this.createdAt = raw.createdAt || new Date().toISOString();
  }

  /** Hebbian reinforcement — logarithmic dampening near 1.0. */
  reinforce() {
    return new DecisionFramework({
      ...this,
      weight: Math.min(1, this.weight + 0.1 * (1 - this.weight)),
      successes: this.successes + 1,
      lastUsed: new Date().toISOString(),
    });
  }

  /** Linear weakening, floors at 0.05 to avoid total erasure. */
  weaken() {
    return new DecisionFramework({
      ...this,
      weight: Math.max(0.05, this.weight - 0.05),
      failures: this.failures + 1,
      lastUsed: new Date().toISOString(),
    });
  }

  /** Time-based exponential decay. */
  decay(halfLifeDays = 30) {
    if (!this.lastUsed) return this;
    const daysSince = (Date.now() - new Date(this.lastUsed).getTime()) / 86_400_000;
    if (daysSince < 1) return this;
    const factor = Math.pow(0.5, daysSince / halfLifeDays);
    return new DecisionFramework({
      ...this,
      weight: Math.max(0.05, this.weight * factor),
    });
  }

  confidence() {
    const total = this.successes + this.failures;
    if (total === 0) return 0;
    return this.successes / total;
  }

  score() {
    return this.weight * (0.5 + 0.5 * this.confidence());
  }
}

module.exports = { DecisionFramework };

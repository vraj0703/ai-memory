/**
 * Strategy — a learned pattern for handling situations.
 *
 * Strategies are reinforced on success and weakened on failure,
 * with time-based decay (Hebbian learning with half-life).
 *
 * Example: "When whatsapp is down and process_not_running, restart via port-kill-first"
 */

class Strategy {
  /**
   * @param {object} raw
   * @param {string} raw.id
   * @param {string} raw.pattern     - what situation this applies to (semantic key)
   * @param {string} raw.action      - what to do when pattern matches
   * @param {number} [raw.weight=0.5]  - 0.0 to 1.0, higher = more trusted
   * @param {number} [raw.successes=0]
   * @param {number} [raw.failures=0]
   * @param {string} [raw.lastUsed]
   * @param {string} [raw.createdAt]
   */
  constructor(raw) {
    if (!raw.id) throw new Error("Strategy id is required");
    if (!raw.pattern) throw new Error("Strategy pattern is required");
    if (!raw.action) throw new Error("Strategy action is required");

    this.id = raw.id;
    this.pattern = raw.pattern;
    this.action = raw.action;
    this.weight = typeof raw.weight === "number" ? Math.max(0, Math.min(1, raw.weight)) : 0.5;
    this.successes = raw.successes || 0;
    this.failures = raw.failures || 0;
    this.lastUsed = raw.lastUsed || null;
    this.createdAt = raw.createdAt || new Date().toISOString();
  }

  reinforce() {
    return new Strategy({
      ...this,
      weight: Math.min(1, this.weight + 0.1 * (1 - this.weight)),
      successes: this.successes + 1,
      lastUsed: new Date().toISOString(),
    });
  }

  weaken() {
    return new Strategy({
      ...this,
      weight: Math.max(0, this.weight - 0.05),
      failures: this.failures + 1,
      lastUsed: new Date().toISOString(),
    });
  }

  decay(halfLifeDays = 30) {
    if (!this.lastUsed) return this;
    const daysSince = (Date.now() - new Date(this.lastUsed).getTime()) / 86_400_000;
    const factor = Math.pow(0.5, daysSince / halfLifeDays);
    return new Strategy({
      ...this,
      weight: Math.max(0, this.weight * factor),
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

module.exports = { Strategy };

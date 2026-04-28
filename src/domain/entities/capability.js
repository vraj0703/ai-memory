/**
 * Capability — a registered tool/API/service in the knowledge system.
 *
 * Each capability has a TOML manifest describing what it does,
 * how to access it, who uses it, and usage stats.
 */

const VALID_TIERS = ["T0-System", "T1-API", "T2-Local", "T3-SaaS"];
const VALID_STATUSES = ["enabled", "disabled", "evaluated-candidate", "parked", "rejected"];

class Capability {
  constructor(raw) {
    if (!raw.id) throw new Error("Capability id is required");

    this.id = raw.id;
    this.name = raw.name || raw.id;
    this.url = raw.url || null;
    this.tier = raw.tier || "T1-API";
    this.status = VALID_STATUSES.includes(raw.status) ? raw.status : "enabled";
    this.free = raw.free !== false;
    this.category = raw.category || "uncategorized";
    this.description = raw.description || "";

    // Integration
    this.method = raw.method || null;      // "api" | "binary" | "python-library"
    this.authType = raw.authType || null;   // "api-key" | "oauth" | "none"
    this.adapter = raw.adapter || null;     // path to adapter file

    // Consumers
    this.ministers = raw.ministers || [];
    this.sherpas = raw.sherpas || [];

    // Usage
    this.useCount = raw.useCount || 0;
    this.lastUsed = raw.lastUsed || null;

    // Evaluation (for parked/rejected tools)
    this.evaluation = raw.evaluation || null;
  }

  isActive() {
    return this.status === "enabled";
  }

  isParked() {
    return this.status === "parked" || this.status === "evaluated-candidate";
  }

  matchesQuery(query) {
    const q = query.toLowerCase();
    return this.name.toLowerCase().includes(q)
      || this.description.toLowerCase().includes(q)
      || this.category.toLowerCase().includes(q)
      || this.id.toLowerCase().includes(q);
  }
}

module.exports = { Capability, VALID_TIERS, VALID_STATUSES };

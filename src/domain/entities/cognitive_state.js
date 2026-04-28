/**
 * CognitiveState — Mr. V's self-awareness across sessions.
 *
 * Bundles: reflection (what happened), attention (what to focus on next),
 * calibration (known biases and adjustments).
 *
 * Brief format is the human-readable export for injection into the next
 * session's boot prompt (PROTOCOL-12 Cognitive Continuity).
 */

class CognitiveState {
  constructor(raw = {}) {
    this.reflection = raw.reflection || {};
    this.attention = raw.attention || {};
    this.calibration = raw.calibration || {};
    this.lastUpdated = raw.lastUpdated || new Date().toISOString();
  }

  /**
   * Produce a structured human-readable brief for the next session.
   * Sections are emitted only when they have content.
   */
  getBrief({ recentDecisions = [], frameworks = [] } = {}) {
    const lines = [];
    let hasContent = false;

    // ─── Reflection ───
    if (this._nonEmpty(this.reflection)) {
      hasContent = true;
      lines.push("COGNITIVE CONTINUITY (Mr. V's own words from previous session):");
      lines.push("");
      lines.push("LAST SESSION REFLECTION:");
      const r = this.reflection;
      if (r.session) lines.push(`  Session: ${r.session}${r.writtenAt ? `, Written: ${r.writtenAt}` : ""}`);
      if (r.quality) lines.push(`  Quality: ${r.quality}`);
      if (r.achievement) lines.push(`  Achievement: ${r.achievement}`);
      if (r.struggle) lines.push(`  Struggle: ${r.struggle}`);
      if (r.surprise) lines.push(`  Surprise: ${r.surprise}`);
      if (Array.isArray(r.biasesNoticed) && r.biasesNoticed.length) {
        lines.push(`  Biases Noticed: ${r.biasesNoticed.join("; ")}`);
      }
      if (Array.isArray(r.openThreads) && r.openThreads.length) {
        lines.push("  Open Threads:");
        for (const t of r.openThreads) {
          const topic = typeof t === "string" ? t : (t.topic || "");
          const urgency = typeof t === "object" && t.urgency ? ` (${t.urgency})` : "";
          const context = typeof t === "object" && t.context ? `: ${t.context}` : "";
          lines.push(`    - ${topic}${urgency}${context}`);
        }
      }
    }

    // ─── Attention ───
    if (this._nonEmpty(this.attention)) {
      if (!hasContent) {
        lines.push("COGNITIVE CONTINUITY (Mr. V's own words from previous session):");
        hasContent = true;
      }
      lines.push("");
      lines.push("ATTENTION PRIMER (focus for this session):");
      const a = this.attention;
      if (a.likelyFirstTask) lines.push(`  Likely first task: ${a.likelyFirstTask}`);
      if (Array.isArray(a.priorities) && a.priorities.length) {
        lines.push("  Priority Focus:");
        for (const p of a.priorities) {
          const task = typeof p === "string" ? p : (p.task || p.name || "");
          const why = typeof p === "object" && p.why ? `: ${p.why}` : "";
          lines.push(`    - ${task}${why}`);
        }
      }
      if (Array.isArray(a.warnings) && a.warnings.length) {
        lines.push("  Warnings:");
        for (const w of a.warnings) lines.push(`    - ${w}`);
      }
      if (Array.isArray(a.contextSeeds) && a.contextSeeds.length) {
        lines.push("  Context Seeds:");
        for (const c of a.contextSeeds) lines.push(`    - ${c}`);
      }
    }

    // ─── Calibration ───
    if (this._nonEmpty(this.calibration)) {
      if (!hasContent) {
        lines.push("COGNITIVE CONTINUITY (Mr. V's own words from previous session):");
        hasContent = true;
      }
      lines.push("");
      lines.push("CALIBRATION (accumulated self-knowledge):");
      const c = this.calibration;
      if (Array.isArray(c.biases) && c.biases.length) {
        for (const b of c.biases) {
          if (typeof b === "string") {
            lines.push(`  Bias: ${b}`);
          } else if (b && b.description) {
            lines.push(`  Bias: ${b.description} -> ${b.mitigation || "no mitigation"}`);
          }
        }
      }
      if (Array.isArray(c.pmPreferences) && c.pmPreferences.length) {
        for (const p of c.pmPreferences) {
          if (typeof p === "string") lines.push(`  PM Pref: ${p}`);
          else if (p && p.preference) lines.push(`  PM Pref: ${p.preference}`);
        }
      }
    }

    // ─── Decision Frameworks (top 5 by score) ───
    if (Array.isArray(frameworks) && frameworks.length > 0) {
      if (!hasContent) {
        lines.push("COGNITIVE CONTINUITY (Mr. V's own words from previous session):");
        hasContent = true;
      }
      lines.push("");
      lines.push("DECISION FRAMEWORKS (top 5 by score):");
      const top = [...frameworks]
        .filter(f => f && typeof f.score === "function")
        .sort((a, b) => b.score() - a.score())
        .slice(0, 5);
      for (const f of top) {
        const conf = Math.round(f.confidence() * 100);
        lines.push(`  [${f.weight.toFixed(2)} | ${conf}% conf] ${f.name}${f.description ? ` — ${f.description}` : ""}`);
      }
    }

    // ─── Recent decisions (last 5) ───
    if (Array.isArray(recentDecisions) && recentDecisions.length > 0) {
      if (!hasContent) {
        lines.push("COGNITIVE CONTINUITY (Mr. V's own words from previous session):");
        hasContent = true;
      }
      lines.push("");
      lines.push(`RECENT DECISIONS (last ${Math.min(5, recentDecisions.length)}):`);
      for (const d of recentDecisions.slice(0, 5)) {
        const outcome = d.outcomeQuality || d.outcome_quality || (d.outcome ? "pending" : "pending");
        const type = d.type || "general";
        const what = d.what || d.title || "(no description)";
        lines.push(`  [${type}] ${what} -> ${outcome}`);
      }
    }

    return hasContent ? lines.join("\n") : "";
  }

  isEmpty() {
    return !this._nonEmpty(this.reflection)
      && !this._nonEmpty(this.attention)
      && !this._nonEmpty(this.calibration);
  }

  _nonEmpty(obj) {
    return obj && typeof obj === "object" && Object.keys(obj).length > 0;
  }
}

module.exports = { CognitiveState };

/**
 * NextCloudStateStore — concrete IRemoteStateStore over the v1 NextCloud
 * HTTP wrapper (utilities/nextcloud/server.js) running on the Pi at :3481.
 *
 * NOT a direct WebDAV client — it talks to the HTTP service which handles
 * versioning, domain scoping, and WebDAV plumbing for us.
 *
 * Native fetch + AbortSignal.timeout. Never throws on network failures;
 * returns false/null/[] and logs so callers can degrade gracefully.
 */

const { IRemoteStateStore } = require("../../../domain/repositories/i_remote_state_store");
const { NEXTCLOUD_HOST } = require("../../../domain/constants");

const HEALTH_TIMEOUT_MS = 3000;
const OP_TIMEOUT_MS = 10_000; // Pi can be slow

class NextCloudStateStore extends IRemoteStateStore {
  /**
   * @param {object} [opts]
   * @param {string} [opts.host] - NextCloud HTTP wrapper base URL (Pi :3481)
   * @param {string} [opts.domain] - Default domain (unused by interface methods, but handy)
   */
  constructor(opts = {}) {
    super();
    this.host = opts.host || NEXTCLOUD_HOST;
    this.domain = opts.domain || "raj-sadan";
  }

  async isAvailable() {
    try {
      const res = await fetch(`${this.host}/health`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      return res.ok;
    } catch (err) {
      console.log(`[memory-v2] nextcloud: health error: ${err.message}`);
      return false;
    }
  }

  async save(domain, key, data) {
    if (!domain || !key) {
      console.log("[memory-v2] nextcloud: save missing domain/key");
      return false;
    }
    try {
      const res = await fetch(`${this.host}/state/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, key, data }),
        signal: AbortSignal.timeout(OP_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.log(`[memory-v2] nextcloud: save HTTP ${res.status}`);
        return false;
      }
      const body = await res.json().catch(() => ({}));
      return body.ok === true || body.success === true || res.status === 200;
    } catch (err) {
      console.log(`[memory-v2] nextcloud: save error: ${err.message}`);
      return false;
    }
  }

  async load(domain, key) {
    if (!domain || !key) {
      console.log("[memory-v2] nextcloud: load missing domain/key");
      return null;
    }
    try {
      const url = `${this.host}/state/load?domain=${encodeURIComponent(domain)}&key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(OP_TIMEOUT_MS),
      });
      if (!res.ok) {
        if (res.status !== 404) {
          console.log(`[memory-v2] nextcloud: load HTTP ${res.status}`);
        }
        return null;
      }
      const body = await res.json();
      // Server returns either the raw data or { data: ... } — accept both.
      if (body && typeof body === "object" && "data" in body) return body.data;
      return body;
    } catch (err) {
      console.log(`[memory-v2] nextcloud: load error: ${err.message}`);
      return null;
    }
  }

  async listKeys(domain) {
    if (!domain) {
      console.log("[memory-v2] nextcloud: listKeys missing domain");
      return [];
    }
    try {
      const url = `${this.host}/state/list?domain=${encodeURIComponent(domain)}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(OP_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.log(`[memory-v2] nextcloud: listKeys HTTP ${res.status}`);
        return [];
      }
      const body = await res.json();
      if (Array.isArray(body)) return body;
      if (Array.isArray(body.keys)) return body.keys;
      return [];
    } catch (err) {
      console.log(`[memory-v2] nextcloud: listKeys error: ${err.message}`);
      return [];
    }
  }

  async listVersions(domain, key) {
    if (!domain || !key) {
      console.log("[memory-v2] nextcloud: listVersions missing domain/key");
      return [];
    }
    try {
      const url = `${this.host}/state/versions?domain=${encodeURIComponent(domain)}&key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(OP_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.log(`[memory-v2] nextcloud: listVersions HTTP ${res.status}`);
        return [];
      }
      const body = await res.json();
      if (Array.isArray(body)) return body;
      if (Array.isArray(body.versions)) return body.versions;
      return [];
    } catch (err) {
      console.log(`[memory-v2] nextcloud: listVersions error: ${err.message}`);
      return [];
    }
  }
}

module.exports = { NextCloudStateStore };

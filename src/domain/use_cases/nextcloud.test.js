const { describe, it } = require("node:test");
const assert = require("node:assert");
const { backupCognitiveState, restoreCognitiveState } = require("./backup_to_remote");

// ─── Mocks ───

class MockCognitiveStore {
  constructor() {
    this._state = {
      reflection: "what worked",
      attention: "what to watch",
      calibration: "what to adjust",
    };
  }
  async load() { return this._state; }
}

class MockRemoteStore {
  constructor({ available = true, saveResult = true, loadData = null } = {}) {
    this.available = available;
    this.saveResult = saveResult;
    this.loadData = loadData;
    this.saved = [];
  }
  async isAvailable() { return this.available; }
  async save(domain, key, data) {
    this.saved.push({ domain, key, data });
    return this.saveResult;
  }
  async load(domain, key) { return this.loadData; }
  async listKeys() { return []; }
  async listVersions() { return []; }
}

// ─── Tests ───

describe("backup_to_remote use cases", () => {
  it("backupCognitiveState: happy path writes to remote", async () => {
    const cognitiveStore = new MockCognitiveStore();
    const remoteStateStore = new MockRemoteStore();

    const result = await backupCognitiveState({ cognitiveStore, remoteStateStore });

    assert.strictEqual(result.ok, true);
    assert.ok(result.backedUpAt);
    assert.strictEqual(remoteStateStore.saved.length, 1);
    const entry = remoteStateStore.saved[0];
    assert.strictEqual(entry.domain, "cognitive");
    assert.strictEqual(entry.key, "latest");
    assert.strictEqual(entry.data.reflection, "what worked");
    assert.strictEqual(entry.data.attention, "what to watch");
    assert.strictEqual(entry.data.calibration, "what to adjust");
    assert.ok(entry.data.backedUpAt);
  });

  it("backupCognitiveState: returns skipped when remote unreachable", async () => {
    const cognitiveStore = new MockCognitiveStore();
    const remoteStateStore = new MockRemoteStore({ available: false });

    const result = await backupCognitiveState({ cognitiveStore, remoteStateStore });

    assert.strictEqual(result.skipped, true);
    assert.match(result.reason, /unreachable/);
    assert.strictEqual(remoteStateStore.saved.length, 0);
  });

  it("backupCognitiveState: returns skipped when remoteStateStore is null", async () => {
    const cognitiveStore = new MockCognitiveStore();

    const result = await backupCognitiveState({ cognitiveStore, remoteStateStore: null });

    assert.strictEqual(result.skipped, true);
    assert.match(result.reason, /no remote/);
  });

  it("restoreCognitiveState: returns data from remote", async () => {
    const payload = {
      reflection: "prior reflection",
      attention: "prior attention",
      calibration: "prior calibration",
      backedUpAt: "2026-04-10T00:00:00.000Z",
    };
    const remoteStateStore = new MockRemoteStore({ loadData: payload });

    const result = await restoreCognitiveState({ remoteStateStore });

    assert.deepStrictEqual(result, payload);
  });

  it("restoreCognitiveState: returns null when remoteStateStore is null", async () => {
    const result = await restoreCognitiveState({ remoteStateStore: null });
    assert.strictEqual(result, null);
  });
});

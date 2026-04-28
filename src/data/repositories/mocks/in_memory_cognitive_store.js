/**
 * InMemoryCognitiveStore — default mock for FileCognitiveStore.
 *
 * Holds reflection / attention / calibration in process memory instead of
 * writing JSON files to disk. PROTOCOL-12 cognitive continuity works in
 * tests without leaving artifacts behind.
 */

class InMemoryCognitiveStore {
  constructor() {
    this._state = {
      reflection: null,
      attention: null,
      calibration: null,
    };
  }

  async readReflection() {
    return this._state.reflection;
  }

  async writeReflection(payload) {
    this._state.reflection = { ...payload, ts: new Date().toISOString(), mock: true };
    return true;
  }

  async readAttention() {
    return this._state.attention;
  }

  async writeAttention(payload) {
    this._state.attention = { ...payload, ts: new Date().toISOString(), mock: true };
    return true;
  }

  async readCalibration() {
    return this._state.calibration;
  }

  async writeCalibration(payload) {
    this._state.calibration = { ...payload, ts: new Date().toISOString(), mock: true };
    return true;
  }

  async snapshot() {
    return { ...this._state };
  }
}

module.exports = { InMemoryCognitiveStore };

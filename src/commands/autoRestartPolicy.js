class AutoRestartPolicy {
  constructor() {
    this._baseDelay = 1000; // 1 second
    this._maxDelay = 30000; // 30 seconds
    this._maxRetries = 5;
    this._restartCount = 0;
  }

  get canRestart() {
    return this._restartCount < this._maxRetries;
  }

  get currentDelay() {
    const delay = this._baseDelay * Math.pow(2, this._restartCount);
    return Math.min(delay, this._maxDelay);
  }

  recordRestart() {
    this._restartCount++;
  }

  reset() {
    this._restartCount = 0;
  }

  get attempts() {
    return this._restartCount;
  }
}

module.exports = { AutoRestartPolicy };

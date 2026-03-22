class NotificationManager {
  constructor(notifier, options = {}) {
    this._notifier = notifier;
    this._cooldownMs = options.cooldownMs ?? 30000;
    this._lastNotified = new Map();
  }

  shouldNotify(status) {
    return (
      status === "waiting_for_input" ||
      status === "errored" ||
      status === "error"
    );
  }

  buildNotification(projectName, windowId, item, itemType) {
    const action =
      item.status === "waiting_for_input"
        ? "is waiting for input"
        : "has errored";
    return {
      title: "Spinup",
      body: `${item.name} ${action} in ${projectName}`,
      projectName,
      windowId,
      itemId: item.id,
      itemType,
    };
  }

  notify(projectName, windowId, item, itemType) {
    if (!this.shouldNotify(item.status)) return;

    const key = `${projectName}:${item.id}:${item.status}`;
    const now = Date.now();
    const last = this._lastNotified.get(key);
    if (last && now - last < this._cooldownMs) return;

    this._lastNotified.set(key, now);
    const notification = this.buildNotification(
      projectName,
      windowId,
      item,
      itemType,
    );
    this._notifier.send(notification);
  }
}

module.exports = { NotificationManager };

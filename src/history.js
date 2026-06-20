import { cloneJson } from "./json.js";

export class ResponseHistory {
  constructor({ maxEntries = 200 } = {}) {
    this.maxEntries = maxEntries;
    this.entries = new Map();
  }

  get(responseId) {
    if (!responseId || !this.entries.has(responseId)) {
      return [];
    }
    return cloneJson(this.entries.get(responseId));
  }

  record(responseId, chatMessages) {
    if (!responseId) {
      return;
    }
    const withoutSystem = chatMessages.filter((message) => message.role !== "system");
    this.entries.set(responseId, cloneJson(withoutSystem));
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      this.entries.delete(oldest);
    }
  }
}

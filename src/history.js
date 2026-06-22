import { cloneJson } from "./json.js";

export class ResponseHistory {
  constructor({ maxEntries = 200 } = {}) {
    this.maxEntries = maxEntries;
    this.entries = new Map();
    this.responses = new Map();
    this.responseMeta = new Map();
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
      this.responses.delete(oldest);
      this.responseMeta.delete(oldest);
    }
  }

  getResponse(responseId) {
    if (!responseId || !this.responses.has(responseId)) {
      return null;
    }
    return cloneJson(this.responses.get(responseId));
  }

  getResponseMeta(responseId) {
    if (!responseId || !this.responseMeta.has(responseId)) {
      return null;
    }
    return cloneJson(this.responseMeta.get(responseId));
  }

  recordResponse(response, meta = {}) {
    if (!response?.id) {
      return;
    }
    this.responses.set(response.id, cloneJson(response));
    this.responseMeta.set(response.id, cloneJson(meta || {}));
    while (this.responses.size > this.maxEntries) {
      const oldest = this.responses.keys().next().value;
      this.responses.delete(oldest);
      this.entries.delete(oldest);
      this.responseMeta.delete(oldest);
    }
  }
}

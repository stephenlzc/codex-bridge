import test from "node:test";
import assert from "node:assert/strict";
import { callJsonUpstream, proxyResponsesApi } from "../src/upstream.js";

test("upstream requests use HTTPS proxy dispatcher when configured", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = snapshotProxyEnv();
  let seenInit = null;

  globalThis.fetch = async (_url, init) => {
    seenInit = init;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    clearProxyEnv();
    process.env.HTTPS_PROXY = "http://127.0.0.1:7890";

    await callJsonUpstream(
      "https://api.openai.com/v1/chat/completions",
      {
        id: "gpt-5.5",
        api: "chat_completions",
        model: "gpt-5.5",
        apiKey: "test-key",
      },
      { model: "gpt-5.5" },
      {},
    );

    assert.ok(seenInit?.dispatcher, "expected fetch init to include proxy dispatcher");
  } finally {
    globalThis.fetch = originalFetch;
    restoreProxyEnv(originalEnv);
  }
});

test("codex_openai responses use ChatGPT Codex backend and forward Codex headers", async () => {
  const originalFetch = globalThis.fetch;
  const originalBackend = process.env.CODEXBRIDGE_CHATGPT_CODEX_BASE_URL;
  let seenUrl = "";
  let seenInit = null;

  globalThis.fetch = async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return new Response(
      JSON.stringify({
        id: "resp_subscription",
        object: "response",
        status: "completed",
        model: "gpt-5.5",
        output: [],
        output_text: "hello from subscription",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    process.env.CODEXBRIDGE_CHATGPT_CODEX_BASE_URL =
      "https://chatgpt.test/backend-api/codex";

    const res = collectResponse();
    await proxyResponsesApi(
      {
        model: "gpt-5.5",
        input: "hello",
        stream: true,
      },
      {
        id: "gpt-5.5",
        api: "responses",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.5",
        authMode: "codex_openai",
      },
      res,
      {
        clientAuth: {
          kind: "codex_openai",
          bearerToken: "codex-openai-token",
        },
        clientHeaders: {
          "chatgpt-account-id": "acct_123",
          "session-id": "sess_123",
          "thread-id": "thread_123",
          "x-codex-turn-state": "sticky_123",
          "x-codex-beta-features": "feature-a",
        },
      },
    );

    assert.equal(seenUrl, "https://chatgpt.test/backend-api/codex/responses");
    assert.equal(seenInit.headers.authorization, "Bearer codex-openai-token");
    assert.equal(seenInit.headers.accept, "text/event-stream");
    assert.equal(seenInit.headers["chatgpt-account-id"], "acct_123");
    assert.equal(seenInit.headers["session-id"], "sess_123");
    assert.equal(seenInit.headers["thread-id"], "thread_123");
    assert.equal(seenInit.headers["x-codex-turn-state"], "sticky_123");
    assert.equal(seenInit.headers["x-codex-beta-features"], "feature-a");
    assert.equal(JSON.parse(seenInit.body).model, "gpt-5.5");
    assert.match(res.body(), /hello from subscription/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBackend === undefined) {
      delete process.env.CODEXBRIDGE_CHATGPT_CODEX_BASE_URL;
    } else {
      process.env.CODEXBRIDGE_CHATGPT_CODEX_BASE_URL = originalBackend;
    }
  }
});

function snapshotProxyEnv() {
  const keys = proxyEnvKeys();
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function clearProxyEnv() {
  for (const key of proxyEnvKeys()) {
    delete process.env[key];
  }
}

function restoreProxyEnv(snapshot) {
  clearProxyEnv();
  for (const [key, value] of Object.entries(snapshot)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

function proxyEnvKeys() {
  return [
    "CODEXBRIDGE_HTTPS_PROXY",
    "CODEXBRIDGE_HTTP_PROXY",
    "CODEXBRIDGE_ALL_PROXY",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "ALL_PROXY",
    "https_proxy",
    "http_proxy",
    "all_proxy",
    "NO_PROXY",
    "no_proxy",
  ];
}

function collectResponse() {
  const chunks = [];
  return {
    statusCode: null,
    headers: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    write(chunk) {
      chunks.push(Buffer.from(chunk));
    },
    end(chunk) {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }
    },
    body() {
      return Buffer.concat(chunks).toString("utf8");
    },
  };
}

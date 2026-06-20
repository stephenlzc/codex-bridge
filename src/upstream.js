import { cloneJson, jsonResponse, openAiError, tryParseJson } from "./json.js";
import { authModeForRoute, joinUpstreamUrl, requireApiKey } from "./config.js";
import { responsesToChatRequest } from "./responses-to-chat.js";
import {
  assistantHistoryMessageFromChat,
  chatResponseToResponse,
  responseToSse,
} from "./chat-to-responses.js";
import { fetchInitWithProxy, proxyLogLabel } from "./proxy.js";

const CHATGPT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";

const CODEX_PASSTHROUGH_HEADERS = [
  "chatgpt-account-id",
  "x-openai-fedramp",
  "session-id",
  "thread-id",
  "x-client-request-id",
  "x-codex-beta-features",
  "x-codex-turn-state",
  "x-codex-turn-metadata",
  "x-codex-parent-thread-id",
  "x-codex-window-id",
  "x-codex-installation-id",
  "x-oai-attestation",
  "x-responsesapi-include-timing-metrics",
  "x-openai-internal-codex-responses-lite",
  "openai-beta",
  "openai-organization",
  "openai-project",
];

export class UpstreamHttpError extends Error {
  constructor(statusCode, bodyText, upstreamUrl) {
    super(`Upstream returned HTTP ${statusCode}`);
    this.statusCode = statusCode;
    this.bodyText = bodyText;
    this.upstreamUrl = upstreamUrl;
  }
}

export async function handleResponsesRequest(
  requestBody,
  route,
  history,
  res,
  context = {},
) {
  if (route.api === "responses") {
    return proxyResponsesApi(requestBody, route, res, context);
  }
  if (route.api === "chat_completions") {
    return proxyChatCompletions(requestBody, route, history, res, context);
  }
  jsonResponse(res, 500, openAiError(`Unsupported route api: ${route.api}`));
}

export async function proxyResponsesApi(requestBody, route, res, context = {}) {
  const payload = cloneJson(requestBody);
  payload.model = route.model;

  const upstreamUrl = joinUpstreamUrl(responsesBaseUrlForRoute(route), "/responses");
  logRoute(context, route, upstreamUrl);
  const upstream = await fetch(upstreamUrl, fetchInitWithProxy(upstreamUrl, {
    method: "POST",
    headers: upstreamHeaders(route, context, {
      acceptEventStream: Boolean(payload.stream),
    }),
    body: JSON.stringify(payload),
  }));
  logStatus(context, route, upstream.status);

  if (!upstream.ok) {
    const bodyText = await upstream.text();
    throw new UpstreamHttpError(upstream.status, bodyText, upstreamUrl);
  }

  res.writeHead(upstream.status, filteredHeaders(upstream.headers));
  if (!upstream.body) {
    res.end();
    return;
  }
  for await (const chunk of upstream.body) {
    res.write(Buffer.from(chunk));
  }
  res.end();
}

export async function proxyChatCompletions(
  requestBody,
  route,
  history,
  res,
  context = {},
) {
  const converted = responsesToChatRequest(requestBody, route, history);
  const upstreamUrl = joinUpstreamUrl(route.baseUrl, "/chat/completions");
  logRoute(context, route, upstreamUrl);
  const upstream = await callJsonUpstream(upstreamUrl, route, converted.body, context);
  logUsage(context, route, upstream.usage);
  const response = chatResponseToResponse(
    upstream,
    requestBody.model || route.id,
    converted.toolContext,
  );

  history.record(response.id, [
    ...converted.messagesForHistory,
    assistantHistoryMessageFromChat(upstream),
  ]);

  if (converted.wantsStream) {
    const payload = responseToSse(response);
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.end(payload);
    return;
  }

  jsonResponse(res, 200, response);
}

export async function callJsonUpstream(upstreamUrl, route, payload, context = {}) {
  const upstream = await fetch(upstreamUrl, fetchInitWithProxy(upstreamUrl, {
    method: "POST",
    headers: upstreamHeaders(route, context),
    body: JSON.stringify(payload),
  }));
  const text = await upstream.text();
  if (!upstream.ok) {
    throw new UpstreamHttpError(upstream.status, text, upstreamUrl);
  }
  const parsed = tryParseJson(text);
  if (!parsed) {
    throw new UpstreamHttpError(
      502,
      `Upstream returned non-JSON body: ${text.slice(0, 500)}`,
      upstreamUrl,
    );
  }
  return parsed;
}

export function sendUpstreamError(res, error) {
  if (error instanceof UpstreamHttpError) {
    const parsed = tryParseJson(error.bodyText);
    if (isMissingResponsesWriteScope(parsed, error.bodyText)) {
      jsonResponse(
        res,
        error.statusCode,
        openAiError(
          "Codex 登录态不能作为 OpenAI API Key 使用：上游返回缺少 api.responses.write 权限，说明请求仍然打到了 public OpenAI API，或上游把 Codex 登录态当成 Platform API Key 校验。请更新 CodexBridge 配置，让 GPT 订阅模型走 ChatGPT Codex backend。",
          error.statusCode,
          "codex_subscription_missing_api_scope",
        ),
      );
      return;
    }
    jsonResponse(
      res,
      error.statusCode,
      parsed || openAiError(error.bodyText || error.message, error.statusCode),
    );
    return;
  }

  const statusCode = error.statusCode || 500;
  jsonResponse(res, statusCode, openAiError(error.message, statusCode));
}

function isMissingResponsesWriteScope(parsedBody, rawBody) {
  const message = [
    parsedBody?.error?.message,
    parsedBody?.message,
    rawBody,
  ]
    .filter(Boolean)
    .join(" ");
  return /missing scopes?:\s*api\.responses\.write/i.test(message);
}

function upstreamHeaders(route, context = {}, options = {}) {
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${upstreamBearerToken(route, context)}`,
  };

  if (options.acceptEventStream) {
    headers.accept = "text/event-stream";
  }

  if (authModeForRoute(route) === "codex_openai") {
    addCodexPassthroughHeaders(headers, context.clientHeaders);
  }

  return headers;
}

function upstreamBearerToken(route, context = {}) {
  if (authModeForRoute(route) === "codex_openai") {
    if (context.clientAuth?.kind === "codex_openai" && context.clientAuth.bearerToken) {
      return context.clientAuth.bearerToken;
    }
    const error = new Error(
      `Route ${route.id} requires Codex/OpenAI bearer authentication.`,
    );
    error.statusCode = 401;
    throw error;
  }
  return requireApiKey(route);
}

function filteredHeaders(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    if (
      [
        "content-encoding",
        "content-length",
        "connection",
        "keep-alive",
        "transfer-encoding",
      ].includes(lower)
    ) {
      continue;
    }
    result[key] = value;
  }
  return result;
}

function responsesBaseUrlForRoute(route) {
  if (
    authModeForRoute(route) === "codex_openai" &&
    isPublicOpenAiApiBaseUrl(route.baseUrl)
  ) {
    return process.env.CODEXBRIDGE_CHATGPT_CODEX_BASE_URL || CHATGPT_CODEX_BASE_URL;
  }
  return route.baseUrl;
}

function isPublicOpenAiApiBaseUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === "api.openai.com";
  } catch {
    return false;
  }
}

function addCodexPassthroughHeaders(target, source) {
  for (const name of CODEX_PASSTHROUGH_HEADERS) {
    const value = headerValue(source, name);
    if (value) {
      target[name] = value;
    }
  }
}

function headerValue(headers, name) {
  if (!headers) {
    return "";
  }
  const value = headers[name] || headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value.find(Boolean) || "";
  }
  return typeof value === "string" ? value : "";
}

function logRoute(context, route, upstreamUrl) {
  const requestId = context.requestId || "req";
  const proxy = proxyLogLabel(upstreamUrl);
  console.log(
    `[${new Date().toISOString()}] ${requestId} -> upstream ` +
      `route=${route.id} api=${route.api} upstream_model=${route.model} ` +
      `url=${safeUrl(upstreamUrl)}` +
      (proxy ? ` proxy=${proxy}` : ""),
  );
}

function logStatus(context, route, status) {
  const requestId = context.requestId || "req";
  console.log(
    `[${new Date().toISOString()}] ${requestId} <- upstream ` +
      `route=${route.id} status=${status}`,
  );
}

function logUsage(context, route, usage) {
  const requestId = context.requestId || "req";
  if (!usage) {
    console.log(
      `[${new Date().toISOString()}] ${requestId} <- upstream ` +
        `route=${route.id} usage=(none)`,
    );
    return;
  }
  console.log(
    `[${new Date().toISOString()}] ${requestId} <- upstream ` +
      `route=${route.id} usage prompt=${usage.prompt_tokens ?? 0} ` +
      `completion=${usage.completion_tokens ?? 0} total=${usage.total_tokens ?? 0}`,
  );
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(value);
  }
}

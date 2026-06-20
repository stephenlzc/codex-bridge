import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, routeForModel } from "./config.js";
import { ResponseHistory } from "./history.js";
import {
  jsonResponse,
  openAiError,
  readJsonRequest,
} from "./json.js";
import { buildModelCatalog, openAiModelsList } from "./model-catalog.js";
import { handleResponsesRequest, sendUpstreamError } from "./upstream.js";

export function createRouterServer(config = loadConfig()) {
  const history = new ResponseHistory();
  const catalog = buildModelCatalog(config);
  const modelsList = openAiModelsList(config);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");

      if (req.method === "OPTIONS") {
        writeCors(res);
        return;
      }

      if (req.method === "GET" && url.pathname === "/health") {
        jsonResponse(res, 200, {
          ok: true,
          config: config.__path || null,
          models: config.models.map((model) => model.id),
        });
        return;
      }

      if (
        req.method === "GET" &&
        ["/v1/models", "/models"].includes(url.pathname)
      ) {
        jsonResponse(res, 200, modelsList);
        return;
      }

      if (
        req.method === "GET" &&
        ["/model-catalog.json", "/v1/model-catalog.json"].includes(url.pathname)
      ) {
        jsonResponse(res, 200, catalog);
        return;
      }

      if (
        req.method === "POST" &&
        ["/v1/responses", "/responses"].includes(url.pathname)
      ) {
        if (!isAuthorized(req, config)) {
          jsonResponse(res, 401, openAiError("Invalid router token", 401, "unauthorized"));
          return;
        }
        const body = await readJsonRequest(req);
        const route = routeForModel(config, body.model);
        const requestId = makeRequestId();
        console.log(
          `[${new Date().toISOString()}] ${requestId} <- /v1/responses ` +
            `model=${body.model || "(default)"} route=${route.id} ` +
            `api=${route.api} upstream_model=${route.model} stream=${Boolean(body.stream)} ` +
            `previous_response_id=${body.previous_response_id || "-"}`,
        );
        await handleResponsesRequest(body, route, history, res, { requestId });
        return;
      }

      jsonResponse(res, 404, openAiError(`No route for ${req.method} ${url.pathname}`, 404));
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] router error: ${error.stack || error.message}`,
      );
      sendUpstreamError(res, error);
    }
  });
}

export function startServer(config = loadConfig()) {
  const server = createRouterServer(config);
  const host = config.host || "127.0.0.1";
  const port = Number(config.port || 15722);
  server.listen(port, host, () => {
    console.log(`codex-multi-router listening on http://${host}:${port}`);
    console.log(`loaded config: ${config.__path || "(inline)"}`);
    console.log(`models: ${config.models.map((model) => model.id).join(", ")}`);
  });
  return server;
}

function isAuthorized(req, config) {
  if (!config.authToken) {
    return true;
  }
  return req.headers.authorization === `Bearer ${config.authToken}`;
}

function writeCors(res) {
  res.writeHead(204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
  });
  res.end();
}

function makeRequestId() {
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

const thisFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (path.resolve(thisFile) === invokedFile) {
  startServer();
}

const DEFAULT_429_COOLDOWN_MS = 10_000;

const states = new Map();

let clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export async function waitForRouteCapacity(route = {}, context = {}) {
  const state = stateForRoute(route);
  state.queue = state.queue
    .catch(() => {})
    .then(() => reserveRouteCapacity(state, route, context));
  return state.queue;
}

export function markRouteRateLimited(route = {}, headers) {
  const state = stateForRoute(route);
  const cooldownMs = retryAfterMs(headers) || Number(route.cooldownMs) || DEFAULT_429_COOLDOWN_MS;
  const cooldownUntil = clock.now() + Math.max(0, cooldownMs);
  state.cooldownUntil = Math.max(state.cooldownUntil || 0, cooldownUntil);
}

export function __setRateLimitClockForTests(nextClock) {
  clock = {
    now: nextClock?.now || clock.now,
    sleep: nextClock?.sleep || clock.sleep,
  };
}

export function __resetRateLimiterForTests() {
  states.clear();
  clock = {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

async function reserveRouteCapacity(state, route, context) {
  await waitUntil(state.cooldownUntil || 0);
  await waitUntil(state.nextAt || 0);

  const intervalMs = routeIntervalMs(route);
  if (intervalMs <= 0) {
    return;
  }

  const now = clock.now();
  state.nextAt = now + intervalMs;

  if (context.requestId) {
    console.log(
      `[${new Date().toISOString()}] ${context.requestId} rate-limit ` +
        `route=${route.id || route.model || "unknown"} next_after_ms=${intervalMs}`,
    );
  }
}

async function waitUntil(timestamp) {
  const waitMs = Math.max(0, Number(timestamp || 0) - clock.now());
  if (waitMs > 0) {
    await clock.sleep(waitMs);
  }
}

function routeIntervalMs(route = {}) {
  const rpm = Number(route.rpm || route.rateLimit?.rpm || 0);
  if (!Number.isFinite(rpm) || rpm <= 0) {
    return 0;
  }
  return Math.ceil(60_000 / rpm);
}

function stateForRoute(route = {}) {
  const key = rateLimitKey(route);
  if (!states.has(key)) {
    states.set(key, {
      queue: Promise.resolve(),
      nextAt: 0,
      cooldownUntil: 0,
    });
  }
  return states.get(key);
}

function rateLimitKey(route = {}) {
  const authMode = route.authMode || "api_key";
  const provider = route.provider || route.providerId || "";
  const baseUrl = route.baseUrl || "";
  const keyRef = route.rateLimitKey || route.apiKeyEnv || route.keyEnv || (route.apiKey ? "inline-api-key" : "");

  if (provider || baseUrl || keyRef) {
    return [authMode, provider, baseUrl, keyRef].join("|");
  }

  return [route.id || "", route.model || ""].join("|");
}

function retryAfterMs(headers) {
  const value = headerValue(headers, "retry-after");
  if (!value) {
    return 0;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const timestamp = Date.parse(value);
  if (Number.isFinite(timestamp)) {
    return Math.max(0, timestamp - clock.now());
  }

  return 0;
}

function headerValue(headers, name) {
  if (!headers) {
    return "";
  }
  if (typeof headers.get === "function") {
    return headers.get(name) || "";
  }
  const lower = name.toLowerCase();
  return headers[name] || headers[lower] || "";
}

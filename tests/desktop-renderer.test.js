import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererSource = readFileSync(resolve(__dirname, "../desktop/renderer/app.js"), "utf8");
const htmlSource = readFileSync(resolve(__dirname, "../desktop/renderer/index.html"), "utf8");
const preloadSource = readFileSync(resolve(__dirname, "../desktop/preload.cjs"), "utf8");

test("desktop renderer keeps starting health state out of failed styling", () => {
  assert.match(rendererSource, /const isStarting = Boolean\(health\?\.starting\);/);
  assert.match(
    rendererSource,
    /classList\.toggle\("bad", Boolean\(health && !health\.ok && !isStarting\)\);/,
  );
  assert.match(rendererSource, /Router 正在启动/);
});

test("desktop renderer exposes update from sidebar without a dedicated page", () => {
  assert.doesNotMatch(htmlSource, /data-section="updates"/);
  assert.doesNotMatch(htmlSource, /id="updates"/);
  assert.match(htmlSource, /id="checkUpdates"/);
  assert.doesNotMatch(htmlSource, /id="installUpdate"/);
  assert.match(preloadSource, /checkForUpdates: \(\) => ipcRenderer\.invoke\("updates:check"\)/);
  assert.match(preloadSource, /installUpdate: \(\) => ipcRenderer\.invoke\("updates:install"\)/);
  assert.match(rendererSource, /api\.checkForUpdates\(\)/);
  assert.match(rendererSource, /api\.installUpdate\(\)/);
  assert.match(rendererSource, /window\.confirm/);
});

test("desktop renderer wires Kimi provider baseUrl override UI", () => {
  assert.match(preloadSource, /setProviderBaseUrl: \(payload\) => ipcRenderer\.invoke\("providers:setBaseUrl", payload\)/);
  assert.match(preloadSource, /resetProviderBaseUrl: \(payload\) => ipcRenderer\.invoke\("providers:resetBaseUrl", payload\)/);
  assert.match(rendererSource, /data-save-provider-base-url/);
  assert.match(rendererSource, /data-reset-provider-base-url/);
  assert.match(rendererSource, /api\.setProviderBaseUrl\(/);
  assert.match(rendererSource, /api\.resetProviderBaseUrl\(/);
  assert.match(rendererSource, /supportsBaseUrlOverride/);
  assert.match(rendererSource, /isLikelyHttpUrl/);
});

test("desktop renderer advertises all three Moonshot / Kimi endpoints and the unsupported Anthropic path", () => {
  // The hint copy and datalist both enumerate the supported endpoints; verify
  // they agree so the user sees the same options in the inline hint and the
  // auto-complete dropdown. Also verify the Anthropic-incompatible note is
  // present so users aren't surprised by the missing /coding/v1/messages path.
  const endpoints = [
    "https://api.moonshot.cn/v1",
    "https://api.moonshot.ai/v1",
    "https://api.kimi.com/coding/v1",
  ];
  for (const endpoint of endpoints) {
    assert.match(
      rendererSource,
      new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `renderer should reference endpoint ${endpoint}`,
    );
  }
  assert.match(rendererSource, /\/coding\/v1\/messages/);
  assert.match(rendererSource, /Anthropic[^"]*不支持/);
});

test("desktop renderer keeps the reset-to-default button disabled until an override exists", () => {
  // The rendered template renders the "恢复默认" button with `disabled` when
  // baseUrlOverride is falsy; verify the template literal interpolates the
  // condition so the button is correct on first paint (before the user clicks
  // "保存" to set an override).
  assert.match(
    rendererSource,
    /data-reset-provider-base-url="\$\{escapeHtml\(provider\.id\)\}" \$\{provider\.baseUrlOverride \? "" : "disabled"\}/,
  );
});

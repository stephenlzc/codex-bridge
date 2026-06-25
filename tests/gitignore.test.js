import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const gitignorePath = join(repoRoot, ".gitignore");

function readGitignore() {
  return readFileSync(gitignorePath, "utf8");
}

test("gitignore excludes user config: router.config.json", () => {
  const lines = readGitignore().split(/\r?\n/);
  assert.ok(
    lines.includes("config/router.config.json"),
    "config/router.config.json must be gitignored to avoid leaking user API keys/paths"
  );
});

test("gitignore excludes user config: provider-overrides.json", () => {
  const lines = readGitignore().split(/\r?\n/);
  assert.ok(
    lines.includes("config/provider-overrides.json"),
    "config/provider-overrides.json must be gitignored to avoid leaking user baseUrl overrides"
  );
});

test("gitignore excludes secrets.local.json", () => {
  const lines = readGitignore().split(/\r?\n/);
  assert.ok(
    lines.includes("config/secrets.local.json"),
    "config/secrets.local.json must be gitignored"
  );
});
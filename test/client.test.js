import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { DEFAULT_ENDPOINT, DeployToAgentsClient } from "../src/index.js";

test("uses the canonical remote MCP endpoint", () => {
  const client = new DeployToAgentsClient();
  assert.equal(DEFAULT_ENDPOINT, "https://deploytoagents.com/mcp");
  assert.equal(client.endpoint.toString(), DEFAULT_ENDPOINT);
});

test("rejects cleartext non-local MCP endpoints", () => {
  assert.throws(
    () => new DeployToAgentsClient({ endpoint: "http://example.com/mcp" }),
    /must use HTTPS/,
  );
});

test("allows local development endpoints", () => {
  const client = new DeployToAgentsClient({ endpoint: "http://localhost:3000/mcp" });
  assert.equal(client.endpoint.hostname, "localhost");
});

test("publishes agent-first CLI executables", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(manifest.bin.deploytoagents, "./src/cli.js");
  assert.equal(manifest.bin.d2a, "./src/cli.js");
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const help = execFileSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  assert.match(help, /d2a login/);
  assert.match(help, /d2a portfolio/);
  assert.match(help, /d2a discovery-record --input/);
  assert.match(help, /d2a audit <public-url>/);
  const version = execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  assert.equal(version.trim(), manifest.version);
});

test("CLI errors are stable machine-readable JSON", () => {
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "unknown"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.deepEqual(JSON.parse(result.stderr), {
    error: { code: "unknown_command", message: "Unknown command: unknown", retryable: false },
  });
});

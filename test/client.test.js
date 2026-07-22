import assert from "node:assert/strict";
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

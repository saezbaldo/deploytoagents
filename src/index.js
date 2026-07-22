import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const DEFAULT_ENDPOINT = "https://deploytoagents.com/mcp";

function toolValue(result) {
  if (result.isError) {
    const message = result.content.find((item) => item.type === "text")?.text ?? "Deploy to Agents tool failed";
    throw new Error(message);
  }
  if (result.structuredContent) return result.structuredContent;
  const text = result.content.find((item) => item.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class DeployToAgentsClient {
  #client;
  #transport;
  #connected = false;

  constructor({ endpoint = DEFAULT_ENDPOINT, clientName = "deploytoagents-sdk", clientVersion = "0.1.0" } = {}) {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new TypeError("The MCP endpoint must use HTTPS unless it is local development");
    }
    this.endpoint = parsed;
    this.#client = new Client({ name: clientName, version: clientVersion });
    this.#transport = new StreamableHTTPClientTransport(parsed);
  }

  async connect() {
    if (!this.#connected) {
      await this.#client.connect(this.#transport);
      this.#connected = true;
    }
    return this;
  }

  async #call(name, args = {}) {
    await this.connect();
    return toolValue(await this.#client.callTool({ name, arguments: args }));
  }

  async listTools() {
    await this.connect();
    return (await this.#client.listTools()).tools;
  }

  auditApp(url) {
    return this.#call("audit_app", { url });
  }

  getAuditResult(auditId) {
    return this.#call("get_audit_result", { audit_id: auditId });
  }

  createDistributionPlan(auditId) {
    return this.#call("create_distribution_plan", { audit_id: auditId });
  }

  getCustomerZeroEvidence() {
    return this.#call("get_customer_zero_evidence");
  }

  async close() {
    if (this.#connected) await this.#client.close();
    this.#connected = false;
  }
}

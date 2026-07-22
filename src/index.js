export const DEFAULT_ENDPOINT = "https://deploytoagents.com/mcp";
const PROTOCOL_VERSION = "2025-06-18";

function toolValue(result) {
  if (result.isError) {
    const message = result.content?.find((item) => item.type === "text")?.text ?? "Deploy to Agents tool failed";
    throw new Error(message);
  }
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function responseJson(text, contentType) {
  if (!text) return null;
  if (contentType.includes("text/event-stream")) {
    const data = text.split(/\r?\n/).filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim()).filter(Boolean).at(-1);
    return data ? JSON.parse(data) : null;
  }
  return JSON.parse(text);
}

export class DeployToAgentsClient {
  #connected = false;
  #nextId = 1;
  #token;
  #clientInfo;

  constructor({ endpoint = DEFAULT_ENDPOINT, clientName = "deploytoagents", clientVersion = "0.3.0", token } = {}) {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1")
      throw new TypeError("The MCP endpoint must use HTTPS unless it is local development");
    this.endpoint = parsed;
    this.#token = token;
    this.#clientInfo = { name: clientName, version: clientVersion };
  }

  async #send(payload) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": PROTOCOL_VERSION,
        ...(this.#token ? { Authorization: `Bearer ${this.#token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let body;
    try { body = responseJson(text, response.headers.get("content-type") ?? ""); }
    catch { throw new Error(`Deploy to Agents returned an invalid MCP response (HTTP ${response.status})`); }
    if (!response.ok) throw new Error(body?.error?.message ?? `Deploy to Agents MCP request failed with HTTP ${response.status}`);
    if (body?.error) throw new Error(body.error.message ?? "Deploy to Agents MCP request failed");
    return body;
  }

  async #request(method, params = {}) {
    const id = this.#nextId++;
    const response = await this.#send({ jsonrpc: "2.0", id, method, params });
    if (response?.id !== id) throw new Error("Deploy to Agents returned a mismatched MCP response");
    return response.result;
  }

  async connect() {
    if (!this.#connected) {
      await this.#request("initialize", {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: this.#clientInfo,
      });
      await this.#send({ jsonrpc: "2.0", method: "notifications/initialized" });
      this.#connected = true;
    }
    return this;
  }

  async #call(name, args = {}) {
    await this.connect();
    return toolValue(await this.#request("tools/call", { name, arguments: args }));
  }

  async listTools() {
    await this.connect();
    return (await this.#request("tools/list")).tools;
  }

  auditApp(url) { return this.#call("audit_app", { url }); }
  getAuditResult(auditId) { return this.#call("get_audit_result", { audit_id: auditId }); }
  createDistributionPlan(auditId) { return this.#call("create_distribution_plan", { audit_id: auditId }); }
  getCustomerZeroEvidence() { return this.#call("get_customer_zero_evidence"); }
  async close() { this.#connected = false; }
}

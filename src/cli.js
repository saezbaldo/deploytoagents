#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { DeployToAgentsClient } from "./index.js";

const VERSION = "0.3.0";
const DEFAULT_API = "https://deploytoagents.com";
const HELP = `Deploy to Agents CLI ${VERSION}

Usage:
  d2a login
  d2a whoami
  d2a portfolio
  d2a audit <public-url>
  d2a audit-status <audit-id>
  d2a plan <audit-id>
  d2a capabilities
  d2a customer-zero
  d2a logout

Options:
  --api <url>       API origin (default: https://deploytoagents.com)
  --endpoint <url>  MCP endpoint (default: https://deploytoagents.com/mcp)
  --json            Emit compact JSON
  --help            Show this help
  --version         Show the CLI version`;

class CliError extends Error {
  constructor(code, message, exitCode = 1, retryable = false) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.retryable = retryable;
  }
}

function parseArgs(argv) {
  const options = { api: process.env.DEPLOYTOAGENTS_API ?? DEFAULT_API, endpoint: process.env.DEPLOYTOAGENTS_ENDPOINT, json: false };
  const positionals = [];
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--json") options.json = true;
    else if (value === "--help" || value === "-h") options.help = true;
    else if (value === "--version" || value === "-v") options.version = true;
    else if (value === "--api" || value === "--endpoint") {
      const next = argv[++index];
      if (!next) throw new CliError("invalid_arguments", `${value} requires a URL.`, 2);
      options[value.slice(2)] = next;
    } else if (value.startsWith("--")) throw new CliError("invalid_arguments", `Unknown option: ${value}`, 2);
    else positionals.push(value);
  }
  options.api = safeOrigin(options.api);
  options.endpoint ??= `${options.api}/mcp`;
  return { options, command: positionals[0], args: positionals.slice(1) };
}

function safeOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new CliError("invalid_api", "The API origin is invalid.", 2); }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
    throw new CliError("invalid_api", "The API must use HTTPS unless it is local development.", 2);
  return url.origin;
}

function credentialsPath() {
  const root = process.env.DEPLOYTOAGENTS_CONFIG_HOME ??
    (process.platform === "win32" ? join(process.env.LOCALAPPDATA ?? homedir(), "DeployToAgents") :
      join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "deploytoagents"));
  return join(root, process.platform === "win32" ? "credentials.dpapi" : "credentials.json");
}

function windowsProtect(value, decrypt = false) {
  const operation = decrypt ? "Unprotect" : "Protect";
  const input = decrypt
    ? "$bytes=[Convert]::FromBase64String($text)"
    : "$bytes=[Text.Encoding]::UTF8.GetBytes($text)";
  const output = decrypt
    ? "[Text.Encoding]::UTF8.GetString($result)"
    : "[Convert]::ToBase64String($result)";
  const script = `Add-Type -AssemblyName System.Security;$text=[Console]::In.ReadToEnd();${input};$result=[Security.Cryptography.ProtectedData]::${operation}($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);${output}`;
  const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    { input: value, encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new CliError("credential_store_failed", "Windows Credential Protection failed.");
  return result.stdout.trim();
}

async function saveCredentials(credentials) {
  const path = credentialsPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const serialized = JSON.stringify(credentials);
  const protectedValue = process.platform === "win32" ? windowsProtect(serialized) : serialized;
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, protectedValue, { encoding: "utf8", mode: 0o600 });
  await chmod(temporary, 0o600).catch(() => {});
  await rename(temporary, path);
}

async function loadCredentials(required = true) {
  if (process.env.DEPLOYTOAGENTS_TOKEN) return { idToken: process.env.DEPLOYTOAGENTS_TOKEN, environment: true };
  const path = credentialsPath();
  if (!existsSync(path)) {
    if (!required) return null;
    throw new CliError("not_authenticated", "Run `d2a login` first.", 3);
  }
  const stored = await readFile(path, "utf8");
  const serialized = process.platform === "win32" ? windowsProtect(stored, true) : stored;
  return JSON.parse(serialized);
}

async function deleteCredentials() {
  await unlink(credentialsPath()).catch((error) => { if (error.code !== "ENOENT") throw error; });
}

function base64Url(value) { return value.toString("base64url"); }
function tokenExpiry(token) {
  try { return Number(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")).exp ?? 0); }
  catch { return 0; }
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { Accept: "application/json", ...init.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error_description ?? body?.error?.message ?? body?.title ?? `Request failed with HTTP ${response.status}.`;
    throw new CliError(response.status === 401 ? "not_authenticated" : "remote_error", message,
      response.status === 401 ? 3 : 1, response.status >= 500);
  }
  return body;
}

async function authConfig(api) {
  return fetchJson(`${api}/api/auth/config`);
}

async function refreshCredentials(credentials) {
  if (credentials.environment || (credentials.idToken && tokenExpiry(credentials.idToken) > Date.now() / 1000 + 120)) return credentials;
  if (!credentials.refreshToken || !credentials.clientId) throw new CliError("session_expired", "Run `d2a login` again.", 3);
  const token = await fetchJson(`${credentials.api ?? DEFAULT_API}/api/auth/cli/token`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grantType: "refresh_token", refreshToken: credentials.refreshToken }),
  });
  if (!token.id_token) throw new CliError("session_refresh_failed", "Google did not return an identity token.", 3);
  const updated = { ...credentials, idToken: token.id_token, refreshedAt: new Date().toISOString() };
  await saveCredentials(updated);
  return updated;
}

function openBrowser(url) {
  const command = process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

async function receiveAuthorizationCode(clientId) {
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const state = base64Url(randomBytes(24));
  return new Promise((resolve, reject) => {
    let redirectUri;
    let timeout;
    const server = createServer((request, response) => {
      const received = new URL(request.url ?? "/", "http://127.0.0.1");
      if (received.pathname !== "/callback") { response.writeHead(404).end(); return; }
      if (received.searchParams.get("state") !== state) {
        response.writeHead(400, { "Content-Type": "text/plain" }).end("Invalid login state. You may close this window.");
        clearTimeout(timeout); server.close(); reject(new CliError("invalid_login_state", "The login response state did not match.")); return;
      }
      const error = received.searchParams.get("error");
      const code = received.searchParams.get("code");
      response.writeHead(error || !code ? 400 : 200, { "Content-Type": "text/plain", "Cache-Control": "no-store" })
        .end(error || !code ? "Login was not completed. You may close this window." : "Deploy to Agents login completed. You may close this window.");
      clearTimeout(timeout); server.close();
      if (error || !code) reject(new CliError("login_denied", `Google login was not completed${error ? `: ${error}` : "."}`, 3));
      else resolve({ code, verifier, redirectUri });
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
      const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      for (const [name, value] of Object.entries({
        client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile",
        code_challenge: challenge, code_challenge_method: "S256", state, access_type: "offline", prompt: "consent",
      })) authorization.searchParams.set(name, value);
      openBrowser(authorization.toString());
    });
    timeout = setTimeout(() => { server.close(); reject(new CliError("login_timeout", "Login timed out.", 3)); }, 5 * 60 * 1000);
  });
}

async function login(api) {
  const config = await authConfig(api);
  if (!config.enabled || !config.cliClientId)
    throw new CliError("login_not_configured", "CLI login is not enabled on this Deploy to Agents server yet.", 3);
  const authorization = await receiveAuthorizationCode(config.cliClientId);
  const token = await fetchJson(`${api}/api/auth/cli/token`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grantType: "authorization_code", code: authorization.code,
      codeVerifier: authorization.verifier, redirectUri: authorization.redirectUri }),
  });
  if (!token.id_token || !token.refresh_token) throw new CliError("login_failed", "Google did not return the required login credentials.", 3);
  const credentials = { api, clientId: config.cliClientId, refreshToken: token.refresh_token, idToken: token.id_token, createdAt: new Date().toISOString() };
  await saveCredentials(credentials);
  return whoami(api, credentials);
}

async function whoami(api, supplied) {
  const credentials = await refreshCredentials(supplied ?? await loadCredentials());
  return fetchJson(`${api}/api/auth/me`, { headers: { Authorization: `Bearer ${credentials.idToken}` } });
}

async function portfolio(api) {
  const credentials = await refreshCredentials(await loadCredentials());
  return fetchJson(`${api}/api/dashboard/portfolio`, { headers: { Authorization: `Bearer ${credentials.idToken}` } });
}

async function withMcp(options, action) {
  const credentials = await refreshCredentials(await loadCredentials());
  const client = new DeployToAgentsClient({ endpoint: options.endpoint, token: credentials.idToken, clientVersion: VERSION });
  try { return await action(client); } finally { await client.close(); }
}

async function execute(parsed) {
  const { command, args, options } = parsed;
  if (options.version) return { text: VERSION };
  if (options.help || !command) return { text: HELP };
  switch (command) {
    case "login": return { authenticated: true, ...(await login(options.api)) };
    case "logout": await deleteCredentials(); return { authenticated: false };
    case "whoami": return whoami(options.api);
    case "portfolio": return portfolio(options.api);
    case "capabilities": return withMcp(options, (client) => client.listTools());
    case "customer-zero": return withMcp(options, (client) => client.getCustomerZeroEvidence());
    case "audit":
      if (args.length !== 1) throw new CliError("invalid_arguments", "Usage: d2a audit <public-url>", 2);
      return withMcp(options, (client) => client.auditApp(args[0]));
    case "audit-status":
      if (args.length !== 1) throw new CliError("invalid_arguments", "Usage: d2a audit-status <audit-id>", 2);
      return withMcp(options, (client) => client.getAuditResult(args[0]));
    case "plan":
      if (args.length !== 1) throw new CliError("invalid_arguments", "Usage: d2a plan <audit-id>", 2);
      return withMcp(options, (client) => client.createDistributionPlan(args[0]));
    default: throw new CliError("unknown_command", `Unknown command: ${command}`, 2);
  }
}

try {
  const parsed = parseArgs(process.argv.slice(2));
  const result = await execute(parsed);
  if (result?.text) process.stdout.write(`${result.text}\n`);
  else process.stdout.write(`${JSON.stringify(result, null, parsed.options.json ? 0 : 2)}\n`);
} catch (error) {
  const known = error instanceof CliError ? error : new CliError("unexpected_error", error instanceof Error ? error.message : "Unexpected failure.");
  process.stderr.write(`${JSON.stringify({ error: { code: known.code, message: known.message, retryable: known.retryable } })}\n`);
  process.exitCode = known.exitCode;
}

#!/usr/bin/env node
/**
 * OAuth for Mobbin's official MCP server, so the squad's agents can use it
 * from GitHub Actions.
 *
 * Mobbin only offers per-user OAuth (authorization code + PKCE, dynamic
 * client registration). Arthur signs in once in a browser; after that, the
 * refresh token is kept in the MOBBIN_OAUTH secret and renewed here. Each
 * refresh returns a new refresh token (rotation): the caller must save it
 * back to the secret right away, or the next run will reuse a spent token.
 *
 *   node mobbin-oauth.mjs start                 → stdout: pending JSON; stderr: the URL to open
 *   node mobbin-oauth.mjs finish <callback-url> → reads MOBBIN_OAUTH_PENDING; stdout: state JSON
 *   node mobbin-oauth.mjs refresh               → reads MOBBIN_OAUTH (state JSON); stdout: new state JSON
 *   node mobbin-oauth.mjs check                 → refresh, then call the MCP server once; stdout: new state JSON
 *
 * State JSON: { client_id, token_endpoint, refresh_token, access_token, expires_at }
 */
import { createHash, randomBytes } from "node:crypto";

const RESOURCE_METADATA = "https://api.mobbin.com/.well-known/oauth-protected-resource/mcp";
const REDIRECT_URI = "http://localhost:53682/callback";

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function json(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url} → ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

async function discover() {
  const resource = await json(RESOURCE_METADATA);
  const issuer = resource.authorization_servers?.[0];
  if (!issuer) throw new Error("No authorization server in Mobbin's resource metadata");
  const { origin, pathname } = new URL(issuer);
  // RFC 8414: the well-known segment goes between the host and the issuer path.
  return json(`${origin}/.well-known/oauth-authorization-server${pathname.replace(/\/$/, "")}`);
}

async function tokenRequest(tokenEndpoint, params) {
  const body = await json(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params).toString(),
  });
  if (!body.access_token || !body.refresh_token) {
    throw new Error(`Token response without access_token/refresh_token: ${Object.keys(body).join(", ")}`);
  }
  return {
    refresh_token: body.refresh_token,
    access_token: body.access_token,
    expires_at: Date.now() + (Number(body.expires_in) || 3600) * 1000,
  };
}

const commands = {
  async start() {
    const server = await discover();
    const client = await json(server.registration_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Union squad (GitHub Actions)",
        redirect_uris: [REDIRECT_URI],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
    });
    const verifier = b64url(randomBytes(48));
    const state = b64url(randomBytes(16));
    const url = new URL(server.authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      scope: "openid",
      state,
      code_challenge: b64url(createHash("sha256").update(verifier).digest()),
      code_challenge_method: "S256",
      resource: "https://api.mobbin.com/mcp",
    }).toString();
    process.stderr.write(`${url}\n`);
    process.stdout.write(
      JSON.stringify({ client_id: client.client_id, token_endpoint: server.token_endpoint, verifier, state, url: String(url) }),
    );
  },

  async finish(callbackUrl) {
    const pending = JSON.parse(process.env.MOBBIN_OAUTH_PENDING || "null");
    if (!pending) throw new Error("MOBBIN_OAUTH_PENDING is empty: run the `start` step first");
    if (!callbackUrl) throw new Error("Pass the full address the browser ended on (it starts with http://localhost:53682/callback)");
    const params = new URL(callbackUrl.trim()).searchParams;
    if (params.get("error")) throw new Error(`Mobbin refused: ${params.get("error")} ${params.get("error_description") ?? ""}`);
    if (params.get("state") !== pending.state) throw new Error("This address does not belong to the last login attempt (state mismatch): start again");
    const code = params.get("code");
    if (!code) throw new Error("No code in the address");
    const tokens = await tokenRequest(pending.token_endpoint, {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: pending.client_id,
      code_verifier: pending.verifier,
    });
    process.stdout.write(JSON.stringify({ client_id: pending.client_id, token_endpoint: pending.token_endpoint, ...tokens }));
  },

  async check() {
    await commands.refresh();
  },

  async refresh() {
    const state = JSON.parse(process.env.MOBBIN_OAUTH || "null");
    if (!state?.refresh_token) throw new Error("MOBBIN_OAUTH is empty: run the Mobbin login workflow");
    const tokens = await tokenRequest(state.token_endpoint, {
      grant_type: "refresh_token",
      refresh_token: state.refresh_token,
      client_id: state.client_id,
    });
    const next = { client_id: state.client_id, token_endpoint: state.token_endpoint, ...tokens };
    // Print the new state before anything else can fail: the old refresh
    // token is already spent, so the caller must be able to save this one.
    process.stdout.write(JSON.stringify(next));
    if (command === "check") await initialize(next.access_token);
  },
};

// One MCP handshake, to prove the token opens Mobbin's server.
async function initialize(accessToken) {
  const response = await fetch("https://api.mobbin.com/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "union-squad", version: "1" } },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Mobbin MCP answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

const [command, ...args] = process.argv.slice(2);
if (!commands[command]) {
  console.error("usage: mobbin-oauth.mjs start | finish <callback-url> | refresh");
  process.exit(2);
}
try {
  await commands[command](...args);
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}

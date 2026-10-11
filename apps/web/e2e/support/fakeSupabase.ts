import type { BrowserContext, Route } from "@playwright/test";

/**
 * A small in-memory stand-in for the parts of Supabase the organiser pages
 * use, served to the browser through Playwright's network interception. Reads
 * and writes go through the same tables, so a change the page makes (seating
 * a guest, creating a group) is really applied and read back, which is what
 * lets a spec check behaviour rather than only first paint.
 *
 * It speaks just enough PostgREST: `eq` / `neq` / `in` / `is` filters,
 * `order`, `limit`, single-object responses, and the two embedded selects the
 * app uses on `guests`. It is not Supabase: row-level security, constraints
 * and RPCs are out of scope (RPCs are recorded and answered with null). Real
 * database behaviour stays covered by `supabase/tests/database`.
 *
 * Requests it does not understand are recorded in `unhandled` and answered
 * with a 404, so a spec can fail loudly instead of silently showing an empty
 * page.
 */

export type Row = Record<string, unknown> & { id?: string };
export type Tables = Record<string, Row[]>;

export type FakeSupabase = {
  tables: Tables;
  /** `METHOD /path` of every request the fake could not answer. */
  unhandled: string[];
  /** Names of the RPCs called, in order. */
  rpcCalls: string[];
};

const ORIGIN = "https://placeholder.supabase.co";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-expose-headers": "*",
};

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/** A JWT-shaped token. supabase-js reads its expiry client-side; nothing
 *  verifies the signature because the fake is the only server. */
function fakeJwt(userId: string, exp: number): string {
  return [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({ sub: userId, role: "authenticated", aud: "authenticated", exp }),
    "signature",
  ].join(".");
}

export function fakeUser(id: string, email: string) {
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
}

function makeSession(user: ReturnType<typeof fakeUser>) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  return {
    access_token: fakeJwt(user.id, expiresAt),
    refresh_token: "fake-refresh-token",
    token_type: "bearer",
    expires_in: 60 * 60 * 24,
    expires_at: expiresAt,
    user,
  };
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return a < b ? -1 : 1;
}

function matches(row: Row, column: string, expr: string): boolean {
  const value = row[column];
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const arg = expr.slice(dot + 1);
  switch (op) {
    case "eq":
      return String(value) === arg;
    case "neq":
      return String(value) !== arg;
    case "is":
      return arg === "null" ? value === null || value === undefined : String(value) === arg;
    case "in":
      return arg
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((v) => v.replace(/^"|"$/g, ""))
        .includes(String(value));
    default:
      throw new Error(`unsupported filter ${column}=${expr}`);
  }
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function applyQuery(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows.filter((row) =>
    [...params.entries()]
      .filter(([key]) => !RESERVED.has(key))
      .every(([column, expr]) => matches(row, column, expr)),
  );
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((part) => {
      const [column, dir] = part.split(".");
      return { column, sign: dir === "desc" ? -1 : 1 };
    });
    out = [...out].sort((a, b) => {
      for (const { column, sign } of keys) {
        const c = compare(a[column], b[column]);
        if (c !== 0) return c * sign;
      }
      return 0;
    });
  }
  const limit = params.get("limit");
  return limit ? out.slice(0, Number(limit)) : out;
}

/** The two embeds the app asks `guests` for. */
function embed(tables: Tables, table: string, select: string | null, row: Row): Row {
  if (table !== "guests" || !select) return row;
  const result: Row = { ...row };
  if (select.includes("rsvps(")) {
    result.rsvps = (tables.rsvps ?? []).filter((r) => r.guest_id === row.id);
  }
  if (select.includes("guest_group_members(")) {
    result.guest_group_members = (tables.guest_group_members ?? [])
      .filter((m) => m.guest_id === row.id)
      .map((m) => ({
        guest_groups:
          (tables.guest_groups ?? []).find((g) => g.id === m.group_id) ?? null,
      }));
  }
  return result;
}

/** Cascades the app relies on the database for. */
function cascadeDelete(tables: Tables, table: string, removed: Row[]) {
  const ids = new Set(removed.map((r) => r.id));
  const dropWhere = (name: string, column: string) => {
    tables[name] = (tables[name] ?? []).filter((r) => !ids.has(r[column] as string));
  };
  if (table === "guests") {
    dropWhere("rsvps", "guest_id");
    dropWhere("guest_group_members", "guest_id");
  }
  if (table === "guest_groups") dropWhere("guest_group_members", "group_id");
  if (table === "seating_tables") {
    for (const g of tables.guests ?? []) {
      if (ids.has(g.seating_table_id as string)) g.seating_table_id = null;
    }
  }
}

export async function installFakeSupabase(
  context: BrowserContext,
  options: { tables: Tables; user: ReturnType<typeof fakeUser> },
): Promise<FakeSupabase> {
  const fake: FakeSupabase = {
    tables: structuredClone(options.tables),
    unhandled: [],
    rpcCalls: [],
  };
  const session = makeSession(options.user);

  // The signed-in session, in the place supabase-js persists it.
  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Storage unavailable: the page will just redirect to sign-in.
      }
    },
    ["sb-placeholder-auth-token", JSON.stringify(session)] as const,
  );

  const json = (route: Route, status: number, body: unknown, extra = {}) =>
    route.fulfill({
      status,
      headers: { ...CORS, "content-type": "application/json", ...extra },
      body: body === undefined ? "" : JSON.stringify(body),
    });

  await context.route(`${ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }

    if (url.pathname.startsWith("/auth/v1/")) {
      if (url.pathname.endsWith("/user")) return json(route, 200, options.user);
      if (url.pathname.endsWith("/token")) return json(route, 200, session);
      if (url.pathname.endsWith("/logout")) return json(route, 204, undefined);
      fake.unhandled.push(`${method} ${url.pathname}`);
      return json(route, 404, { message: "not handled by fake" });
    }

    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(.+)$/);
    if (rpc) {
      fake.rpcCalls.push(rpc[1]);
      return json(route, 200, null);
    }

    const rest = url.pathname.match(/^\/rest\/v1\/([^/]+)$/);
    if (!rest) {
      fake.unhandled.push(`${method} ${url.pathname}`);
      return json(route, 404, { message: "not handled by fake" });
    }

    const table = rest[1];
    const rows = (fake.tables[table] ??= []);
    const select = url.searchParams.get("select");
    const wantsObject = (request.headers()["accept"] ?? "").includes(
      "application/vnd.pgrst.object+json",
    );
    const wantsBody = (request.headers()["prefer"] ?? "").includes("return=representation");

    const respond = (result: Row[]) => {
      const shaped = result.map((r) => embed(fake.tables, table, select, r));
      if (wantsObject) {
        if (shaped.length !== 1) {
          return json(route, 406, {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: `The result contains ${shaped.length} rows`,
          });
        }
        return json(route, method === "POST" ? 201 : 200, shaped[0]);
      }
      return json(route, method === "POST" ? 201 : 200, shaped);
    };

    try {
      if (method === "GET" || method === "HEAD") {
        return respond(applyQuery(rows, url.searchParams));
      }

      if (method === "POST") {
        const body = request.postDataJSON() as Row | Row[];
        const created = (Array.isArray(body) ? body : [body]).map((input) => ({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...input,
        }));
        rows.push(...created);
        return wantsBody || select ? respond(created) : route.fulfill({ status: 201, headers: CORS });
      }

      if (method === "PATCH") {
        const patch = request.postDataJSON() as Row;
        const targets = applyQuery(rows, url.searchParams);
        for (const row of targets) Object.assign(row, patch);
        return wantsBody || select ? respond(targets) : route.fulfill({ status: 204, headers: CORS });
      }

      if (method === "DELETE") {
        const targets = new Set(applyQuery(rows, url.searchParams));
        const removed = rows.filter((r) => targets.has(r));
        fake.tables[table] = rows.filter((r) => !targets.has(r));
        cascadeDelete(fake.tables, table, removed);
        return route.fulfill({ status: 204, headers: CORS });
      }
    } catch (error) {
      fake.unhandled.push(`${method} ${url.pathname}${url.search} (${String(error)})`);
      return json(route, 400, { message: String(error) });
    }

    fake.unhandled.push(`${method} ${url.pathname}`);
    return json(route, 404, { message: "not handled by fake" });
  });

  return fake;
}

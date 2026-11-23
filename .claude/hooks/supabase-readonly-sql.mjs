// PreToolUse hook for mcp__Supabase__execute_sql.
// Auto-approves a query only when it is clearly read-only (SELECT / WITH /
// EXPLAIN / SHOW / VALUES / TABLE, no write keyword, no call to a function
// defined in our migrations, since those can write). Anything else prints
// nothing, so the normal permission prompt still appears.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const raw = String(input?.tool_input?.query ?? "");

// Drop comments and string literals so keywords inside them don't count,
// and so a comment can't hide the leading keyword check.
const sql = raw
  .replace(/--[^\n]*/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, " '' ")
  .replace(/'(?:[^']|'')*'/g, " '' ")
  .toLowerCase();

const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
if (statements.length === 0) process.exit(0);

const READ_START = /^\(*\s*(select|with|explain|show|values|table)\b/;
const WRITE_WORDS =
  /\b(insert|update|delete|merge|upsert|drop|alter|create|truncate|grant|revoke|copy|call|do|set|reset|perform|execute|exec|vacuum|refresh|comment|lock|reindex|cluster|listen|notify|unlisten|prepare|deallocate|discard|security|import|load|into|begin|commit|rollback|savepoint|release|nextval|setval|set_config|dblink\w*|lo_\w+|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_read\w*|pg_ls_dir|pg_advisory\w*|pg_sleep\w*|pg_switch_wal|pg_rotate_logfile|http\w*|net\.\w+)\b/;

// Functions we define can write (RPCs). Calling one means: ask.
function projectFunctions() {
  const dir = join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), "supabase", "migrations");
  const names = new Set();
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".sql")) continue;
      const text = readFileSync(join(dir, f), "utf8");
      for (const m of text.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w."]+)/gi)) {
        names.add(m[1].replace(/"/g, "").split(".").pop().toLowerCase());
      }
    }
  } catch {
    return null; // can't read migrations: be safe, ask
  }
  return names;
}

const fns = projectFunctions();
if (fns === null) process.exit(0);

for (const s of statements) {
  if (!READ_START.test(s) || WRITE_WORDS.test(s)) process.exit(0);
  for (const m of s.matchAll(/([a-z_][\w]*)\s*\(/g)) {
    if (fns.has(m[1])) process.exit(0);
  }
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "Read-only SQL (auto-approved by .claude/hooks/supabase-readonly-sql.mjs)",
    },
  }),
);

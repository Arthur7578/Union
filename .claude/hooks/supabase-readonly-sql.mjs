// PreToolUse hook for mcp__Supabase__execute_sql.
// Auto-approves a query only when it is clearly read-only: every statement
// starts with SELECT / WITH / EXPLAIN / SHOW / VALUES / TABLE, contains no
// write keyword, and calls only standard read-only Postgres functions.
// Any other function (an app RPC can write) or anything else prints nothing,
// so the normal permission prompt still appears. Not tied to one project.
import { readFileSync } from "node:fs";

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
  /\b(insert|update|delete|merge|upsert|drop|alter|create|truncate|grant|revoke|copy|call|do|set|reset|perform|execute|exec|vacuum|refresh|comment|lock|reindex|cluster|listen|notify|unlisten|prepare|deallocate|discard|security|import|load|into|begin|commit|rollback|savepoint|release)\b/;

// SQL keywords and type names that can be followed by "(" without being a call.
const KEYWORDS = new Set(
  ("select with as from join on using where and or not in exists any all some values filter over " +
    "partition by group order having union intersect except lateral when then else case row array " +
    "distinct limit offset is between like ilike similar to cast extract interval returning recursive " +
    "materialized table explain " +
    "varchar char character numeric decimal timestamp timestamptz time timetz bit varbit float").split(" "),
);

// Standard Postgres functions that only read.
const SAFE_FUNCTIONS = new Set(
  (
    // aggregates and window functions
    "count sum avg min max array_agg string_agg json_agg jsonb_agg json_object_agg jsonb_object_agg " +
    "bool_and bool_or every stddev variance percentile_cont percentile_disc mode " +
    "row_number rank dense_rank percent_rank cume_dist ntile lag lead first_value last_value nth_value " +
    // conditionals and math
    "coalesce nullif greatest least abs round ceil ceiling floor trunc mod power sqrt sign random " +
    // text
    "lower upper initcap length char_length octet_length substring substr trim btrim ltrim rtrim " +
    "replace split_part concat concat_ws left right position strpos format lpad rpad reverse repeat " +
    "regexp_replace regexp_match regexp_matches regexp_split_to_array regexp_split_to_table md5 encode decode " +
    "starts_with translate quote_ident quote_literal " +
    // dates
    "now date_trunc date_part age make_date make_time make_timestamp make_timestamptz make_interval " +
    "to_char to_date to_timestamp to_number timezone clock_timestamp statement_timestamp " +
    // json
    "to_json to_jsonb row_to_json array_to_json json_build_object jsonb_build_object json_build_array " +
    "jsonb_build_array json_array_length jsonb_array_length json_array_elements jsonb_array_elements " +
    "json_array_elements_text jsonb_array_elements_text json_each jsonb_each json_each_text jsonb_each_text " +
    "json_object_keys jsonb_object_keys json_typeof jsonb_typeof jsonb_pretty jsonb_strip_nulls " +
    "json_extract_path jsonb_extract_path json_extract_path_text jsonb_extract_path_text jsonb_path_query " +
    "jsonb_path_exists jsonb_set jsonb_insert " +
    // arrays and sets
    "array_length cardinality unnest array_to_string string_to_array array_position array_positions " +
    "array_remove array_append array_prepend array_cat generate_series generate_subscripts " +
    "gen_random_uuid " +
    // catalog / introspection
    "pg_get_functiondef pg_get_function_arguments pg_get_function_identity_arguments pg_get_function_result " +
    "pg_get_viewdef pg_get_constraintdef pg_get_indexdef pg_get_triggerdef pg_get_expr pg_get_userbyid " +
    "pg_get_serial_sequence format_type obj_description col_description shobj_description " +
    "pg_total_relation_size pg_relation_size pg_table_size pg_indexes_size pg_database_size pg_size_pretty " +
    "has_table_privilege has_column_privilege has_function_privilege has_schema_privilege " +
    "pg_has_role version current_schema current_schemas"
  ).split(" "),
);
// jsonb_set / jsonb_insert / array_append only build values in memory; they don't write tables.

for (const s of statements) {
  if (!READ_START.test(s) || WRITE_WORDS.test(s)) process.exit(0);
  for (const m of s.matchAll(/([a-z_][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (!KEYWORDS.has(name) && !SAFE_FUNCTIONS.has(name)) process.exit(0);
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

import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type UnionClient = SupabaseClient<Database>;

/**
 * Platform-agnostic Supabase client factory.
 *
 * Mobile (Expo) passes AsyncStorage-backed auth options; the web app uses the
 * browser defaults. Both share the same generated `Database` types.
 */
export function createUnionClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  options?: SupabaseClientOptions<"public">,
): UnionClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase credentials: supabaseUrl and supabaseAnonKey are required.",
    );
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, options);
}

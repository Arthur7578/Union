import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createUnionClient } from "@union/shared";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaced early during development so misconfiguration is obvious.
  console.warn(
    "[union] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Check apps/mobile/.env",
  );
}

/**
 * Supabase client for React Native. Sessions persist in AsyncStorage
 * (bundled with Expo Go — no native build required).
 */
export const supabase = createUnionClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // We authenticate with a 6-digit email code (verifyOtp), so no URL
    // fragment ever carries a session — leave URL detection off.
    detectSessionInUrl: false,
  },
});

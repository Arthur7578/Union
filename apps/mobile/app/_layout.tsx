import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Slot, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../lib/auth";
import { WeddingProvider, useWedding } from "../lib/wedding";
import { colors } from "../theme/theme";

function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { wedding, loading: weddingLoading } = useWedding();
  const segments = useSegments();
  const router = useRouter();

  const loading = authLoading || (session != null && weddingLoading);

  useEffect(() => {
    if (loading) return;

    const group = segments[0]; // "(auth)" | "(tabs)" | "onboarding" | undefined
    const inAuth = group === "(auth)";
    const inOnboarding = group === "onboarding";

    if (!session) {
      if (!inAuth) router.replace("/(auth)/sign-in");
      return;
    }
    // Signed in but no wedding yet -> force onboarding.
    if (!wedding) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }
    // Signed in with a wedding -> keep them out of auth/onboarding.
    if (inAuth || inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [loading, session, wedding, segments, router]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <WeddingProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </WeddingProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});

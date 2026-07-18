import { Stack } from "expo-router";
import { colors, fontSize } from "../../../theme/theme";

export default function GuestsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontSize: fontSize.lg },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Guests" }} />
      <Stack.Screen name="new" options={{ title: "Add guest", presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: "Guest" }} />
    </Stack>
  );
}

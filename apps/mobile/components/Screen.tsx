import React from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "../theme/theme";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
  contentStyle?: ViewStyle;
};

/** Standard screen wrapper: safe area + page background + padding. */
export function Screen({
  children,
  scroll = false,
  edges = ["top", "left", "right"],
  contentStyle,
}: Props) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
});

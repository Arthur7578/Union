import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { RsvpStatus } from "@union/shared";
import { colors, fontSize, fontWeight, radius, spacing } from "../theme/theme";

const CONFIG: Record<RsvpStatus, { label: string; bg: string; fg: string }> = {
  attending: { label: "Attending", bg: colors.successBg, fg: colors.success },
  declined: { label: "Declined", bg: colors.dangerBg, fg: colors.danger },
  pending: { label: "Awaiting reply", bg: colors.surfaceAlt, fg: colors.textMuted },
};

export function StatusChip({ status }: { status: RsvpStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.pending;
  return (
    <View style={[styles.chip, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});

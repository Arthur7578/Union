import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { RsvpStatus } from "@union/shared";
import { useT } from "../lib/i18n";
import { colors, fontSize, fontWeight, radius, spacing } from "../theme/theme";

const TONE: Record<RsvpStatus, { bg: string; fg: string }> = {
  attending: { bg: colors.successBg, fg: colors.success },
  declined: { bg: colors.dangerBg, fg: colors.danger },
  pending: { bg: colors.surfaceAlt, fg: colors.textMuted },
};

export function StatusChip({ status }: { status: RsvpStatus }) {
  const t = useT();
  const tone = TONE[status] ?? TONE.pending;
  const label = t.guests.status[status] ?? t.guests.status.pending;
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{label}</Text>
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

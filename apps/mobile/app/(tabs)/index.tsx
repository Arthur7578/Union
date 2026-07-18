import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Card } from "../../components/Card";
import { useWedding } from "../../lib/wedding";
import { fetchGuests, type GuestWithRsvp } from "../../lib/data";
import { daysUntil, formatLongDate } from "../../lib/format";
import { colors, fontSize, fontWeight, spacing } from "../../theme/theme";

export default function Dashboard() {
  const { wedding } = useWedding();
  const [guests, setGuests] = useState<GuestWithRsvp[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!wedding) return;
    const data = await fetchGuests(wedding.id);
    setGuests(data);
  }, [wedding?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const attending = guests.filter((g) => g.rsvps?.status === "attending");
  const declined = guests.filter((g) => g.rsvps?.status === "declined");
  const pending = guests.filter(
    (g) => !g.rsvps || g.rsvps.status === "pending",
  );
  const headcount = attending.reduce(
    (sum, g) => sum + (g.rsvps?.num_attending ?? g.party_size),
    0,
  );

  const countdown = daysUntil(wedding?.event_date ?? null);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Card style={styles.hero}>
          <Text style={styles.couple}>
            {wedding?.partner_one} & {wedding?.partner_two}
          </Text>
          <Text style={styles.date}>
            {formatLongDate(wedding?.event_date ?? null)}
          </Text>
          {wedding?.venue_name ? (
            <Text style={styles.venue}>{wedding.venue_name}</Text>
          ) : null}
          {countdown != null && countdown >= 0 ? (
            <View style={styles.countdownPill}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
              <Text style={styles.countdownLabel}>
                {countdown === 1 ? "day to go" : "days to go"}
              </Text>
            </View>
          ) : null}
        </Card>

        <Text style={styles.sectionTitle}>RSVP overview</Text>
        <View style={styles.statRow}>
          <StatCard value={attending.length} label="Attending" color={colors.success} />
          <StatCard value={pending.length} label="Awaiting" color={colors.textMuted} />
          <StatCard value={declined.length} label="Declined" color={colors.danger} />
        </View>

        <Card>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Invited parties</Text>
            <Text style={styles.summaryValue}>{guests.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Confirmed headcount</Text>
            <Text style={styles.summaryValue}>{headcount}</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <Card style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  hero: {
    backgroundColor: colors.surface,
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  couple: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: "center",
  },
  date: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  venue: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  countdownPill: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  countdownNumber: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  countdownLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  summaryLabel: { fontSize: fontSize.md, color: colors.text },
  summaryValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  divider: { height: 1, backgroundColor: colors.border },
});

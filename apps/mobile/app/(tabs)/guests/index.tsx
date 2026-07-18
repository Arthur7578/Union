import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { StatusChip } from "../../../components/StatusChip";
import { useWedding } from "../../../lib/wedding";
import { fetchGuests, type GuestWithRsvp } from "../../../lib/data";
import {
  colors,
  fontSize,
  fontWeight,
  radius,
  spacing,
  MIN_TOUCH,
} from "../../../theme/theme";

export default function GuestList() {
  const { wedding } = useWedding();
  const router = useRouter();
  const [guests, setGuests] = useState<GuestWithRsvp[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!wedding) return;
    setLoading(true);
    try {
      setGuests(await fetchGuests(wedding.id));
    } finally {
      setLoading(false);
    }
  }, [wedding?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={guests}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons
                name="people-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>No guests yet</Text>
              <Text style={styles.emptyText}>
                Add your first guest to start tracking RSVPs.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push(`/(tabs)/guests/${item.id}`)}
          >
            <View style={styles.rowMain}>
              <Text style={styles.name}>
                {item.first_name} {item.last_name ?? ""}
              </Text>
              <Text style={styles.meta}>
                {item.party_size === 1
                  ? "1 guest"
                  : `${item.party_size} guests`}
                {item.guest_group ? ` · ${item.guest_group}` : ""}
              </Text>
              <View style={styles.chipWrap}>
                <StatusChip status={item.rsvps?.status ?? "pending"} />
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      />

      <Link href="/(tabs)/guests/new" asChild>
        <Pressable style={styles.fab} accessibilityRole="button" accessibilityLabel="Add guest">
          <Ionicons name="add" size={28} color={colors.primaryContrast} />
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl * 2,
  },
  row: {
    minHeight: MIN_TOUCH + 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowPressed: { opacity: 0.8 },
  rowMain: { flex: 1, gap: spacing.xs },
  name: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  chipWrap: { marginTop: spacing.xs },
  empty: {
    alignItems: "center",
    paddingTop: spacing.xxxl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});

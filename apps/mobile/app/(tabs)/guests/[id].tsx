import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Screen } from "../../../components/Screen";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Card } from "../../../components/Card";
import { StatusChip } from "../../../components/StatusChip";
import {
  deleteGuest,
  fetchGuest,
  updateGuest,
  type GuestWithRsvp,
} from "../../../lib/data";
import { colors, fontSize, fontWeight, spacing } from "../../../theme/theme";

const RSVP_WEB_URL =
  process.env.EXPO_PUBLIC_RSVP_WEB_URL ?? "https://union-rsvp.vercel.app";

export default function GuestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [guest, setGuest] = useState<GuestWithRsvp | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [group, setGroup] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const g = await fetchGuest(id);
      setGuest(g);
      if (g) {
        setFirstName(g.first_name);
        setLastName(g.last_name ?? "");
        setEmail(g.email ?? "");
        setPartySize(String(g.party_size));
        setGroup(g.guest_group ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const save = async () => {
    if (!guest) return;
    if (!firstName.trim()) {
      Alert.alert("First name required");
      return;
    }
    setBusy(true);
    try {
      await updateGuest(guest.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        party_size: Math.max(1, parseInt(partySize, 10) || 1),
        guest_group: group.trim() || null,
      });
      Alert.alert("Saved");
      await load();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  };

  const shareInvite = async () => {
    if (!guest) return;
    const url = `${RSVP_WEB_URL}/rsvp/${guest.invite_token}`;
    try {
      await Share.share({
        message: `You're invited! Please RSVP here: ${url}`,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  const confirmDelete = () => {
    if (!guest) return;
    Alert.alert(
      "Remove guest",
      `Remove ${guest.first_name} from your guest list? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGuest(guest.id);
              router.back();
            } catch (e) {
              Alert.alert("Could not remove", e instanceof Error ? e.message : "");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!guest) {
    return (
      <Screen>
        <Text style={styles.muted}>Guest not found.</Text>
      </Screen>
    );
  }

  const rsvp = guest.rsvps;

  return (
    <Screen scroll>
      <Card style={styles.rsvpCard}>
        <View style={styles.rsvpHeader}>
          <Text style={styles.rsvpTitle}>RSVP status</Text>
          <StatusChip status={rsvp?.status ?? "pending"} />
        </View>
        {rsvp && rsvp.status !== "pending" ? (
          <View style={styles.rsvpDetails}>
            {rsvp.status === "attending" ? (
              <Text style={styles.rsvpLine}>
                {rsvp.num_attending ?? guest.party_size} attending
              </Text>
            ) : null}
            {rsvp.dietary_notes ? (
              <Text style={styles.rsvpLine}>Dietary: {rsvp.dietary_notes}</Text>
            ) : null}
            {rsvp.message ? (
              <Text style={styles.rsvpMessage}>“{rsvp.message}”</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.muted}>
            No response yet. Share the invite link below.
          </Text>
        )}
        <Button
          label="Share invite link"
          variant="secondary"
          onPress={shareInvite}
          style={styles.shareBtn}
        />
      </Card>

      <Text style={styles.sectionTitle}>Guest details</Text>
      <Input label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
      <Input label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
        autoCorrect={false}
      />
      <Input
        label="Party size"
        value={partySize}
        onChangeText={setPartySize}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={2}
      />
      <Input label="Group" value={group} onChangeText={setGroup} autoCapitalize="words" />

      <View style={styles.actions}>
        <Button label="Save changes" onPress={save} loading={busy} />
        <Button label="Remove guest" variant="danger" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  rsvpCard: { gap: spacing.md },
  rsvpHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rsvpTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  rsvpDetails: { gap: spacing.xs },
  rsvpLine: { fontSize: fontSize.sm, color: colors.text },
  rsvpMessage: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  shareBtn: { marginTop: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});

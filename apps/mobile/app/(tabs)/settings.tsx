import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Card } from "../../components/Card";
import { useAuth } from "../../lib/auth";
import { useWedding } from "../../lib/wedding";
import { updateWedding } from "../../lib/data";
import { isValidISODate } from "../../lib/format";
import { colors, fontSize, fontWeight, spacing } from "../../theme/theme";

export default function Settings() {
  const { session, signOut } = useAuth();
  const { wedding, setWedding, refresh } = useWedding();
  const [partnerOne, setPartnerOne] = useState("");
  const [partnerTwo, setPartnerTwo] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!wedding) return;
    setPartnerOne(wedding.partner_one ?? "");
    setPartnerTwo(wedding.partner_two ?? "");
    setEventDate(wedding.event_date ?? "");
    setVenueName(wedding.venue_name ?? "");
    setVenueAddress(wedding.venue_address ?? "");
  }, [wedding?.id]);

  const save = async () => {
    if (!wedding) return;
    if (eventDate.trim() && !isValidISODate(eventDate.trim())) {
      Alert.alert("Invalid date", "Use the format YYYY-MM-DD.");
      return;
    }
    setBusy(true);
    try {
      const updated = await updateWedding(wedding.id, {
        partner_one: partnerOne.trim() || null,
        partner_two: partnerTwo.trim() || null,
        event_date: eventDate.trim() || null,
        venue_name: venueName.trim() || null,
        venue_address: venueAddress.trim() || null,
      });
      setWedding(updated);
      Alert.alert("Saved");
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.sectionTitle}>Wedding details</Text>
      <Input label="Partner 1" value={partnerOne} onChangeText={setPartnerOne} autoCapitalize="words" />
      <Input label="Partner 2" value={partnerTwo} onChangeText={setPartnerTwo} autoCapitalize="words" />
      <Input
        label="Wedding date"
        hint="Format: YYYY-MM-DD"
        value={eventDate}
        onChangeText={setEventDate}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />
      <Input label="Venue" value={venueName} onChangeText={setVenueName} autoCapitalize="words" />
      <Input label="Venue address" value={venueAddress} onChangeText={setVenueAddress} />
      <Button label="Save" onPress={save} loading={busy} />

      <Card style={styles.accountCard}>
        <Text style={styles.accountLabel}>Signed in as</Text>
        <Text style={styles.accountValue}>{session?.user.email}</Text>
      </Card>

      <Button
        label="Sign out"
        variant="ghost"
        onPress={() =>
          Alert.alert("Sign out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign out",
              style: "destructive",
              onPress: async () => {
                await signOut();
                await refresh();
              },
            },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  accountCard: { marginTop: spacing.lg, gap: spacing.xs },
  accountLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  accountValue: { fontSize: fontSize.md, color: colors.text },
});

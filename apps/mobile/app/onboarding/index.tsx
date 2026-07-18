import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useAuth } from "../../lib/auth";
import { useWedding } from "../../lib/wedding";
import { createWedding } from "../../lib/data";
import { isValidISODate } from "../../lib/format";
import { colors, fontSize, fontWeight, spacing } from "../../theme/theme";

export default function Onboarding() {
  const { session } = useAuth();
  const { refresh } = useWedding();
  const [partnerOne, setPartnerOne] = useState("");
  const [partnerTwo, setPartnerTwo] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!partnerOne.trim() || !partnerTwo.trim()) {
      setError("Add both partners' names.");
      return;
    }
    if (eventDate.trim() && !isValidISODate(eventDate.trim())) {
      setError("Wedding date must be in YYYY-MM-DD format.");
      return;
    }
    if (!session?.user) {
      setError("Your session expired. Please sign in again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createWedding({
        owner_id: session.user.id,
        partner_one: partnerOne.trim(),
        partner_two: partnerTwo.trim(),
        event_date: eventDate.trim() || null,
        venue_name: venueName.trim() || null,
        venue_address: null,
      });
      await refresh(); // gate redirects to the tabs once the wedding exists
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Let's set the scene</Text>
        <Text style={styles.subtitle}>
          A few details so Union can help you plan the big day.
        </Text>
      </View>

      <Input
        label="Partner 1"
        placeholder="e.g. Alex"
        value={partnerOne}
        onChangeText={setPartnerOne}
        autoCapitalize="words"
      />
      <Input
        label="Partner 2"
        placeholder="e.g. Sam"
        value={partnerTwo}
        onChangeText={setPartnerTwo}
        autoCapitalize="words"
      />
      <Input
        label="Wedding date (optional)"
        placeholder="2026-09-12"
        hint="Format: YYYY-MM-DD"
        value={eventDate}
        onChangeText={setEventDate}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />
      <Input
        label="Venue (optional)"
        placeholder="e.g. Willow Creek Barn"
        value={venueName}
        onChangeText={setVenueName}
        autoCapitalize="words"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Start planning" onPress={submit} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
  },
});

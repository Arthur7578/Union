import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useAuth } from "../../lib/auth";
import { useWedding } from "../../lib/wedding";
import { createWedding } from "../../lib/data";
import { isValidISODate } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { colors, fontSize, fontWeight, spacing } from "../../theme/theme";

export default function Onboarding() {
  const { session } = useAuth();
  const { refresh } = useWedding();
  const t = useT();
  const [partnerOne, setPartnerOne] = useState("");
  const [partnerTwo, setPartnerTwo] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!partnerOne.trim() || !partnerTwo.trim()) {
      setError(t.onboarding.errMissingPartners);
      return;
    }
    if (eventDate.trim() && !isValidISODate(eventDate.trim())) {
      setError(t.onboarding.errDate);
      return;
    }
    if (!session?.user) {
      setError(t.onboarding.errSession);
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
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.onboarding.errSave);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>{t.onboarding.title}</Text>
        <Text style={styles.subtitle}>{t.onboarding.subtitle}</Text>
      </View>

      <Input
        label={t.onboarding.partnerOne}
        placeholder={t.onboarding.partnerOnePlaceholder}
        value={partnerOne}
        onChangeText={setPartnerOne}
        autoCapitalize="words"
      />
      <Input
        label={t.onboarding.partnerTwo}
        placeholder={t.onboarding.partnerTwoPlaceholder}
        value={partnerTwo}
        onChangeText={setPartnerTwo}
        autoCapitalize="words"
      />
      <Input
        label={t.onboarding.weddingDate}
        placeholder={t.onboarding.weddingDatePlaceholder}
        hint={t.onboarding.dateHint}
        value={eventDate}
        onChangeText={setEventDate}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />
      <Input
        label={t.onboarding.venue}
        placeholder={t.onboarding.venuePlaceholder}
        value={venueName}
        onChangeText={setVenueName}
        autoCapitalize="words"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label={t.onboarding.submit} onPress={submit} loading={busy} />
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

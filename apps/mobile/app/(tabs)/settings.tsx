import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { Wedding } from "@union/shared";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Card } from "../../components/Card";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useAuth } from "../../lib/auth";
import { useWedding } from "../../lib/wedding";
import { updateWedding } from "../../lib/data";
import { isValidISODate } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { colors, fontSize, fontWeight, spacing } from "../../theme/theme";

export default function Settings() {
  const { session, signOut } = useAuth();
  const { wedding, setWedding, refresh } = useWedding();
  const t = useT();

  return (
    <Screen scroll>
      <Text style={styles.sectionTitle}>{t.settings.language}</Text>
      <Text style={styles.helper}>{t.settings.languageHint}</Text>
      <View style={styles.switcherBox}>
        <LanguageSwitcher />
      </View>

      <Text style={styles.sectionTitle}>{t.settings.weddingDetails}</Text>
      {wedding ? (
        <WeddingDetails
          key={wedding.id}
          wedding={wedding}
          setWedding={setWedding}
        />
      ) : null}

      <Card style={styles.accountCard}>
        <Text style={styles.accountLabel}>{t.settings.signedInAs}</Text>
        <Text style={styles.accountValue}>{session?.user.email}</Text>
      </Card>

      <Button
        label={t.common.signOut}
        variant="ghost"
        onPress={() =>
          Alert.alert(t.common.signOutTitle, t.common.signOutConfirm, [
            { text: t.common.cancel, style: "cancel" },
            {
              text: t.common.signOut,
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

function WeddingDetails({
  wedding,
  setWedding,
}: {
  wedding: Wedding;
  setWedding: (wedding: Wedding | null) => void;
}) {
  const t = useT();
  const [partnerOne, setPartnerOne] = useState(wedding.partner_one ?? "");
  const [partnerTwo, setPartnerTwo] = useState(wedding.partner_two ?? "");
  const [eventDate, setEventDate] = useState(wedding.event_date ?? "");
  const [venueName, setVenueName] = useState(wedding.venue_name ?? "");
  const [addressLine, setAddressLine] = useState(
    wedding.address_line ?? wedding.venue_address ?? "",
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (eventDate.trim() && !isValidISODate(eventDate.trim())) {
      Alert.alert(t.common.invalidDate, t.common.invalidDateBody);
      return;
    }
    setBusy(true);
    try {
      const updated = await updateWedding(wedding.id, {
        partner_one: partnerOne.trim() || null,
        partner_two: partnerTwo.trim() || null,
        event_date: eventDate.trim() || null,
        venue_name: venueName.trim() || null,
        address_line: addressLine.trim() || null,
      });
      setWedding(updated);
      Alert.alert(t.common.saved);
    } catch (e) {
      Alert.alert(t.common.couldNotSave, e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Input
        label={t.settings.partnerOne}
        value={partnerOne}
        onChangeText={setPartnerOne}
        autoCapitalize="words"
      />
      <Input
        label={t.settings.partnerTwo}
        value={partnerTwo}
        onChangeText={setPartnerTwo}
        autoCapitalize="words"
      />
      <Input
        label={t.settings.weddingDate}
        hint={t.settings.dateHint}
        value={eventDate}
        onChangeText={setEventDate}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />
      <Input
        label={t.settings.venue}
        value={venueName}
        onChangeText={setVenueName}
        autoCapitalize="words"
      />
      <Input
        label={t.settings.venueAddress}
        value={addressLine}
        onChangeText={setAddressLine}
      />
      <Button label={t.settings.save} onPress={save} loading={busy} />
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.md,
  },
  helper: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  switcherBox: {
    marginBottom: spacing.lg,
  },
  accountCard: { marginTop: spacing.lg, gap: spacing.xs },
  accountLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  accountValue: { fontSize: fontSize.md, color: colors.text },
});

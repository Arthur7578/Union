import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../../components/Screen";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { useWedding } from "../../../lib/wedding";
import { addGuest } from "../../../lib/data";
import { colors, fontSize, spacing } from "../../../theme/theme";

export default function NewGuest() {
  const { wedding } = useWedding();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [group, setGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!firstName.trim()) {
      setError("A first name is required.");
      return;
    }
    if (!wedding) {
      setError("No wedding found.");
      return;
    }
    const size = Math.max(1, parseInt(partySize, 10) || 1);
    setBusy(true);
    setError(null);
    try {
      await addGuest({
        wedding_id: wedding.id,
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        party_size: size,
        guest_group: group.trim() || null,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add guest.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Input
        label="First name"
        placeholder="Jordan"
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        autoFocus
      />
      <Input
        label="Last name (optional)"
        placeholder="Rivera"
        value={lastName}
        onChangeText={setLastName}
        autoCapitalize="words"
      />
      <Input
        label="Email (optional)"
        placeholder="jordan@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
        autoCorrect={false}
      />
      <Input
        label="Party size"
        hint="How many people this invitation covers (incl. plus-ones)."
        value={partySize}
        onChangeText={setPartySize}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={2}
      />
      <Input
        label="Group (optional)"
        placeholder="e.g. Family, College friends"
        value={group}
        onChangeText={setGroup}
        autoCapitalize="words"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button label="Add guest" onPress={submit} loading={busy} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
  },
  actions: { gap: spacing.sm },
});

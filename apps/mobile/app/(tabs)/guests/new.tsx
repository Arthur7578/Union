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
  const [age, setAge] = useState<string>("");
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
    setBusy(true);
    setError(null);
    try {
      const parsedAge =
        age.trim() === "" ? null : Math.max(0, Math.min(130, parseInt(age, 10)));
      await addGuest({
        wedding_id: wedding.id,
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        age_years: Number.isFinite(parsedAge as number) ? parsedAge : null,
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
        label="Age (optional)"
        hint="Used to suggest meal / bed choices."
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={3}
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

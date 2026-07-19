import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useAuth } from "../../lib/auth";
import { colors, fontSize, fontWeight, spacing } from "../../theme/theme";

export default function SignIn() {
  const { signInWithMagicLink } = useAuth();
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendLink = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithMagicLink(email);
      setStep("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Union</Text>
          <Text style={styles.tagline}>
            Plan your wedding, calmly and in control.
          </Text>
        </View>

        {step === "email" ? (
          <View>
            <Input
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={sendLink}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="Email me a sign-in link"
              onPress={sendLink}
              loading={busy}
            />
          </View>
        ) : (
          <View>
            <Text style={styles.helper}>
              We sent a sign-in link to {email}. Open it on this phone and
              you'll come back here signed in. The link expires in 1 hour.
            </Text>
            <Button
              label="Use a different email"
              variant="ghost"
              onPress={() => {
                setStep("email");
                setError(null);
              }}
              style={styles.ghostSpacing}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.xxl,
    alignItems: "center",
  },
  brand: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  helper: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  ghostSpacing: {
    marginTop: spacing.sm,
  },
});

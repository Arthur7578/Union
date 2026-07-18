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
  const { signInWithOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithOtp(email);
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    if (code.trim().length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(email, code);
      // Navigation is handled by the root gate once the session updates.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
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
              onSubmitEditing={sendCode}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Send me a code" onPress={sendCode} loading={busy} />
          </View>
        ) : (
          <View>
            <Text style={styles.helper}>
              We emailed a 6-digit code to {email}.
            </Text>
            <Input
              label="Verification code"
              placeholder="123456"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              returnKeyType="go"
              onSubmitEditing={confirmCode}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Verify & continue" onPress={confirmCode} loading={busy} />
            <Button
              label="Use a different email"
              variant="ghost"
              onPress={() => {
                setStep("email");
                setCode("");
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

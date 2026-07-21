import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useAuth } from "../../lib/auth";
import { colors, fontSize, fontWeight, spacing } from "../../theme/theme";

export default function SignIn() {
  const { sendEmailOtp, verifyEmailOtp } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<TextInput>(null);

  const sendCode = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendEmailOtp(email);
      setCode("");
      setStep("code");
      // Small delay so the field mounts before we try to focus it.
      setTimeout(() => codeInputRef.current?.focus(), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, code);
      // AuthProvider's onAuthStateChange picks up the new session and the
      // (auth) group's route guard redirects out.
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That code didn't work — try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setBusy(true);
    try {
      await sendEmailOtp(email);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code.");
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
            <Button
              label="Email me a code"
              onPress={sendCode}
              loading={busy}
            />
          </View>
        ) : (
          <View>
            <Text style={styles.helper}>
              We sent a 6-digit code to {email}. Enter it below to finish
              signing in.
            </Text>
            <Input
              ref={codeInputRef}
              label="6-digit code"
              placeholder="123456"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoCorrect={false}
              maxLength={6}
              returnKeyType="go"
              onSubmitEditing={verifyCode}
              style={styles.codeInput}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Sign in" onPress={verifyCode} loading={busy} />
            <Button
              label="Resend code"
              variant="ghost"
              onPress={resend}
              disabled={busy}
              style={styles.ghostSpacing}
            />
            <Button
              label="Use a different email"
              variant="ghost"
              onPress={() => {
                setStep("email");
                setError(null);
                setCode("");
              }}
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
  codeInput: {
    letterSpacing: 6,
    textAlign: "center",
    fontSize: fontSize.xl,
    fontVariant: ["tabular-nums"],
  },
});

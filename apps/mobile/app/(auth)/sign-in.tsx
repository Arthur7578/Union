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
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useAuth } from "../../lib/auth";
import { useT } from "../../lib/i18n";
import { colors, fontSize, fontWeight, spacing } from "../../theme/theme";

export default function SignIn() {
  const { sendEmailOtp, verifyEmailOtp } = useAuth();
  const t = useT();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<TextInput>(null);

  const sendCode = async () => {
    if (!email.trim()) {
      setError(t.signIn.errEmail);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendEmailOtp(email);
      setCode("");
      setStep("code");
      setTimeout(() => codeInputRef.current?.focus(), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.signIn.errSend);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 8) {
      setError(t.signIn.errCodeLength);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, code);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.signIn.errVerify);
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
      setError(e instanceof Error ? e.message : t.signIn.errSend);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.switcherRow}>
          <LanguageSwitcher />
        </View>

        <View style={styles.header}>
          <Text style={styles.brand}>Union</Text>
          <Text style={styles.tagline}>{t.signIn.tagline}</Text>
        </View>

        {step === "email" ? (
          <View>
            <Input
              label={t.signIn.emailLabel}
              placeholder={t.signIn.emailPlaceholder}
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
            <Button label={t.signIn.sendCode} onPress={sendCode} loading={busy} />
          </View>
        ) : (
          <View>
            <Text style={styles.helper}>{t.signIn.codeHelper(email)}</Text>
            <Input
              ref={codeInputRef}
              label={t.signIn.codeLabel}
              placeholder={t.signIn.codePlaceholder}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 8))}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoCorrect={false}
              maxLength={8}
              returnKeyType="go"
              onSubmitEditing={verifyCode}
              style={styles.codeInput}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label={t.signIn.submit} onPress={verifyCode} loading={busy} />
            <Button
              label={t.signIn.resend}
              variant="ghost"
              onPress={resend}
              disabled={busy}
              style={styles.ghostSpacing}
            />
            <Button
              label={t.signIn.useDifferentEmail}
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
  switcherRow: {
    alignItems: "flex-end",
    marginTop: spacing.md,
  },
  header: {
    marginTop: spacing.xl,
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
    letterSpacing: 4,
    textAlign: "center",
    fontSize: fontSize.xl,
    fontVariant: ["tabular-nums"],
  },
});

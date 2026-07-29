import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  colors,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from "../theme/theme";
import { useLocale, type Locale } from "../lib/i18n";

/** Segmented control for switching between the app's available locales.
 *  Compact enough to sit inside the Settings screen or above sign-in. */
export function LanguageSwitcher() {
  const { locale, locales, setLocale, t } = useLocale();
  const labels: Record<Locale, string> = {
    en: t.lang.en,
    fr: t.lang.fr,
  };
  return (
    <View style={styles.wrap}>
      {locales.map((code) => {
        const active = locale === code;
        return (
          <Pressable
            key={code}
            onPress={() => setLocale(code)}
            style={({ pressed }) => [
              styles.opt,
              active && styles.optActive,
              pressed && styles.optPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.text, active && styles.textActive]}>
              {labels[code]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignSelf: "flex-start",
  },
  opt: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  optActive: {
    backgroundColor: colors.primary,
  },
  optPressed: {
    opacity: 0.85,
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  textActive: {
    color: colors.primaryContrast,
  },
});

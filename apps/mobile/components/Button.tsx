import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from "react-native";
import { colors, fontSize, fontWeight, radius, spacing, MIN_TOUCH } from "../theme/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      // Enlarge the effective tap area beyond the visual bounds.
      hitSlop={8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "secondary" || variant === "ghost" ? colors.primary : colors.primaryContrast}
        />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: { backgroundColor: colors.dangerBg },
  ghost: { backgroundColor: "transparent" },
};

const labelStyles: Record<Variant, { color: string }> = {
  primary: { color: colors.primaryContrast },
  secondary: { color: colors.text },
  danger: { color: colors.danger },
  ghost: { color: colors.primary },
};

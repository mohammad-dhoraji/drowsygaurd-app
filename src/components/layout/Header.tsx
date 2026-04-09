import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/useThemeColor";

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  logo?: boolean;
}

export function Header({
  title,
  subtitle,
  rightSlot,
  logo = false,
}: HeaderProps) {
  const borderColor = useThemeColor({}, "border");

  return (
    <View style={[styles.container, { borderBottomColor: borderColor }]}>
      <View style={styles.leftSection}>
        {logo && (
          <Image
            source={require("../../../assets/DrowsyGuard-Logo-Mark.png")}
            style={styles.logo}
          />
        )}
        <View style={styles.textBlock}>
          <ThemedText type="title">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="muted" style={styles.subtitle}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  logo: {
    width: 40,
    height: 40,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  subtitle: {
    lineHeight: 20,
  },
  rightSlot: {
    flexShrink: 0,
  },
});

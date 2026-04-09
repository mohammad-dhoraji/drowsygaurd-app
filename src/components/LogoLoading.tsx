import { ActivityIndicator, StyleSheet, View, Image } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

export function LogoLoading() {
  const backgroundColor = useThemeColor({}, "background");

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Image
        source={require("../../assets/DrowsyGuard-Logo-Mark.png")}
        style={styles.logo}
      />
      <ActivityIndicator size="large" color="#064e3b" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  logo: {
    width: 120,
    height: 120,
    opacity: 0.8,
    marginBottom: 32,
  },
  spinner: {
    marginTop: 16,
  },
});

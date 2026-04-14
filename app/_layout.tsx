import "../global.css";
import { Stack } from "expo-router";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";

import { LogoLoading } from "@/components/LogoLoading";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { AuthProvider } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

function RootLayoutNav() {
  const { isInitialized } = useAuth();

  console.log("[layout] RootLayoutNav rendered, isInitialized:", isInitialized);

  // 🔥 Splash screen control
  useEffect(() => {
    console.log("[layout] useEffect: isInitialized changed to:", isInitialized);

    if (isInitialized) {
      console.log("[layout] calling SplashScreen.hideAsync()");
      void SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  // 🚀 OTA UPDATE LOGIC (runs AFTER app is ready)
  useEffect(() => {
    if (!isInitialized) return;

    async function checkForUpdates() {
      try {
        console.log("[OTA] Checking for updates...");

        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();

          alert("Update available. Restarting...");
          await Updates.reloadAsync();
        } else {
          console.log("[OTA] No update available");
        }
      } catch (error) {
        console.log("[OTA] Error checking update:", error);
      }
    }

    checkForUpdates();
  }, [isInitialized]);

  // ⛔ Show loading until auth is ready
  if (!isInitialized) {
    console.log("[layout] rendering LogoLoading because isInitialized=false");
    return <LogoLoading />;
  }

  console.log("[layout] rendering Stack navigation because isInitialized=true");

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(main)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

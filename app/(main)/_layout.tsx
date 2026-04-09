import { Redirect, Tabs } from "expo-router";
import { Home, Focus, List, MapPin, User } from "lucide-react-native";
import { useColorScheme } from "react-native";

import { LogoLoading } from "@/components/LogoLoading";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useCurrentUserProfile();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const role = profile?.role;

  // Show loading while initializing auth only
  // Profile loading is handled gracefully inside the screens (like home/index.tsx)
  if (isLoading) return <LogoLoading />;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? '#10b981' : '#064e3b',
        tabBarInactiveTintColor: isDark ? '#6b7280' : '#9ca3af',
        tabBarStyle: {
          height: 65,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: isDark ? '#111827' : '#ffffff',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#1f2937' : '#f3f4f6',
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          marginTop: 2,
          fontSize: 11,
          fontWeight: '500',
        }
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={24} color={color} strokeWidth={2.2} />,
        }}
      />

      <Tabs.Screen
        name="drivers/index"
        options={{
          title: "Monitoring",
          href: role === 'guardian' ? null : undefined,
          tabBarIcon: ({ color }) => <Focus size={24} color={color} strokeWidth={2.2} />,
        }}
      />

      <Tabs.Screen
        name="logs/index"
        options={{
          title: "Logs",
          tabBarIcon: ({ color }) => <List size={24} color={color} strokeWidth={2.2} />,
        }}
      />

      <Tabs.Screen
        name="location/index"
        options={{
          title: "Location",
          href: role === 'driver' ? null : undefined,
          tabBarIcon: ({ color }) => <MapPin size={24} color={color} strokeWidth={2.2} />,
        }}
      />

      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={24} color={color} strokeWidth={2.2} />,
        }}
      />
    </Tabs>
  );
}

import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { Header } from '@/components/layout/Header';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { SectionCard } from '@/components/layout/SectionCard';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <ScreenWrapper contentContainerStyle={styles.screenContent}>
      <View style={styles.headerSection}>
        <Header title="Route Not Found" subtitle="The requested screen is not registered in the app route tree." />
      </View>

      <View style={styles.contentSection}>
        <SectionCard title="Recovery" subtitle="Return to the home screen and continue navigation from there.">
          <ThemedText>
            This usually means a stale link or an outdated route name.
          </ThemedText>
          <Link href="/home" asChild>
            <Button className="w-full" title="Go Home" />
          </Link>
        </SectionCard>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
  },
  headerSection: {
    gap: 12,
  },
  contentSection: {
    gap: 16,
  },
});

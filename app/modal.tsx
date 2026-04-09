import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { Header } from '@/components/layout/Header';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui/Button';

export default function ModalScreen() {
  return (
    <ScreenWrapper contentContainerStyle={styles.screenContent}>
      <View style={styles.headerSection}>
        <Header title="Modal" subtitle="Focused action modal." />
      </View>

      <View style={styles.contentSection}>
        <SectionCard title="Navigation" subtitle="Return to the main app when you are done here.">
          <Link href="/(main)/home" replace asChild>
            <Button className="w-full" title="Go to home screen" />
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

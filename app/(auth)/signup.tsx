import { useState, useEffect } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { SectionCard } from '@/components/layout/SectionCard';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [role, setRole] = useState<'driver' | 'guardian'>('guardian');
  const params = useLocalSearchParams<{ role: 'driver' | 'guardian' }>();
  useEffect(() => {
    if (params.role) {
      setRole(params.role as 'driver' | 'guardian');
    }
  }, [params.role]);

  const handleSignup = async () => {
    setMessage('');

    try {
      setIsSubmitting(true);
      const { error } = await signUp(email, password, role);

      if (error) {
        setMessage(error);
      } else {
        setMessage('Account created. Check your email for the confirmation link.');
        setEmail('');
        setPassword('');
      }
    } catch (error) {
      setMessage('Sign up failed. Please try again.');
      console.warn('[auth] Sign up failed.', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenWrapper scroll contentContainerStyle={styles.screenContent}>
      <View style={styles.headerSection}>
        <Header
          title={role === 'driver' ? 'Create Driver Account' : 'Create Guardian Account'}
          subtitle={role === 'driver' ? 'Access the driver monitoring dashboard' : 'Register a guardian account to access monitoring screens.'}
          logo={true}
        />
      </View>

      <View style={styles.contentSection}>
        <SectionCard title="Sign up" subtitle="Register with Supabase to create your account.">
          <View style={styles.fieldGroup}>
            <ThemedText type="defaultSemiBold">Email</ThemedText>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder={role === 'driver' ? 'driver@example.com' : 'guardian@example.com'}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            /> 
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText type="defaultSemiBold">Password</ThemedText>
            <TextInput
              autoCapitalize="none"
              placeholder="Create password"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {message ? <ThemedText type="muted">{message}</ThemedText> : null}

          <Button
            className="w-full"
            disabled={isSubmitting}
            loading={isSubmitting}
            onPress={handleSignup}
            title={isSubmitting ? 'Creating account...' : 'Create account'}
          />
        </SectionCard>
      </View>

      <View style={styles.footerSection}>
        <SectionCard title="Already have access?" subtitle="Jump back to the login screen.">
          <Link href="/(auth)/login" asChild>
            <Button
              className="w-full border border-primary dark:border-primary-light"
              textClassName="text-primary dark:text-primary-light"
              title="Sign in instead"
              variant="ghost"
            />
          </Link>
        </SectionCard>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
  },
  headerSection: {
    gap: 12,
  },
  contentSection: {
    gap: 16,
  },
  footerSection: {
    marginTop: 'auto',
  },
  fieldGroup: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D7E1EC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
});

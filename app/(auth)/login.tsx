import { useState } from 'react';
import { Link } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { SectionCard } from '@/components/layout/SectionCard';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function LoginScreen() {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [role, setRole] = useState<'driver' | 'guardian'>('guardian');

  const handleLogin = async () => {
    setErrorMessage('');

    try {
      setIsSubmitting(true);
      const { error } = await signIn(email, password);

      if (error) {
        setErrorMessage(error);
      } else {
        setEmail('');
        setPassword('');
      }
    } catch (error) {
      setErrorMessage('Sign in failed. Please try again.');
      console.warn('[auth] Sign in failed.', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage('');

    try {
      setIsGoogleSubmitting(true);
      const { error } = await signInWithGoogle();

      if (error) {
        setErrorMessage(error);
        Alert.alert('Google sign-in failed', error);
      }
    } catch (error) {
      const fallbackMessage = 'Google sign-in failed. Please try again.';
      setErrorMessage(fallbackMessage);
      Alert.alert('Google sign-in failed', fallbackMessage);
      console.warn('[auth] Google sign in failed.', error);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const isAnyLoading = isSubmitting || isGoogleSubmitting;

  return (
    <ScreenWrapper scroll contentContainerStyle={styles.screenContent}>
      <View style={styles.headerSection}>
        <Header
          title={role === 'driver' ? 'Driver Login' : 'Guardian Login'}
          subtitle={role === 'driver' ? 'Access the driver monitoring dashboard' : 'Sign in with your guardian account to access monitoring screens.'}
          logo={true}
        />
        <SectionCard title="Account Type" subtitle="Choose the account type you want to sign in with.">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              className={`flex-1 ${role === 'driver' ? 'bg-primary' : 'variant=ghost'}`}
              onPress={() => setRole('driver')}
              title="Driver"
            />
            <Button
              className={`flex-1 ${role === 'guardian' ? 'bg-primary' : 'variant=ghost'}`}
              onPress={() => setRole('guardian')}
              title="Guardian"
            />
          </View>
        </SectionCard>
      </View>

      <View style={styles.contentSection}> 
        <SectionCard title="Sign in" subtitle="Authenticate with your Supabase credentials.">
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
              placeholder="Enter password"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {errorMessage ? <ThemedText type="muted">{errorMessage}</ThemedText> : null}

          <Button
            className="w-full"
            disabled={isAnyLoading}
            loading={isSubmitting}
            onPress={handleLogin}
            title={isSubmitting ? 'Signing in...' : 'Sign in'}
          />

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <ThemedText type="muted">or</ThemedText>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            disabled={isAnyLoading}
            onPress={handleGoogleLogin}
            style={[styles.googleButton, isAnyLoading ? styles.disabledButton : undefined]}
          >
            {isGoogleSubmitting ? (
              <ThemedText type="defaultSemiBold">Connecting...</ThemedText>
            ) : (
              <>
                <FontAwesome name="google" size={18} color="#DB4437" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </SectionCard>
      </View>

      <View style={styles.footerSection}>
        <SectionCard title="Need access?" subtitle="Create a new guardian account.">
          <Link href={{ pathname: '/(auth)/signup', params: { role } }} asChild>
            <Button
              className="w-full border border-primary dark:border-primary-light"
              textClassName="text-primary dark:text-primary-light"
              title="Create account"
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
    color: '#000',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D7E1EC',
  },
  googleButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D7E1EC',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  googleButtonText: {
    color: '#12263A',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

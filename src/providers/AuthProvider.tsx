import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { signInWithGoogleOAuth } from '@/features/auth/services/googleOAuth';
import { SUPABASE_CONFIGURED, supabase } from '@/lib/supabase';

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, role?: 'driver' | 'guardian') => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user) return null;

  return {
    id: user.id,
    name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'User',
    email: user.email ?? '',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        console.log('[auth] init: starting getSession...');
        // 🔥 CRITICAL: allow Supabase to hydrate session (native fix)
        await new Promise(resolve => setTimeout(resolve, 300));

        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log('[auth] init: getSession returned session:', !!session);

        if (isMounted) {
          console.log('[auth] init: isMounted=true, calling setSession...');
          setSession(session);
        } else {
          console.log('[auth] init: isMounted=false, skipping setSession');
        }
      } catch (err) {
        console.log('[auth] init error:', err);
        if (isMounted) {
          console.log('[auth] init: setting session to null due to error');
          setSession(null);
        }
      } finally {
        if (isMounted) {
          console.log('[auth] init: finally block - calling setIsInitialized(true)');
          setIsInitialized(true); // 🚨 MUST ALWAYS RUN
        } else {
          console.log('[auth] init: finally block - isMounted=false, NOT calling setIsInitialized');
        }
      }
    };

    if (SUPABASE_CONFIGURED) {
      console.log('[auth] useEffect: SUPABASE_CONFIGURED=true, calling init()');
      init();
    } else {
      console.log('[auth] useEffect: SUPABASE_CONFIGURED=false, setting isInitialized(true)');
      setIsInitialized(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      console.log('[auth] onAuthStateChange fired:', _event, 'session:', !!session);

      setSession(session);
      console.log('[auth] onAuthStateChange: calling setIsInitialized(true)');
      setIsInitialized(true); // safe now
    });

    return () => {
      console.log('[auth] useEffect cleanup: unsubscribing');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(async () => signInWithGoogleOAuth(), []);

  const signUp = useCallback(
    async (email: string, password: string, role?: 'driver' | 'guardian') => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: role || 'guardian' } },
      });
      return { error: error?.message ?? null };
    },
    []
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error: error?.message ?? null };
  }, []);

  const user = mapSupabaseUser(session?.user ?? null);

  const value = useMemo(
    () => ({
      session,
      user,
      isAuthenticated: !!session,
      isLoading: !isInitialized,
      isInitialized,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
    }),
    [session, user, isInitialized, signIn, signInWithGoogle, signUp, signOut]
  );

  console.log('[auth] context value updated:', {
    isInitialized,
    isAuthenticated: !!session,
    userId: user?.id,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuthContext = () => useContext(AuthContext);
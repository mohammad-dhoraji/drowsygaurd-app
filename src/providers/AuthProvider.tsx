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

import { signInWithGoogleOAuth } from '@/features/auth/services/googleOAuth';
import { SUPABASE_CONFIGURED, supabase } from '@/lib/supabase';
import { setGlobalAccessToken } from '@/services/apiService';
import { usePushNotifications } from '@/hooks/usePushNotifications';

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
  signUp: (
    email: string,
    password: string,
    role?: 'driver' | 'guardian'
  ) => Promise<{ error: string | null }>;
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
  const [session, setSessionState] = useState<Session | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const setSession = useCallback((newSession: Session | null) => {
    setSessionState(newSession);
    setGlobalAccessToken(newSession?.access_token ?? null);
  }, []);

  // 🔥 INIT SESSION
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        console.log('[auth] init: starting getSession...');

        // allow Supabase to hydrate session
        await new Promise(resolve => setTimeout(resolve, 300));

        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log('[auth] init: session exists:', !!session);

        if (isMounted) {
          setSession(session);
        }
      } catch (err) {
        console.log('[auth] init error:', err);
        if (isMounted) setSession(null);
      } finally {
        if (isMounted) {
          setIsInitialized(true); // MUST RUN
        }
      }
    };

    if (SUPABASE_CONFIGURED) {
      init();
    } else {
      setIsInitialized(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      console.log('[auth] state change:', _event, !!session);
      setSession(session);
      setIsInitialized(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 🔐 AUTH METHODS
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(
    async () => signInWithGoogleOAuth(),
    []
  );

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

  console.log('[auth] context:', {
    isInitialized,
    isAuthenticated: !!session,
    userId: user?.id,
  });

  // 🚀 PUSH NOTIFICATIONS (SAFE POSITION)
  usePushNotifications();

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
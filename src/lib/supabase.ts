import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const configuredAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export const SUPABASE_CONFIGURED = Boolean(configuredUrl && configuredAnonKey);

const supabaseUrl = SUPABASE_CONFIGURED
  ? configuredUrl
  : 'https://placeholder-project.invalid';

const supabaseAnonKey = SUPABASE_CONFIGURED
  ? configuredAnonKey
  : 'public-anon-key-not-configured-yet';

const isWeb = Platform.OS === 'web';

// Web storage adapter for Supabase - safely handles SSR/Node.js environments
const webStorageAdapter = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail if localStorage is not available
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail if localStorage is not available
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isWeb ? webStorageAdapter : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: isWeb,
  },
});
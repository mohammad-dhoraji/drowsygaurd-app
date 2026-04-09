import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { SUPABASE_CONFIGURED, supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

interface OAuthResult {
  error: string | null;
}

function getRedirectUrl() {
  const isWeb = Platform.OS === 'web';

  if (isWeb) {
    // For web, return the current origin
    return typeof window !== 'undefined' ? window.location.origin : '';
  }

  // For mobile, use expo's redirect URI scheme
  return AuthSession.makeRedirectUri({
    scheme: "drowsyguard",
    path: "auth",
  });
}

function parseOAuthTokens(redirectUrl: string) {
  const hashPart = redirectUrl.includes("#") ? redirectUrl.split("#")[1] : "";
  const queryPart = redirectUrl.includes("?") ? redirectUrl.split("?")[1] : "";
  const rawParams = hashPart || queryPart;
  const params = new URLSearchParams(rawParams);

  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    errorDescription: params.get("error_description") ?? params.get("error"),
  };
}

async function signInWithGoogleMobile(): Promise<OAuthResult> {
  const redirectTo = getRedirectUrl();
  console.log("MOBILE REDIRECT URL 👉", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data?.url) {
    return { error: "Google sign-in could not be started." };
  }

  const browserResult = await WebBrowser.openAuthSessionAsync(
    data.url,
    redirectTo,
  );
  console.log("BROWSER RESULT 👉", browserResult);

  if (browserResult.type !== "success") {
    if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
      return { error: "Google sign-in was cancelled." };
    }
    return { error: "Google sign-in did not complete successfully." };
  }

  const { accessToken, refreshToken, errorDescription } = parseOAuthTokens(
    browserResult.url,
  );

  if (errorDescription) {
    return { error: decodeURIComponent(errorDescription) };
  }

  if (!accessToken || !refreshToken) {
    return { error: "Google sign-in returned an invalid session." };
  }

  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return { error: setSessionError?.message ?? null };
}

async function signInWithGoogleWeb(): Promise<OAuthResult> {
  const redirectTo = getRedirectUrl();
  console.log("WEB REDIRECT URL 👉", redirectTo);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // On web, the OAuth flow will handle the redirect automatically
  // The session will be restored via onAuthStateChange in AuthProvider
  return { error: null };
}

export async function signInWithGoogleOAuth(): Promise<OAuthResult> {
  if (!SUPABASE_CONFIGURED) {
    return {
      error: "Supabase is not configured yet. Add EXPO_PUBLIC_SUPABASE_* values.",
    };
  }

  const isWeb = Platform.OS === 'web';

  if (isWeb) {
    return signInWithGoogleWeb();
  }

  return signInWithGoogleMobile();
}

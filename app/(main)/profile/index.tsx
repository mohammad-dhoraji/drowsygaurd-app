import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  RefreshControl,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bell, ChevronRight, LogOut, Settings, Shield, User, Users } from 'lucide-react-native';
import { router } from 'expo-router';

import { Header } from '@/components/layout/Header';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useLinkGuardian, useMyDrivers, useMyGuardians } from '@/hooks/useGuardianApi';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString();
}

function SettingRow({
  icon: Icon,
  title,
  value,
  border = true,
  onPress,
}: {
  icon: typeof User;
  title: string;
  value?: string;
  border?: boolean;
  onPress?: () => void;
}) {
  return (
<TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`flex-row items-center py-4 ${
        border ? 'border-b border-gray-100 dark:border-gray-800' : ''
      }`}>
      <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mr-4">
        <Icon size={16} color="#6b7280" />
      </View>
      <Text className="flex-1 text-gray-900 dark:text-white font-medium text-base">{title}</Text>
      {value ? <Text className="text-gray-500 dark:text-gray-400 mr-2">{value}</Text> : null}
      <ChevronRight size={20} color="#9ca3af" />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const profileQuery = useCurrentUserProfile();
  const role = profileQuery.data?.role;
  const isDriver = role === 'driver';
  const isGuardian = role === 'guardian';

  const guardiansQuery = useMyGuardians({ enabled: isDriver });
  const driversQuery = useMyDrivers({ enabled: isGuardian });
  const linkGuardianMutation = useLinkGuardian();

  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success');

  // New modal states
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState< 'system'>('system');

  const refreshProfile = useCallback(async () => {
    const tasks: Promise<{ error: Error | null }>[] = [profileQuery.refetch()];

    if (isDriver) {
      tasks.push(guardiansQuery.refetch());
    }

    if (isGuardian) {
      tasks.push(driversQuery.refetch());
    }

    const results = await Promise.all(tasks);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      throw failed.error;
    }
  }, [driversQuery, guardiansQuery, isDriver, isGuardian, profileQuery]);

  const { refreshing, onRefresh, refreshError, clearRefreshError, lastUpdatedAt } =
    usePullToRefresh(refreshProfile);

  useRefreshOnFocus(onRefresh, { enabled: Boolean(user?.id) });

  const profileName = profileQuery.data?.name || user?.name || 'Account User';
  const profileEmail = profileQuery.data?.email || user?.email || 'No email';

  const roleLabel = useMemo(() => {
    if (isDriver) {
      return 'Driver';
    }

    if (isGuardian) {
      return 'Guardian';
    }

    return 'Unknown';
  }, [isDriver, isGuardian]);

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        setFeedbackTone('error');
        setFeedbackMessage(error);
        return;
      }

      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      setFeedbackTone('error');
      setFeedbackMessage('Unable to sign out right now. Please try again.');
    }
  };

  const handleLinkGuardian = async () => {
    setFeedbackMessage(null);

    try {
      const result = await linkGuardianMutation.mutateAsync(guardianEmail);

      setFeedbackTone('success');
      setFeedbackMessage(result?.message || 'Guardian linked successfully.');
      setGuardianEmail('');
      setIsLinkModalVisible(false);
      await guardiansQuery.refetch();
    } catch (error) {
      setFeedbackTone('error');
      setFeedbackMessage(error instanceof Error ? error.message : 'Unable to link guardian.');
    }
  };

  return (
    <>
      <ScreenWrapper
        scroll
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Header title="Profile" subtitle={`${roleLabel} account settings`} logo={true} />

        {lastUpdatedAt ? (
          <Text className="text-xs text-gray-400 dark:text-gray-500">
            Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}
          </Text>
        ) : null}

        {refreshError ? (
          <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-4">
              <Text className="text-red-700 dark:text-red-300">{refreshError}</Text>
              <Text onPress={clearRefreshError} className="text-red-600 dark:text-red-400 mt-2 font-semibold">
                Dismiss
              </Text>
            </CardContent>
          </Card>
        ) : null}

        {feedbackMessage ? (
          <Card
            className={
              feedbackTone === 'success'
                ? 'border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border border-red-300 bg-red-50 dark:bg-red-900/20'
            }>
            <CardContent className="p-4">
              <Text
                className={
                  feedbackTone === 'success'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-700 dark:text-red-300'
                }>
                {feedbackMessage}
              </Text>
            </CardContent>
          </Card>
        ) : null}

        {profileQuery.isError ? (
          <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-4">
              <Text className="text-red-700 dark:text-red-300">Unable to load your profile details.</Text>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mb-2 border-0 shadow-sm relative overflow-visible">
          <CardContent className="p-6 items-center">
            <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-4 border-4 border-white dark:border-gray-900 shadow-lg">
              <User size={40} color="#ffffff" strokeWidth={1.5} />
            </View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{profileName}</Text>
            <Text className="text-gray-500 dark:text-gray-400 font-medium">{profileEmail}</Text>
            <Text className="text-gray-400 dark:text-gray-500 text-sm mt-2 uppercase tracking-wider">
              {roleLabel}
            </Text>

            {isDriver ? (
              <Button
                title="Link Guardian"
                onPress={() => setIsLinkModalVisible(true)}
                className="mt-4 px-6"
              />
            ) : null}
          </CardContent>
        </Card>

        <Text className="text-sm font-bold text-gray-500 tracking-wider uppercase mb-3 ml-2">Preferences</Text>
        <Card className="mb-2 border-0 shadow-sm">
          <CardContent className="py-2 px-4">
            <SettingRow 
              icon={Bell} 
              title="Notifications" 
              value={notificationsEnabled ? 'Enabled' : 'Disabled'}
              onPress={() => setShowNotificationsModal(true)} />
            {/* <SettingRow icon={Shield} title="Privacy & Safety" value="High" /> */}
            <SettingRow 
              icon={Settings} 
              title="App Theme" 
              value={selectedTheme.charAt(0).toUpperCase() + selectedTheme.slice(1)}
              border={false}
              onPress={() => setShowThemeModal(true)} />
          </CardContent>
        </Card>

        {isDriver ? (
          <>
            <Text className="text-sm font-bold text-gray-500 tracking-wider uppercase mb-3 ml-2">
              Linked Guardians
            </Text>

            {guardiansQuery.isLoading ? (
              <Card>
                <CardContent className="p-4">
                  <Text className="text-gray-600 dark:text-gray-300">Loading linked guardians...</Text>
                </CardContent>
              </Card>
            ) : null}

            {guardiansQuery.isError ? (
              <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
                <CardContent className="p-4">
                  <Text className="text-red-700 dark:text-red-300">
                    Unable to load linked guardians right now.
                  </Text>
                </CardContent>
              </Card>
            ) : null}

            {!guardiansQuery.isLoading && !guardiansQuery.isError && guardiansQuery.data?.length === 0 ? (
              <Card>
                <CardContent className="p-4">
                  <Text className="text-gray-500 dark:text-gray-400">No guardians linked yet.</Text>
                </CardContent>
              </Card>
            ) : null}

            {(guardiansQuery.data ?? []).map((guardian) => (
              <Card key={guardian.id}>
                <CardContent className="p-4">
                  <Text className="text-gray-900 dark:text-white font-semibold">
                    {guardian.name || 'Unnamed guardian'}
                  </Text>
                  <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">{guardian.email}</Text>
                  <Text className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                    Linked {formatDateTime(guardian.linked_at)}
                  </Text>
                </CardContent>
              </Card>
            ))}
          </>
        ) : null}

        {isGuardian ? (
          <>
            <Text className="text-sm font-bold text-gray-500 tracking-wider uppercase mb-3 ml-2">
              Monitored Drivers
            </Text>

            {driversQuery.isLoading ? (
              <Card>
                <CardContent className="p-4">
                  <Text className="text-gray-600 dark:text-gray-300">Loading monitored drivers...</Text>
                </CardContent>
              </Card>
            ) : null}

            {driversQuery.isError ? (
              <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
                <CardContent className="p-4">
                  <Text className="text-red-700 dark:text-red-300">
                    Unable to load monitored drivers right now.
                  </Text>
                </CardContent>
              </Card>
            ) : null}

            {!driversQuery.isLoading && !driversQuery.isError && driversQuery.data?.length === 0 ? (
              <Card>
                <CardContent className="p-4">
                  <Text className="text-gray-500 dark:text-gray-400">No drivers are linked to this account yet.</Text>
                </CardContent>
              </Card>
            ) : null}

            {(driversQuery.data ?? []).map((driver) => (
              <Card key={driver.id}>
                <CardContent className="p-4 flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-4">
                    <Users size={18} color="#3b82f6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 dark:text-white font-semibold">
                      {driver.name || 'Unnamed driver'}
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">{driver.email}</Text>
                    <Text className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                      Linked {formatDateTime(driver.linked_at)}
                    </Text>
                  </View>
                </CardContent>
              </Card>
            ))}
          </>
        ) : null}

        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center justify-center bg-red-100 dark:bg-red-900/30 py-4 rounded-xl active:opacity-80">
          <LogOut size={20} color="#ef4444" />
          <Text className="text-red-600 dark:text-red-400 font-bold text-lg ml-2">Sign Out</Text>
        </TouchableOpacity>
      </ScreenWrapper>

      <Modal
        animationType="slide"
        transparent
        visible={isLinkModalVisible}
        onRequestClose={() => setIsLinkModalVisible(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white dark:bg-gray-900 rounded-t-3xl p-6">
            <Text className="text-xl font-bold text-gray-900 dark:text-white">Link Guardian</Text>
            <Text className="text-gray-500 dark:text-gray-400 mt-2">
              Enter the guardian email address you want to link to this driver account.
            </Text>

            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="guardian@example.com"
              placeholderTextColor="#9ca3af"
              value={guardianEmail}
              onChangeText={setGuardianEmail}
              className="border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-4 mt-5 text-gray-900 dark:text-white"
            />

            {feedbackTone === 'error' && feedbackMessage ? (
              <Text className="text-red-600 dark:text-red-400 mt-3">{feedbackMessage}</Text>
            ) : null}

            <View className="flex-row gap-3 mt-6">
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setIsLinkModalVisible(false);
                  setGuardianEmail('');
                }}
                className="flex-1"
              />
              <Button
                title={linkGuardianMutation.isPending ? 'Linking...' : 'Submit'}
                loading={linkGuardianMutation.isPending}
                onPress={() => {
                  void handleLinkGuardian();
                }}
                className="flex-1"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Notifications Settings Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showNotificationsModal}
        onRequestClose={() => setShowNotificationsModal(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white dark:bg-gray-900 rounded-t-3xl p-6">
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">Notifications</Text>
            <View className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-gray-900 dark:text-white font-medium">Enable Notifications</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#f4f4f4', true: '#3b82f6' }}
                thumbColor={notificationsEnabled ? '#ffffff' : '#f4f4f4'}
                ios_backgroundColor="#f4f4f4"
              />
            </View>

            <View className="flex-row gap-3 mt-6">
              <Button
                title="Close"
                variant="secondary"
                onPress={() => setShowNotificationsModal(false)}
                className="flex-1"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Theme Settings Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showThemeModal}
        onRequestClose={() => setShowThemeModal(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white dark:bg-gray-900 rounded-t-3xl p-6">
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">App Theme</Text>
            
            <View className="space-y-2 mb-6">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <TouchableOpacity
                  key={theme}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedTheme(theme);
                    setShowThemeModal(false);
                  }}
                  className={`flex-row items-center justify-between py-4 px-4 rounded-xl ${
                    selectedTheme === theme
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800'
                      : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  }`}>
                  <Text className={`font-medium capitalize ${
                    selectedTheme === theme
                      ? 'text-blue-900 dark:text-blue-300'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {theme}
                  </Text>
                  {selectedTheme === theme && (
                    <View className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row gap-3">
              <Button
                title="Close"
                variant="secondary"
                onPress={() => setShowThemeModal(false)}
                className="flex-1"
              />
            </View>
          </View>
        </View>
      </Modal>

    </>
  );
}

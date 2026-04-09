import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type RootStackParamList = {
  // Auth
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  
  // Guardian tabs
  Guardian: undefined;
  Dashboard: undefined;
  Map: undefined;
  Logs: undefined;
  Settings: undefined;
  
  // Driver
  DriverSession: { sessionId: string };
};

export type AuthScreenProps<Screen extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Screen
>;

export type GuardianTabParamList = {
  Dashboard: undefined;
  Map: undefined;
  Logs: undefined;
  Settings: undefined;
};

export type GuardianTabScreenProps<Screen extends keyof GuardianTabParamList> = BottomTabScreenProps<
  GuardianTabParamList,
  Screen
>;


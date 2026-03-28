import React from 'react';
import { Slot } from 'expo-router';
import { LogBox } from 'react-native';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import {
  configureNotificationBehavior,
  registerBackgroundNotificationTask,
} from '@/notifications/monitoring-notifications';

// Initialize the ExecuTorch resource fetcher before any model hooks run
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

// Suppress known non-actionable warnings from third-party libs.
LogBox.ignoreLogs([
  'RecordingNotificationManager is not implemented on iOS',
  '[React Native ExecuTorch] No content-length header',
]);

configureNotificationBehavior();
registerBackgroundNotificationTask().catch(() => {});

export default function RootLayout() {
  return <Slot />;
}

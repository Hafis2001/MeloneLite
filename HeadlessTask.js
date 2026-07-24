/**
 * HeadlessTask.js
 *
 * Registers a headless task for Android so that the background sync runs
 * even when the app is fully killed (terminated state).
 *
 * This file must be imported in your app entry point or index.js.
 * Expo Router apps: import this at the top of app/_layout.tsx.
 */

import { AppRegistry } from 'react-native';
import { syncOrders } from './backgroundSync';

const BackgroundFetchHeadlessTask = async (event) => {
  try {
    await syncOrders();
  } catch (e) {
    // Silently ignore — must never crash
  }
};

AppRegistry.registerHeadlessTask('BackgroundFetch', () => BackgroundFetchHeadlessTask);

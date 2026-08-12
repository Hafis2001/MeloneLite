import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  storeUrl?: string;
  releaseNotes?: string;
  mandatory: boolean;
}

interface PlatformVersionData {
  latest_version?: string;
  min_version?: string;
  store_url?: string;
}

interface VersionAPIResponse {
  status?: string;
  message?: string;
  data?: {
    android?: PlatformVersionData;
    ios?: PlatformVersionData;
    release_notes?: string;
  };
}

/**
 * Compares two semantic version strings (e.g. "2.2.2" vs "3.1.1").
 * Returns true if targetVersion is strictly greater than currentVersion.
 */
export const isNewerVersionAvailable = (currentVersion: string, targetVersion: string): boolean => {
  if (!currentVersion || !targetVersion) return false;

  const currentParts = currentVersion.split('.').map(p => parseInt(p, 10) || 0);
  const targetParts = targetVersion.split('.').map(p => parseInt(p, 10) || 0);
  const len = Math.max(currentParts.length, targetParts.length);

  for (let i = 0; i < len; i++) {
    const c = currentParts[i] || 0;
    const t = targetParts[i] || 0;
    if (t > c) return true;
    if (t < c) return false;
  }
  return false;
};

/**
 * Fetches the version info from the server.
 * Returns an UpdateInfo object if an update is needed, otherwise null.
 */
export const checkAppVersion = async (): Promise<UpdateInfo | null> => {
  try {
    const response = await fetch('https://ship.imcbs.com/api/v1/melonelite/', {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const result: VersionAPIResponse = await response.json();
    if (result?.status !== 'success' || !result?.data) return null;

    const data = result.data;

    let platformData: PlatformVersionData | undefined;
    if (Platform.OS === 'ios') {
      if (!data.ios) return null;
      platformData = data.ios;
    } else {
      platformData = data.android;
    }

    if (!platformData || !platformData.latest_version) return null;

    const currentVersion = Constants.expoConfig?.version || '1.0.0';
    const latestVersion = platformData.latest_version;
    const minVersion = platformData.min_version || '0.0.0';
    const storeUrl = platformData.store_url;

    if (!isNewerVersionAvailable(currentVersion, latestVersion)) return null;

    // Mandatory if current is below min_version
    const mandatory = isNewerVersionAvailable(currentVersion, minVersion);

    return {
      latestVersion,
      currentVersion,
      storeUrl,
      releaseNotes: data.release_notes,
      mandatory,
    };
  } catch (error) {
    console.warn('App version check failed:', error);
    return null;
  }
};

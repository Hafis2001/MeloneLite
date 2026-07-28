import { Alert, Platform, Linking } from 'react-native';
import Constants from 'expo-constants';

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

export const checkAppVersion = async (): Promise<void> => {
  try {
    const response = await fetch('https://ship.imcbs.com/api/v1/melone-lite/', {
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) return;
    
    const result: VersionAPIResponse = await response.json();
    if (result?.status !== 'success' || !result?.data) return;
    
    const data = result.data;
    
    // Pick appropriate platform data
    let platformData: PlatformVersionData | undefined;
    if (Platform.OS === 'ios') {
      // For iPhone, only check if data.ios is present in API response
      if (!data.ios) return;
      platformData = data.ios;
    } else {
      platformData = data.android;
    }
    
    if (!platformData || !platformData.latest_version) return;
    
    const currentVersion = Constants.expoConfig?.version || '1.0.0';
    const latestVersion = platformData.latest_version;
    const minVersion = platformData.min_version || '0.0.0';
    const storeUrl = platformData.store_url;
    
    // Check if store/latest version is higher than current version
    if (isNewerVersionAvailable(currentVersion, latestVersion)) {
      const isMandatory = isNewerVersionAvailable(currentVersion, minVersion);
      
      const alertTitle = "Update Available";
      const alertMessage = data.release_notes && data.release_notes.trim() !== ''
        ? `Latest update available please update\n\nRelease Notes:\n${data.release_notes}`
        : "Latest update available please update";
        
      const buttons: any[] = [];
      
      if (!isMandatory) {
        buttons.push({
          text: "Later",
          style: "cancel"
        });
      }
      
      buttons.push({
        text: "Update Now",
        onPress: () => {
          if (storeUrl) {
            Linking.openURL(storeUrl).catch(err => {
              console.error("Could not open store url", err);
            });
          }
        }
      });
      
      Alert.alert(alertTitle, alertMessage, buttons, { cancelable: !isMandatory });
    }
  } catch (error) {
    console.warn('App version check failed:', error);
  }
};

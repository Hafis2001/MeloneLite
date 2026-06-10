import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CartProvider } from '../src/context/CartContext';
import { initDatabase } from '../src/db/database';
import { getSetting } from '../src/db/settingsDB';
import { Colors, applyTheme } from '../src/constants/theme';
import { ThemeContext } from '../src/context/ThemeContext';
import { generateAIImage } from '../src/services/aiService';
import { getDB } from '../src/db/database';
import * as FileSystem from 'expo-file-system/legacy';
import CartScreen from './cart';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isLicensed, setIsLicensed] = useState<boolean | null>(null);
  const [themeVersion, setThemeVersion] = useState(0);
  const segments = useSegments();
  const router = useRouter();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = width >= 768;
  const isMenuPage = segments.length > 0 && segments[0] === '(tabs)' && (segments.length === 1 || (segments as string[])[1] === 'index');
  const showSideCart = isTablet && isMenuPage;

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  });

  useEffect(() => {
    const setup = async () => {
      try {
        await initDatabase();
        
        try {
          const primary = getSetting('theme_primary') || '#D4A853';
          const secondary = getSetting('theme_secondary') || 'default';
          applyTheme(primary, secondary);
        } catch (e) {
          // Ignore
        }

        const licensed = await AsyncStorage.getItem('licenseActivated');
        const licenseType = await AsyncStorage.getItem('license_type');
        const demoExpiry = await AsyncStorage.getItem('demo_expiry') || await AsyncStorage.getItem('demoExpiresAt');

        // If demo license, check if it has expired
        if (licensed === 'true' && licenseType === 'demo' && demoExpiry) {
          const expiry = new Date(demoExpiry);
          if (expiry.getTime() < Date.now()) {
            // Demo expired — revoke access and force license screen
            await AsyncStorage.setItem('licenseActivated', 'false');
            setIsLicensed(false);
            setDbReady(true);
            return;
          }
        }

        setIsLicensed(licensed === 'true');
        setDbReady(true);
      } catch (e: any) {
        setDbError(e?.message ?? 'Database error');
      }
    };
    setup();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (!fontsLoaded || !dbReady) return;
      
      const licensed = await AsyncStorage.getItem('licenseActivated');
      const isCurrentlyLicensed = licensed === 'true';
      setIsLicensed(isCurrentlyLicensed);

      const inAuthGroup = segments[0] === 'license';

      if (!isCurrentlyLicensed && !inAuthGroup) {
        router.replace('/license');
      } else if (isCurrentlyLicensed && inAuthGroup) {
        router.replace('/(tabs)');
      }
    };
    checkAuth();
  }, [segments, fontsLoaded, dbReady]);

  // Background Image Generator for DB Restores
  useEffect(() => {
    if (!dbReady) return;
    const checkMissingImages = async () => {
      try {
        const flag = await AsyncStorage.getItem('generate_missing_images');
        if (flag === 'true') {
          await AsyncStorage.removeItem('generate_missing_images');
          
          const db = getDB();
          const items = db.getAllSync<any>('SELECT * FROM items');
          
          let generatedCount = 0;
          for (const item of items) {
            try {
              let needsImage = false;
              if (!item.image_uri) needsImage = true;
              else {
                const info = await FileSystem.getInfoAsync(item.image_uri);
                if (!info.exists) needsImage = true;
              }

              if (needsImage) {
                const cat = db.getFirstSync<any>('SELECT name FROM categories WHERE id = ?', [item.category_id]);
                const url = await generateAIImage(item.item_name, cat ? cat.name : '');
                if (url) {
                  db.runSync('UPDATE items SET image_uri = ? WHERE id = ?', [url, item.id]);
                  generatedCount++;
                }
              }
            } catch (e) {
              console.log('Background image gen err:', e);
            }
          }
          console.log(`Startup auto-generated ${generatedCount} missing images.`);
        }
      } catch (e) {
        console.log(e);
      }
    };
    checkMissingImages();
  }, [dbReady]);

  useEffect(() => {
    if (!dbReady || isLicensed === null) return;

    const handleUrl = (url: string | null) => {
      if (!url) return;
      // We check if it's a content URI or has our file extensions
      if (url.startsWith('content://') || url.includes('.db') || url.includes('.sqlite') || url.includes('.json')) {
        setTimeout(() => {
          // Replace the root to clear the 'Unmatched Route' screen caused by the content:// URI
          router.replace('/(tabs)');
          setTimeout(() => {
            router.push({ pathname: '/settings/utility', params: { importUrl: url } });
          }, 100);
        }, 500);
      }
    };

    Linking.getInitialURL().then(handleUrl);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, [router, dbReady, isLicensed]);

  if (!fontsLoaded || !dbReady || isLicensed === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingText}>
          {dbError ? `Error: ${dbError}` : 'Preparing your restaurant...'}
        </Text>
      </View>
    );
  }

  const refreshTheme = () => {
    try {
      const primary = getSetting('theme_primary') || '#D4A853';
      const secondary = getSetting('theme_secondary') || 'default';
      applyTheme(primary, secondary);
      setThemeVersion(v => v + 1); // triggers re-render of all context subscribers
    } catch(e) {}
  };

  return (
    <ThemeContext.Provider value={{ refreshTheme, themeVersion }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <CartProvider>
          <StatusBar key={`status-${themeVersion}`} style="light" backgroundColor={Colors.background} />
          <View style={{ flex: 1, flexDirection: 'row', backgroundColor: Colors.background }}>
            <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="cart"
                options={{
                  headerShown: false,
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="item-form"
                options={{
                  headerShown: false,
                  presentation: 'modal',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="menu-scanner"
                options={{
                  headerShown: false,
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="barcode-scanner"
                options={{
                  headerShown: false,
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="order-detail"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="settings"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen 
                name="license" 
                options={{ 
                  headerShown: false, 
                  gestureEnabled: false,
                  animation: 'fade',
                }} 
              />
            </Stack>
          </View>
          {showSideCart && (
            <View style={{ width: 320, borderLeftWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background }}>
              <CartScreen />
            </View>
          )}
        </View>
      </CartProvider>
    </GestureHandlerRootView>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: Colors.textMuted,
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

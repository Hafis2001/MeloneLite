import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CartProvider } from '../src/context/CartContext';
import { initDatabase } from '../src/db/database';
import { Colors } from '../src/constants/theme';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isLicensed, setIsLicensed] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

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
        const licensed = await AsyncStorage.getItem('licenseActivated');
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CartProvider>
        <StatusBar style="light" backgroundColor={Colors.background} />
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
      </CartProvider>
    </GestureHandlerRootView>
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

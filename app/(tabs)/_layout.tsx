import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius } from '../../src/constants/theme';
import { useCart } from '../../src/context/CartContext';
import { Text, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';

function TabIcon({ name, focused, badge }: { name: any; focused: boolean; badge?: number }) {
  return (
    <View style={styles.iconWrapper}>
      <MaterialCommunityIcons
        name={name}
        size={24}
        color={focused ? Colors.gold : Colors.textMuted}
      />
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

export default function TabsLayout() {
  const { getTotalItems } = useCart();
  const cartCount = getTotalItems();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [isDemo, setIsDemo] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [isRealExpired, setIsRealExpired] = useState(false);

  const checkRealLicenseStatus = useCallback(async () => {
    try {
      const licenseKey = await AsyncStorage.getItem("licenseKey");
      if (!licenseKey || licenseKey.startsWith("DEMO-")) return;

      const lastCheck = await AsyncStorage.getItem("lastLicenseCheck");
      const now = new Date();
      
      // Check once every 24 hours
      if (lastCheck) {
        const lastDate = new Date(lastCheck);
        const hoursDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
        if (hoursDiff < 24) return;
      }

      console.log("🔄 Performing daily license validation...");
      const response = await fetch(`https://activate.imcbs.com/mobileapp/api/project/melonelite/`);
      const data = await response.json();

      if (data.success && data.customers) {
        const customer = data.customers.find((c: any) => c.license_key === licenseKey);
        
        if (customer) {
          const validity = customer.license_validity;
          const status = customer.status;

          await AsyncStorage.setItem("licenseExpiryDate", validity.expiry_date);
          await AsyncStorage.setItem("licenseIsExpired", validity.is_expired ? "true" : "false");
          await AsyncStorage.setItem("licenseStatus", status);
          await AsyncStorage.setItem("lastLicenseCheck", now.toISOString());

          if (validity.is_expired || status !== "Active") {
            Alert.alert(
              "License Issue",
              `Your license is ${status === "Active" ? "expired" : status.toLowerCase()}. Please contact support.`,
              [{ text: "OK", onPress: handleLogout }]
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to perform daily license check:", error);
    }
  }, []);

  const checkDemoStatus = useCallback(async () => {
    const licenseType = await AsyncStorage.getItem("license_type");
    const licenseKey = await AsyncStorage.getItem("licenseKey");
    
    console.log("🚩 [LAYOUT] license_type:", licenseType, "| key:", licenseKey);

    if (licenseType === "demo") {
      // DEMO MODE
      const demoExpiry = await AsyncStorage.getItem("demo_expiry");
      setIsDemo(true);
      if (demoExpiry) {
        const expiry = new Date(demoExpiry);
        const now = new Date();
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) {
          Alert.alert(
            "Demo Expired",
            "Your demo has expired. Please activate a full license.",
            [{ text: "OK", onPress: handleLogout }]
          );
        } else {
          setDaysLeft(diffDays);
        }
      }
    } else if (licenseType === "real") {
      // REAL LICENSE MODE
      setIsDemo(false);
      const realStatus = await AsyncStorage.getItem("real_status");
      const realIsExpired = await AsyncStorage.getItem("real_is_expired");
      if (realIsExpired === "true" || (realStatus && realStatus !== "Active")) {
        Alert.alert(
          "License Expired",
          "Your license is no longer active. Please contact support.",
          [{ text: "OK", onPress: handleLogout }]
        );
      }
    } else {
      // Fallback: check key prefix for backward compatibility
      const isKeyDemo = licenseKey && (licenseKey.startsWith("DEMO-") || licenseKey.startsWith("demo-"));
      setIsDemo(!!isKeyDemo);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkDemoStatus();
      checkRealLicenseStatus();
    }, [checkDemoStatus, checkRealLicenseStatus])
  );

  const handleLogout = async () => {
    // Clear all license storage (both old and new keys)
    const keysToRemove = [
      "licenseActivated", "licenseKey", "clientId", "customerName",
      "isDemo", "demoExpiresAt", "licenseExpiryDate", "licenseIsExpired", "licenseStatus",
      "demoUsed",
      // New clean keys
      "license_type",
      "demo_key", "demo_expiry", "demo_company", "demo_client_id",
      "real_license_key", "real_customer_name", "real_client_id", "real_expiry", "real_status", "real_is_expired",
      "lastLicenseCheck", "activatedLicenses",
    ];
    await AsyncStorage.multiRemove(keysToRemove);
    router.replace("/license");
  };

  const DemoBanner = () => {
    if (!isDemo) return null;
    return (
      <View style={[styles.demoBanner, { paddingTop: insets.top }]}>
        <MaterialCommunityIcons name="clock-outline" size={14} color="#0D0D0D" />
        <Text style={styles.demoBannerText}>
          DEMO MODE • {daysLeft} {daysLeft === 1 ? 'DAY' : 'DAYS'} REMAINING
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <DemoBanner />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar, 
          { 
            height: (Platform.OS === 'ios' ? 65 : 60) + (insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 20 : 0)), 
            paddingBottom: insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 20 : 8)
          }
        ],
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => <View style={styles.tabBarBg} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Sales',
          tabBarIcon: ({ focused }) => <TabIcon name="silverware-fork-knife" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: 'Items',
          tabBarIcon: ({ focused }) => <TabIcon name="food-variant" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ focused }) => <TabIcon name="tag-multiple" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Report',
          tabBarIcon: ({ focused }) => <TabIcon name="receipt" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="cog" focused={focused} />,
        }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: Platform.OS === 'ios' ? 85 : 75,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    paddingTop: 8,
  },
  tabBarBg: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  tabLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 10,
    marginTop: -4,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 36,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: Radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontFamily: 'Poppins-Bold',
  },
  demoBanner: {
    backgroundColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 6,
  },
  demoBannerText: {
    color: '#0D0D0D',
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
  },
});

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';
import { useThemeVersion } from '../../src/context/ThemeContext';

export default function SettingsMenuScreen() {
  const themeVersion = useThemeVersion();
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.contentWrapper}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.scrollContent, isLandscape && styles.scrollContentLandscape]}>

          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/settings/company')}>
            <View style={styles.menuIconContainer}>
              <MaterialCommunityIcons name="domain" size={32} color={Colors.gold} />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Company</Text>
              <Text style={styles.menuDesc}>Restaurant info, logo, billing, language</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/settings/utility')}>
            <View style={styles.menuIconContainer}>
              <MaterialCommunityIcons name="cog-outline" size={32} color={Colors.gold} />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Utility</Text>
              <Text style={styles.menuDesc}>Printers, barcode scanner, backup</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/settings/about')}>
            <View style={styles.menuIconContainer}>
              <MaterialCommunityIcons name="information-outline" size={32} color={Colors.gold} />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>About Us</Text>
              <Text style={styles.menuDesc}>Contact details, license information</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textMuted} />
          </TouchableOpacity>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function createStyles() {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrapper: { flex: 1, width: '100%', alignSelf: 'center' },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  headerTitle: { ...Typography.heading2 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  scrollContentLandscape: { paddingHorizontal: Spacing.xxl },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  menuIconContainer: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Colors.goldOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    ...Typography.heading4,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  menuDesc: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  });
}

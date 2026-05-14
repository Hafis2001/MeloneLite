import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllSettings, updateSettings, Settings } from '../../src/db/settingsDB';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    restaurant_name: '',
    restaurant_address: '',
    restaurant_phone: '',
    tax_rate: '5',
    currency_symbol: '₹',
    receipt_footer: '',
  });
  const [saved, setSaved] = useState(false);

  useFocusEffect(useCallback(() => {
    setSettings(getAllSettings());
  }, []));

  const handleSave = () => {
    if (!settings.restaurant_name.trim()) {
      Alert.alert('Validation', 'Restaurant name is required');
      return;
    }

    updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    Alert.alert(
      "Remove License",
      "Are you sure you want to remove the license from this device?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const deviceId = await AsyncStorage.getItem("deviceId");
              const licenseKey = await AsyncStorage.getItem("licenseKey");

              if (deviceId && licenseKey) {
                // Call logout API
                await fetch(`https://activate.imcbs.com/mobileapp/api/project/melonelite/logout/`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    license_key: licenseKey,
                    device_id: deviceId,
                  })
                });
              }

              // Clear local storage regardless of API success to force them out
              await AsyncStorage.removeItem("licenseActivated");
              await AsyncStorage.removeItem("licenseKey");
              await AsyncStorage.removeItem("clientId");
              await AsyncStorage.removeItem("customerName");
              await AsyncStorage.removeItem("deviceId");
              await AsyncStorage.removeItem("activatedModules");
              
              router.replace("/license");
            } catch (error) {
              console.error("Logout error", error);
              Alert.alert("Error", "Failed to remove license.");
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Restaurant Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="store" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Restaurant Info</Text>
            </View>
            <Text style={styles.fieldLabel}>Restaurant Name *</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
              <TextInput style={styles.input} value={settings.restaurant_name}
                onChangeText={v => setSettings(s => ({ ...s, restaurant_name: v }))}
                placeholder="Enter restaurant name" placeholderTextColor={Colors.textMuted} />
            </View>
            <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Address</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
              <TextInput style={styles.input} value={settings.restaurant_address}
                onChangeText={v => setSettings(s => ({ ...s, restaurant_address: v }))}
                placeholder="Enter address" placeholderTextColor={Colors.textMuted} />
            </View>
            <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Phone Number</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="phone-outline" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
              <TextInput style={styles.input} value={settings.restaurant_phone}
                onChangeText={v => setSettings(s => ({ ...s, restaurant_phone: v }))}
                placeholder="Enter phone number" placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad" />
            </View>
          </View>

          {/* Billing */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="calculator-variant" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Billing</Text>
            </View>
            <Text style={styles.fieldLabel}>Currency Symbol</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="currency-inr" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
              <TextInput style={styles.input} value={settings.currency_symbol}
                onChangeText={v => setSettings(s => ({ ...s, currency_symbol: v }))}
                placeholder="₹" placeholderTextColor={Colors.textMuted} />
            </View>
          </View>

          {/* Receipt */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="receipt" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Receipt</Text>
            </View>
            <Text style={styles.fieldLabel}>Footer Message</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="message-text-outline" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
              <TextInput style={styles.input} value={settings.receipt_footer}
                onChangeText={v => setSettings(s => ({ ...s, receipt_footer: v }))}
                placeholder="Thank you for dining with us!" placeholderTextColor={Colors.textMuted} />
            </View>
          </View>

          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>MeloneLite v1.0.0 • Fully Offline • Built for Falcon POS</Text>
          </View>

          <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnSuccess]} onPress={handleSave}>
            <MaterialCommunityIcons name={saved ? 'check-circle' : 'content-save-outline'} size={20} color={Colors.textInverse} />
            <Text style={styles.saveBtnText}>{saved ? 'Saved!' : 'Save Settings'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color={Colors.error} />
            <Text style={styles.logoutBtnText}>Remove License</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  headerTitle: { ...Typography.heading2 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg,
    marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectionTitle: { ...Typography.heading4, color: Colors.gold },
  fieldLabel: { ...Typography.label, marginBottom: Spacing.sm, color: Colors.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 48,
  },
  input: { flex: 1, color: Colors.textPrimary, fontFamily: 'Poppins-Regular', fontSize: 14 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  infoText: { ...Typography.caption, flex: 1 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.gold, borderRadius: Radius.lg, paddingVertical: Spacing.lg, ...Shadows.button,
  },
  saveBtnSuccess: { backgroundColor: Colors.success },
  saveBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-Bold', fontSize: 16 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingVertical: Spacing.lg, 
    marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.error,
  },
  logoutBtnText: { color: Colors.error, fontFamily: 'Poppins-Bold', fontSize: 16 },
});

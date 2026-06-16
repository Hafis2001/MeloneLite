import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Linking } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDB } from '../../src/db/database';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';
import { useThemeVersion } from '../../src/context/ThemeContext';

export default function AboutSettingsScreen() {
  const themeVersion = useThemeVersion();
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [licenseInfo, setLicenseInfo] = useState({
    isDemo: false,
    expiry: null as string | null,
    clientId: '',
    customerName: '',
    status: '',
  });
  const [loadingLicense, setLoadingLicense] = useState(false);

  useFocusEffect(useCallback(() => {
    loadLicenseSettings();
  }, []));

  const loadLicenseSettings = async () => {
    const licenseKey = await AsyncStorage.getItem('licenseKey');
    if (!licenseKey) return;

    const trimmedKey = licenseKey.trim();
    const isDemo = trimmedKey.startsWith('DEMO-') || trimmedKey.startsWith('demo-');

    setLicenseInfo({
      isDemo,
      expiry: await AsyncStorage.getItem('real_expiry') || await AsyncStorage.getItem('licenseExpiryDate') || null,
      clientId: await AsyncStorage.getItem('real_client_id') || await AsyncStorage.getItem('clientId') || '',
      customerName: await AsyncStorage.getItem('real_customer_name') || await AsyncStorage.getItem('customerName') || '',
      status: await AsyncStorage.getItem('real_status') || await AsyncStorage.getItem('licenseStatus') || 'Active',
    });

    setLoadingLicense(true);
    try {
      const response = await fetch('https://activate.imcbs.com/mobileapp/api/project/melonelite/');
      const data = await response.json();

      if (data.success) {
        let customer = data.customers?.find((c: any) => c.license_key === trimmedKey);
        if (customer) {
          const freshInfo = {
            isDemo: false,
            expiry: customer.license_validity?.expiry_date || null,
            clientId: customer.client_id,
            customerName: customer.customer_name,
            status: customer.status || 'Active',
          };
          setLicenseInfo(freshInfo);
          await AsyncStorage.setItem('license_type', 'real');
          await AsyncStorage.setItem('real_license_key', trimmedKey);
          await AsyncStorage.setItem('real_customer_name', freshInfo.customerName);
          await AsyncStorage.setItem('real_client_id', freshInfo.clientId);
          await AsyncStorage.setItem('real_expiry', freshInfo.expiry || '');
          await AsyncStorage.setItem('real_status', freshInfo.status);
          return;
        }

        const demo = data.demo_licenses?.find((d: any) => d.demo_license === trimmedKey);
        if (demo) {
          const freshInfo = {
            isDemo: true,
            expiry: demo.expires_at || null,
            clientId: demo.client_id,
            customerName: demo.company,
            status: demo.status || 'Active',
          };
          setLicenseInfo(freshInfo);
          await AsyncStorage.setItem('license_type', 'demo');
          await AsyncStorage.setItem('demo_key', trimmedKey);
          await AsyncStorage.setItem('demo_company', freshInfo.customerName);
          await AsyncStorage.setItem('demo_client_id', freshInfo.clientId);
          await AsyncStorage.setItem('demo_expiry', freshInfo.expiry || '');
        }
      }
    } catch (err) {
      console.error('License API error:', err);
    } finally {
      setLoadingLicense(false);
    }
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
                await fetch(`https://activate.imcbs.com/mobileapp/api/project/melonelite/logout/`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    license_key: licenseKey,
                    device_id: deviceId,
                  })
                });
              }

              await AsyncStorage.multiRemove([
                "licenseActivated", "licenseKey", "clientId", "customerName",
                "deviceId", "activatedModules", "projectName",
                "isDemo", "demoExpiresAt", "licenseExpiryDate",
                "licenseIsExpired", "licenseStatus", "lastLicenseCheck",
                "activatedLicenses", "demoUsed",
                "license_type",
                "demo_key", "demo_expiry", "demo_company", "demo_client_id",
                "real_license_key", "real_customer_name", "real_client_id",
                "real_expiry", "real_status", "real_is_expired",
              ]);

              setLicenseInfo({ isDemo: false, expiry: null, clientId: '', customerName: '', status: '' });
              router.replace("/license");
            } catch (error) {
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
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>About Us</Text>
          </View>
          <ScrollView contentContainerStyle={[styles.scrollContent, isLandscape && styles.scrollContentLandscape]} showsVerticalScrollIndicator={false}>
            

          {/* Contact Us */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="headset" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Contact Us</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.contactItem}
              onPress={() => Linking.openURL('mailto:sales@imcbs.com')}
            >
              <MaterialCommunityIcons name="email-outline" size={20} color={Colors.gold} />
              <View>
                <Text style={styles.contactLabel}>Email Support</Text>
                <Text style={styles.contactValue}>sales@imcbs.com</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.contactItem}
              onPress={() => Linking.openURL('https://wa.me/917593820005')}
            >
              <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" />
              <View>
                <Text style={styles.contactLabel}>WhatsApp Support</Text>
                <Text style={styles.contactValue}>+91 7593820005</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.contactItem, { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]}
              onPress={() => Linking.openURL('https://www.imcbs.com/')}
            >
              <MaterialCommunityIcons name="web" size={20} color={Colors.info} />
              <View>
                <Text style={styles.contactLabel}>Website</Text>
                <Text style={styles.contactValue}>www.imcbs.com</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* License Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>License Information</Text>
              {loadingLicense && <ActivityIndicator size="small" color={Colors.gold} style={{ marginLeft: 'auto' }} />}
            </View>
            
            <View style={styles.licenseRow}>
              <Text style={styles.licenseLabel}>Status</Text>
              <View style={[styles.licenseBadge, { backgroundColor: licenseInfo.isDemo || licenseInfo.status !== 'Active' ? Colors.goldOverlay : 'rgba(46, 204, 113, 0.1)' }]}>
                <Text style={[styles.licenseBadgeText, { color: licenseInfo.isDemo || licenseInfo.status !== 'Active' ? Colors.gold : '#2ECC71' }]}>
                  {licenseInfo.isDemo ? 'DEMO LICENSE' : (licenseInfo.status === 'Active' ? 'ACTIVE FULL LICENSE' : licenseInfo.status.toUpperCase())}
                </Text>
              </View>
            </View>

            <View style={styles.licenseInfoItem}>
              <Text style={styles.licenseLabel}>Shop Name</Text>
              <Text style={styles.licenseValue}>{licenseInfo.customerName}</Text>
            </View>

            <View style={styles.licenseInfoItem}>
              <Text style={styles.licenseLabel}>Client ID</Text>
              <Text style={styles.licenseValue}>{licenseInfo.clientId}</Text>
            </View>

            {licenseInfo.expiry && (
              <View style={styles.licenseInfoItem}>
                <Text style={styles.licenseLabel}>{licenseInfo.isDemo ? 'Expires On' : 'License Valid Until'}</Text>
                <Text style={[styles.licenseValue, !licenseInfo.isDemo && { color: Colors.success }]}>
                  {new Date(licenseInfo.expiry).toLocaleDateString()}
                </Text>
              </View>
            )}

          </View>

          {/* Remove License */}
          <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color={Colors.error} />
            <Text style={styles.logoutBtnText}>Remove License</Text>
          </TouchableOpacity>
          </View>


            <View style={styles.infoCard}>
              <MaterialCommunityIcons name="information-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.infoText}>MeloneLite V 2.1.1 • </Text>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  tabRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  tab: {
    flex: 1, height: 40, borderRadius: Radius.md, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.goldOverlay, borderColor: Colors.gold },
  tabText: { ...Typography.captionMedium, color: Colors.textMuted },
  tabTextActive: { color: Colors.gold },
  emptyText: { ...Typography.caption, textAlign: 'center', color: Colors.textMuted, marginVertical: Spacing.lg },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  deviceName: { ...Typography.bodyMedium, fontSize: 13 },
  deviceAddress: { ...Typography.caption, fontSize: 10 },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 50,
  },
  dropdownHeaderText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  dropdownList: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemActive: {
    backgroundColor: Colors.goldOverlay,
  },
  emptyDropdown: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  warningCard: {
    backgroundColor: '#FDECEA',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#F5B7B1',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  warningTitle: {
    ...Typography.heading4,
    color: '#922B21',
    fontSize: 15,
  },
  warningText: {
    ...Typography.caption,
    color: '#7B241C',
    lineHeight: 18,
  },
  licenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  licenseLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  licenseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  licenseBadgeText: {
    fontSize: 10,
    fontFamily: 'Poppins-Bold',
  },
  licenseInfoItem: {
    marginBottom: Spacing.sm,
  },
  licenseValue: {
    ...Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2ECC71',
    borderRadius: Radius.md,
    paddingVertical: 12,
    marginTop: Spacing.md,
  },
  upgradeBtnText: {
    color: Colors.white,
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
  },
  backupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: 12,
    marginBottom: Spacing.sm,
  },
  backupBtnText: {
    color: Colors.textInverse,
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  restoreBtnText: {
    color: Colors.gold,
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contactLabel: {
    ...Typography.captionMedium,
    color: Colors.textMuted,
  },
  contactValue: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  logoPicker: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  logoPickerHasImage: {
    borderStyle: 'solid',
    height: 140,
  },
  logoContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#1E1E1E',
  },
  logoPreview: {
    width: '90%',
    height: '85%',
  },
  logoEditOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  logoEditText: {
    color: Colors.textInverse,
    fontFamily: 'Poppins-Medium',
    fontSize: 11,
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: Spacing.md,
  },
  logoHint: {
    color: Colors.textPrimary,
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
  },
  logoHintSub: {
    color: Colors.textMuted,
    fontFamily: 'Poppins-Regular',
    fontSize: 11,
  },
  removeLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E74C3C33',
  },
  removeLogoText: {
    color: '#E74C3C',
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.cardElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.heading4,
    color: Colors.textPrimary,
  },
  modalOptions: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  modalOptionBtnDestructive: {
    borderColor: Colors.errorBg,
  },
  modalOptionIconBg: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.goldOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  modalCancelBtn: {
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  modalCancelText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: Colors.textMuted,
  },
  dbFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dbFileText: {
    color: Colors.text,
    fontFamily: Typography.medium,
    fontSize: 14,
    flex: 1,
  },
  });
}


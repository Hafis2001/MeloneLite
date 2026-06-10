import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, FlatList, Switch, TextInput, Image, TouchableWithoutFeedback } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getDB } from '../../src/db/database';
import { getAllSettings, updateSettings, setSetting, Settings } from '../../src/db/settingsDB';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';
import { useThemeVersion } from '../../src/context/ThemeContext';

export default function CompanySettingsScreen() {
  const themeVersion = useThemeVersion();
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    restaurant_name: '',
    restaurant_address: '',
    restaurant_phone: '',
    tax_rate: '5',
    currency_symbol: '₹',
    decimal_places: '2',
    receipt_footer: '',
    require_barcode: '0',
    enable_arabic: '0',
    enable_malayalam: '0',
  });
  const [saved, setSaved] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoModalVisible, setLogoModalVisible] = useState(false);
  const [showRestaurantInfo, setShowRestaurantInfo] = useState(false);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useFocusEffect(useCallback(() => {
    setSettings(getAllSettings());
    AsyncStorage.getItem('printer_logo_uri').then(uri => setLogoUri(uri));
  }, []));

  const pickLogoImage = () => {
    setLogoModalVisible(true);
  };

  const handleSave = () => {
    if (!settings.restaurant_name.trim()) {
      Alert.alert('Validation', 'Restaurant name is required');
      return;
    }
    updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Company Settings</Text>
          </View>
          <ScrollView contentContainerStyle={[styles.scrollContent, isLandscape && styles.scrollContentLandscape]} showsVerticalScrollIndicator={false}>
            

          {/* Restaurant Info */}
          <View style={styles.section}>
            <TouchableOpacity 
              style={[styles.sectionHeader, { marginBottom: showRestaurantInfo ? Spacing.md : 0, borderBottomWidth: showRestaurantInfo ? 1 : 0, paddingBottom: showRestaurantInfo ? Spacing.md : 0 }]}
              onPress={() => setShowRestaurantInfo(!showRestaurantInfo)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="store" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Restaurant Info</Text>
              </View>
              <MaterialCommunityIcons name={showRestaurantInfo ? "chevron-up" : "chevron-down"} size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            {showRestaurantInfo && (
              <View>
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
                <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Receipt Footer Text</Text>
                <View style={styles.inputRow}>
                  <MaterialCommunityIcons name="card-text-outline" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
                  <TextInput style={styles.input} value={settings.receipt_footer}
                    onChangeText={v => setSettings(s => ({ ...s, receipt_footer: v }))}
                    placeholder="Enter receipt footer text (e.g. Thank you!)" placeholderTextColor={Colors.textMuted} />
                </View>
              </View>
            )}
          </View>

          {/* Receipt Logo */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="image-outline" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Receipt Logo</Text>
            </View>
            <Text style={styles.fieldLabel}>Logo Image</Text>
            
            <TouchableOpacity 
              style={[styles.logoPicker, logoUri ? styles.logoPickerHasImage : null]} 
              onPress={pickLogoImage} 
              activeOpacity={0.8}
            >
              {logoUri ? (
                <View style={styles.logoContainer}>
                  <Image source={{ uri: logoUri }} style={styles.logoPreview} resizeMode="contain" />
                  <View style={styles.logoEditOverlay}>
                    <MaterialCommunityIcons name="pencil" size={16} color={Colors.textInverse} style={{ marginRight: 4 }} />
                    <Text style={styles.logoEditText}>Change Logo</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.logoPlaceholder}>
                  <MaterialCommunityIcons name="image-plus" size={32} color={Colors.gold} />
                  <Text style={styles.logoHint}>Tap to select Receipt Logo</Text>
                  <Text style={styles.logoHintSub}>(optional - printed at the top of the bill)</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {logoUri && (
              <TouchableOpacity 
                style={styles.removeLogoBtn}
                onPress={async () => {
                  setLogoUri(null);
                  await AsyncStorage.removeItem('printer_logo_uri');
                }}
              >
                <MaterialCommunityIcons name="delete-outline" size={18} color="#E74C3C" />
                <Text style={styles.removeLogoText}>Remove Logo</Text>
              </TouchableOpacity>
            )}
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
            <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Decimal Places</Text>
            <View style={styles.tabRow}>
              {[0, 1, 2, 3].map(decimals => (
                <TouchableOpacity 
                  key={decimals}
                  style={[styles.tab, settings.decimal_places === String(decimals) && styles.tabActive]}
                  onPress={() => setSettings(s => ({ ...s, decimal_places: String(decimals) }))}
                >
                  <Text style={[styles.tabText, settings.decimal_places === String(decimals) && styles.tabTextActive]}>
                    {decimals}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Language - navigates to dedicated page */}
          <TouchableOpacity
            style={styles.navCard}
            activeOpacity={0.75}
            onPress={() => router.push('/settings/language')}
          >
            <View style={styles.navCardLeft}>
              <View style={styles.navCardIconBg}>
                <MaterialCommunityIcons name="translate" size={20} color={Colors.gold} />
              </View>
              <View>
                <Text style={styles.navCardTitle}>Language</Text>
                <Text style={styles.navCardSub}>Arabic, Malayalam, Tamil, Hindi, Kannada</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
          </TouchableOpacity>



            <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnSuccess]} onPress={handleSave}>
              <MaterialCommunityIcons name={saved ? 'check-circle' : 'content-save-outline'} size={20} color={Colors.textInverse} />
              <Text style={styles.saveBtnText}>{saved ? 'Saved!' : 'Save Settings'}</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
                  {/* Custom Logo Picker Modal */}
        <Modal
          visible={logoModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setLogoModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setLogoModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContainer}>
                  {/* Header */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select Logo Image</Text>
                    <TouchableOpacity onPress={() => setLogoModalVisible(false)}>
                      <MaterialCommunityIcons name="close" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  {/* Options */}
                  <View style={styles.modalOptions}>
                    <TouchableOpacity
                      style={styles.modalOptionBtn}
                      onPress={async () => {
                        setLogoModalVisible(false);
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== 'granted') { Alert.alert('Permission needed', 'Allow camera access in settings.'); return; }
                        const result = await ImagePicker.launchCameraAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                          allowsEditing: true, aspect: [1, 1], quality: 0.7,
                        });
                        if (!result.canceled) {
                          const uri = result.assets[0].uri;
                          setLogoUri(uri);
                          await AsyncStorage.setItem('printer_logo_uri', uri);
                        }
                      }}
                    >
                      <View style={styles.modalOptionIconBg}>
                        <MaterialCommunityIcons name="camera" size={22} color={Colors.gold} />
                      </View>
                      <Text style={styles.modalOptionText}>Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalOptionBtn}
                      onPress={async () => {
                        setLogoModalVisible(false);
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== 'granted') { Alert.alert('Permission needed', 'Allow gallery access in settings.'); return; }
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                          allowsEditing: true, aspect: [1, 1], quality: 0.7,
                        });
                        if (!result.canceled) {
                          const uri = result.assets[0].uri;
                          setLogoUri(uri);
                          await AsyncStorage.setItem('printer_logo_uri', uri);
                        }
                      }}
                    >
                      <View style={styles.modalOptionIconBg}>
                        <MaterialCommunityIcons name="image" size={22} color={Colors.gold} />
                      </View>
                      <Text style={styles.modalOptionText}>Choose from Gallery</Text>
                    </TouchableOpacity>

                    {logoUri && (
                      <TouchableOpacity
                        style={[styles.modalOptionBtn, styles.modalOptionBtnDestructive]}
                        onPress={async () => {
                          setLogoModalVisible(false);
                          setLogoUri(null);
                          await AsyncStorage.removeItem('printer_logo_uri');
                        }}
                      >
                        <View style={[styles.modalOptionIconBg, { backgroundColor: Colors.errorBg }]}>
                          <MaterialCommunityIcons name="trash-can-outline" size={22} color={Colors.error} />
                        </View>
                        <Text style={[styles.modalOptionText, { color: Colors.error }]}>Remove Logo</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Cancel Button */}
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setLogoModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>


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
  navCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg,
    marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadows.card,
  },
  navCardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  navCardIconBg: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.goldOverlay, alignItems: 'center', justifyContent: 'center',
  },
  navCardTitle: { ...Typography.bodyMedium, color: Colors.textPrimary, fontSize: 15 },
  navCardSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
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


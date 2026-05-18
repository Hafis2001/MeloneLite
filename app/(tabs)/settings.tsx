import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, FlatList, Linking, Image, Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getAllSettings, updateSettings, Settings } from '../../src/db/settingsDB';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';
import printerService from '../../src/services/printerService';

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    restaurant_name: '',
    restaurant_address: '',
    restaurant_phone: '',
    tax_rate: '5',
    currency_symbol: '₹',
    decimal_places: '2',
    receipt_footer: '',
  });
  const [saved, setSaved] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoModalVisible, setLogoModalVisible] = useState(false);

  // Printer State
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [paperWidth, setPaperWidth] = useState(58);
  const [showDropdown, setShowDropdown] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState({
    isDemo: false,
    expiry: null as string | null,
    clientId: '',
    customerName: '',
    status: '',
  });
  const [loadingLicense, setLoadingLicense] = useState(false);

  useFocusEffect(useCallback(() => {
    setSettings(getAllSettings());
    loadPrinterSettings();
  }, []));

  const loadPrinterSettings = async () => {
    const width = await AsyncStorage.getItem('printer_paper_width');
    if (width) setPaperWidth(parseInt(width, 10));

    const savedLogo = await AsyncStorage.getItem('printer_logo_uri');
    setLogoUri(savedLogo);

    const licenseKey = await AsyncStorage.getItem('licenseKey');
    if (!licenseKey) return;

    const trimmedKey = licenseKey.trim();
    const isDemo = trimmedKey.startsWith('DEMO-') || trimmedKey.startsWith('demo-');

    // Show whatever we have stored immediately while API loads
    setLicenseInfo({
      isDemo,
      expiry: await AsyncStorage.getItem('real_expiry') || await AsyncStorage.getItem('licenseExpiryDate') || null,
      clientId: await AsyncStorage.getItem('real_client_id') || await AsyncStorage.getItem('clientId') || '',
      customerName: await AsyncStorage.getItem('real_customer_name') || await AsyncStorage.getItem('customerName') || '',
      status: await AsyncStorage.getItem('real_status') || await AsyncStorage.getItem('licenseStatus') || 'Active',
    });

    // Always refresh from API — this is the source of truth
    setLoadingLicense(true);
    try {
      const response = await fetch('https://activate.imcbs.com/mobileapp/api/project/melonelite/');
      const data = await response.json();

      if (data.success) {
        // Search in real customers
        let customer = data.customers?.find((c: any) => c.license_key === trimmedKey);

        if (customer) {
          // Real license found
          const freshInfo = {
            isDemo: false,
            expiry: customer.license_validity?.expiry_date || null,
            clientId: customer.client_id,
            customerName: customer.customer_name,
            status: customer.status || 'Active',
          };
          setLicenseInfo(freshInfo);
          // Persist fresh data
          await AsyncStorage.setItem('license_type', 'real');
          await AsyncStorage.setItem('real_license_key', trimmedKey);
          await AsyncStorage.setItem('real_customer_name', freshInfo.customerName);
          await AsyncStorage.setItem('real_client_id', freshInfo.clientId);
          await AsyncStorage.setItem('real_expiry', freshInfo.expiry || '');
          await AsyncStorage.setItem('real_status', freshInfo.status);
          return;
        }

        // Search in demo licenses
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
      console.error('❌ [SETTINGS] License API error:', err);
      // Fallback: keep whatever was shown from storage
    } finally {
      setLoadingLicense(false);
    }
  };

  const handleScan = async () => {
    console.log("Settings: Starting scan...");
    setIsScanning(true);
    setDevices([]);
    try {
      const list = await printerService.getDevices();
      setDevices(list || []);
      console.log("Settings: Scan complete, found", list?.length || 0, "devices");
      
      if (list && list.length > 0) {
        setShowDropdown(true);
      } else {
        Alert.alert("No Printers Found", "Could not find any Bluetooth printers nearby. Please ensure your printer is in pairing mode and Bluetooth is ON.");
      }
    } catch (e) {
      console.error("Settings: Scan failed", e);
      Alert.alert("Scan Error", "Failed to scan for Bluetooth devices.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnect = async (device: any) => {
    setConnectingId(device.inner_mac_address);
    const success = await printerService.connect(device);
    setConnectingId(null);
    if (success) {
      Alert.alert("Success", `Connected to ${device.device_name || 'Printer'}`);
    }
  };

  const handlePaperWidth = (width: number) => {
    setPaperWidth(width);
    printerService.setPaperWidth(width);
  };

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

              // Clear ALL license storage — old keys and new clean keys
              await AsyncStorage.multiRemove([
                // Old keys
                "licenseActivated", "licenseKey", "clientId", "customerName",
                "deviceId", "activatedModules", "projectName",
                "isDemo", "demoExpiresAt", "licenseExpiryDate",
                "licenseIsExpired", "licenseStatus", "lastLicenseCheck",
                "activatedLicenses", "demoUsed",
                // New clean keys
                "license_type",
                "demo_key", "demo_expiry", "demo_company", "demo_client_id",
                "real_license_key", "real_customer_name", "real_client_id",
                "real_expiry", "real_status", "real_is_expired",
              ]);

              // Reset license info display
              setLicenseInfo({ isDemo: false, expiry: null, clientId: '', customerName: '', status: '' });

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
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Mock Warning */}
          {printerService.isMock && (
            <View style={styles.warningCard}>
              <View style={styles.warningHeader}>
                <MaterialCommunityIcons name="alert-decagram" size={20} color="#E74C3C" />
                <Text style={styles.warningTitle}>Setup Required</Text>
              </View>
              <Text style={styles.warningText}>
                Bluetooth printing is currently in <Text style={{ fontWeight: 'bold' }}>Mock Mode</Text>. 
                Custom printers require a <Text style={{ fontWeight: 'bold' }}>Development Build</Text>. 
                It will NOT find real devices in Expo Go.
              </Text>
            </View>
          )}

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
            <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Receipt Footer Text</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="card-text-outline" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
              <TextInput style={styles.input} value={settings.receipt_footer}
                onChangeText={v => setSettings(s => ({ ...s, receipt_footer: v }))}
                placeholder="Enter receipt footer text (e.g. Thank you!)" placeholderTextColor={Colors.textMuted} />
            </View>
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

          {/* Bluetooth Printer */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="printer-pos" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Bluetooth Printer</Text>
            </View>
            
            <Text style={styles.fieldLabel}>Paper Width</Text>
            <View style={styles.tabRow}>
              <TouchableOpacity 
                style={[styles.tab, paperWidth === 58 && styles.tabActive]}
                onPress={() => handlePaperWidth(58)}
              >
                <Text style={[styles.tabText, paperWidth === 58 && styles.tabTextActive]}>58mm</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, paperWidth === 80 && styles.tabActive]}
                onPress={() => handlePaperWidth(80)}
              >
                <Text style={[styles.tabText, paperWidth === 80 && styles.tabTextActive]}>80mm</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.sectionHeader, { marginTop: Spacing.lg, borderBottomWidth: 0, marginBottom: Spacing.xs }]}>
              <Text style={[styles.sectionTitle, { fontSize: 13, color: Colors.textSecondary }]}>Select Printer</Text>
              <TouchableOpacity onPress={handleScan} disabled={isScanning}>
                {isScanning ? (
                  <ActivityIndicator size="small" color={Colors.gold} />
                ) : (
                  <MaterialCommunityIcons name="refresh" size={20} color={Colors.gold} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.dropdownHeader} 
              onPress={() => setShowDropdown(!showDropdown)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons 
                  name="bluetooth" 
                  size={20} 
                  color={printerService.connected ? Colors.success : Colors.gold} 
                />
                <Text style={styles.dropdownHeaderText}>
                  {printerService.currentPrinter?.device_name || 'No printer selected'}
                </Text>
              </View>
              <MaterialCommunityIcons 
                name={showDropdown ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={Colors.textMuted} 
              />
            </TouchableOpacity>

            {showDropdown && (
              <View style={styles.dropdownList}>
                {devices.length === 0 ? (
                  <View style={styles.emptyDropdown}>
                    <Text style={styles.emptyText}>No devices found. Tap refresh icon to scan.</Text>
                  </View>
                ) : (
                  devices.map((item, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={[
                        styles.dropdownItem,
                        printerService.currentPrinter?.inner_mac_address === item.inner_mac_address && styles.dropdownItemActive
                      ]}
                      onPress={() => {
                        handleConnect(item);
                        setShowDropdown(false);
                      }}
                      disabled={!!connectingId}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.deviceName}>{item.device_name || 'Unknown Device'}</Text>
                        <Text style={styles.deviceAddress}>{item.inner_mac_address}</Text>
                      </View>
                      {connectingId === item.inner_mac_address ? (
                        <ActivityIndicator size="small" color={Colors.gold} />
                      ) : (
                        printerService.currentPrinter?.inner_mac_address === item.inner_mac_address && (
                          <MaterialCommunityIcons name="check" size={18} color={Colors.success} />
                        )
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrapper: { flex: 1, maxWidth: 800, width: '100%', alignSelf: 'center' },
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
});

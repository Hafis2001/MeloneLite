import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, FlatList, Switch } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDB, closeDB } from '../../src/db/database';
import { getAllSettings, updateSettings, setSetting, getSetting, Settings } from '../../src/db/settingsDB';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';
import { useThemeVersion } from '../../src/context/ThemeContext';
import printerService from '../../src/services/printerService';
import { generateAIImage } from '../../src/services/aiService';
import { getAllCategories, addCategory, getCategoryByName } from '../../src/db/categoriesDB';
import { getAllItems, addItem, updateItem, getItemByCode } from '../../src/db/itemsDB';

export default function UtilitySettingsScreen() {
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
    auto_generate_image: '0',
    add_product_by_click: '0',
  });
  
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [paperWidth, setPaperWidth] = useState(58);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  
  const [dbFilesFound, setDbFilesFound] = useState<{uri: string; name: string}[]>([]);
  const [dbSelectionVisible, setDbSelectionVisible] = useState(false);

  const { importUrl } = useLocalSearchParams<{ importUrl?: string }>();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useFocusEffect(useCallback(() => {
    setSettings(getAllSettings());
    loadPrinterSettings();
    AsyncStorage.getItem('license_type').then(type => {
      setIsDemo(type === 'demo');
    });
  }, []));

  useEffect(() => {
    if (importUrl) {
      handleExternalImport(importUrl);
    }
  }, [importUrl]);

  const handleExternalImport = async (url: string) => {
    Alert.alert(
      'Import File',
      'You opened a backup file. What type of backup is this?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Menu Backup (.json)',
          onPress: async () => {
            try {
              let targetUri = url;
              // If it's a content URI from WhatsApp, copy it to cache first because readAsStringAsync often fails on raw content URIs
              if (url.startsWith('content://')) {
                const tempFile = FileSystem.cacheDirectory + 'temp_menu_import.json';
                await FileSystem.copyAsync({ from: url, to: tempFile });
                targetUri = tempFile;
              }
              const jsonString = await FileSystem.readAsStringAsync(targetUri, { encoding: FileSystem.EncodingType.UTF8 });
              await processMenuImport(jsonString);
            } catch (e) {
              Alert.alert('Error', 'Failed to read menu file. Make sure it is a valid text/json file.');
            }
          }
        },
        {
          text: 'Full Database (.db)',
          onPress: () => {
            confirmRestore(url);
          }
        }
      ]
    );
  };

  const loadPrinterSettings = async () => {
    const width = await AsyncStorage.getItem('printer_paper_width');
    if (width) setPaperWidth(parseInt(width, 10));
  };

  const handleScan = async () => {
    setIsScanning(true);
    setDevices([]);
    try {
      const list = await printerService.getDevices();
      setDevices(list || []);
      if (list && list.length > 0) {
        setShowDropdown(true);
      } else {
        Alert.alert("No Printers Found", "Could not find any Bluetooth printers nearby.");
      }
    } catch (e) {
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

  const handleExportDatabase = async () => {
    try {
      try {
        const db = getDB();
        db.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch (e) {
        console.log('WAL checkpoint failed', e);
      }

      // Close the DB before copying so all locks are released
      closeDB();

      const dbPath = FileSystem.documentDirectory + 'SQLite/melonelite.db';
      const dbExists = await FileSystem.getInfoAsync(dbPath);
      
      if (!dbExists.exists) {
        Alert.alert('Error', 'Database file not found');
        return;
      }

      // Copy to a temporary location with a timestamped name for sharing
      const backupName = `MeloneLite_Full_Backup_${Date.now()}.db`;
      const tempPath = FileSystem.cacheDirectory + backupName;
      await FileSystem.copyAsync({ from: dbPath, to: tempPath });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempPath, {
          mimeType: 'application/x-sqlite3',
          dialogTitle: 'Share Database Backup',
          UTI: 'public.database' // For iOS
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export database');
      console.error(error);
    }
  };

  const confirmRestore = (dbFileUri: string) => {
    Alert.alert(
      'Restore Database',
      'Are you sure you want to restore the database? Current data will be overwritten.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const dbPath = FileSystem.documentDirectory + 'SQLite/melonelite.db';
              const walPath = dbPath + '-wal';
              const shmPath = dbPath + '-shm';
              
              const dbDir = FileSystem.documentDirectory + 'SQLite';
              const dirInfo = await FileSystem.getInfoAsync(dbDir);
              if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
              }

              // Preserve theme settings from the current DB before it gets overwritten
              let currentPrimary = '';
              let currentSecondary = '';
              try {
                currentPrimary = getSetting('theme_primary');
                currentSecondary = getSetting('theme_secondary');
              } catch (e) {
                console.log('Failed to fetch current theme', e);
              }

              // CRITICAL: Close the database connection before replacing the file
              // to prevent "disk I/O error" and corruption.
              closeDB();

              const walExists = await FileSystem.getInfoAsync(walPath);
              if (walExists.exists) await FileSystem.deleteAsync(walPath);
              
              const shmExists = await FileSystem.getInfoAsync(shmPath);
              if (shmExists.exists) await FileSystem.deleteAsync(shmPath);

              // Since DocumentPicker returns a file:// URI, copyAsync is perfectly safe and won't corrupt binary files
              await FileSystem.copyAsync({ from: dbFileUri, to: dbPath });

              // Re-open DB and restore the saved theme settings
              try {
                const newDb = getDB();
                if (currentPrimary) {
                  newDb.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['theme_primary', currentPrimary]);
                }
                if (currentSecondary) {
                  newDb.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['theme_secondary', currentSecondary]);
                }
              } catch (e) {
                console.log('Failed to restore theme into new DB', e);
              }

              // Trigger background image generation on next startup
              try {
                await AsyncStorage.setItem('generate_missing_images', 'true');
              } catch (e) {}

              Alert.alert(
                'Success',
                'Database restored successfully. Please fully restart the app for the changes to take effect.',
                [{ text: 'OK' }]
              );
            } catch (e) {
              Alert.alert('Error', 'Failed to restore database');
            }
          }
        }
      ]
    );
  };

  const handleImportDatabase = () => {
    Alert.alert(
      'Import Database',
      'Where is your database backup file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select from Device',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
              });

              if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
              }

              const file = result.assets[0];
              const isDb = file.name.toLowerCase().endsWith('.db') || file.name.toLowerCase().endsWith('.sqlite');
              
              if (!isDb) {
                Alert.alert('Wrong File', 'Please select a valid .db database backup file.');
                return;
              }

              confirmRestore(file.uri);
            } catch (e) {
              Alert.alert('Error', 'Failed to select the database file.');
              console.error(e);
            }
          }
        },
        {
          text: 'Open WhatsApp',
          onPress: () => {
            import('expo-linking').then(Linking => {
              Linking.openURL('whatsapp://send?text= ').catch(() => {
                Alert.alert('Error', 'WhatsApp is not installed or cannot be opened.');
              });
            });
          }
        }
      ]
    );
  };

  const handleExportMenu = async () => {
    try {
      const categories = getAllCategories();
      const items = getAllItems();

      const backupData = {
        type: "MeloneLite_Menu_Backup",
        version: 1,
        categories,
        items,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      // Create a temporary file to share
      const tempFileUri = FileSystem.cacheDirectory + `MeloneLite_Menu_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(tempFileUri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempFileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Share Menu Backup',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to export menu.');
      console.error(e);
    }
  };

  const processMenuImport = async (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.type !== "MeloneLite_Menu_Backup") {
        Alert.alert("Invalid File", "This file does not appear to be a valid MeloneLite Menu Backup.");
        return;
      }

      let categoriesAdded = 0;
      let itemsAdded = 0;
      let itemsUpdated = 0;

      // 1. Process Categories
      const categoryIdMap = new Map<number, number>(); // Map old ID to new ID
      
      for (const oldCat of (data.categories || [])) {
        // Check if category exists by name
        let existingCat = getCategoryByName(oldCat.name);
        if (existingCat) {
          categoryIdMap.set(oldCat.id, existingCat.id);
        } else {
          // Create new category
          const newId = addCategory(
            oldCat.name,
            oldCat.name_ar || null,
            oldCat.name_ml || null,
            oldCat.name_ta || null,
            oldCat.name_hi || null,
            oldCat.color || '#D4A853'
          );
          categoryIdMap.set(oldCat.id, newId);
          categoriesAdded++;
        }
      }

      // 2. Process Items
      for (const item of (data.items || [])) {
        const existingItem = getItemByCode(item.item_code);
        
        // Map the old category ID to the new one
        const newCategoryId = item.category_id ? (categoryIdMap.get(item.category_id) || null) : null;

        if (existingItem) {
          // Update existing item
          updateItem(
            existingItem.id,
            item.item_code,
            item.item_name,
            item.item_name_ar || null,
            item.item_name_ml || null,
            item.item_name_ta || null,
            item.item_name_hi || null,
            item.rate,
            newCategoryId,
            item.image_uri || null,
            item.is_available,
            item.barcode || null
          );
          itemsUpdated++;
        } else {
          // Insert new item
          addItem(
            item.item_code,
            item.item_name,
            item.item_name_ar || null,
            item.item_name_ml || null,
            item.item_name_ta || null,
            item.item_name_hi || null,
            item.rate,
            newCategoryId,
            item.image_uri || null,
            item.barcode || null
          );
          itemsAdded++;
        }
      }

      Alert.alert(
        "Import Successful",
        `Menu imported successfully!\n\nCategories Added: ${categoriesAdded}\nItems Added: ${itemsAdded}\nItems Updated: ${itemsUpdated}\n\nAny missing images will now be automatically generated in the background.`
      );

      // Start background image generation
      const generateImagesInBackground = async () => {
        let generatedCount = 0;
        for (const item of (data.items || [])) {
          try {
            let needsImage = false;
            if (!item.image_uri) {
              needsImage = true;
            } else {
              const fileInfo = await FileSystem.getInfoAsync(item.image_uri);
              if (!fileInfo.exists) {
                needsImage = true;
              }
            }

            if (needsImage) {
              const cat = (data.categories || []).find((c: any) => c.id === item.category_id);
              const url = await generateAIImage(item.item_name, cat ? cat.name : '');
              if (url) {
                // Fetch the latest state of the item from DB
                const currentItem = getItemByCode(item.item_code);
                if (currentItem) {
                  updateItem(
                    currentItem.id,
                    currentItem.item_code,
                    currentItem.item_name,
                    currentItem.item_name_ar,
                    currentItem.item_name_ml,
                    currentItem.item_name_ta,
                    currentItem.item_name_hi,
                    currentItem.rate,
                    currentItem.category_id,
                    url,
                    currentItem.is_available,
                    currentItem.barcode
                  );
                  generatedCount++;
                }
              }
            }
          } catch (e) {
            console.log('Background image gen error:', e);
          }
        }
        console.log(`Auto-generated ${generatedCount} missing images in background.`);
      };

      // Kick off asynchronously without blocking
      generateImagesInBackground();

    } catch (e) {
      Alert.alert('Import Error', 'Failed to parse or import the menu data.');
      console.error(e);
    }
  };

  const handleImportMenu = () => {
    Alert.alert(
      'Import Menu',
      'Where is your menu backup (.json) file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select from Device',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/json', '*/*'],
                copyToCacheDirectory: true,
              });

              if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
              }

              const file = result.assets[0];
              if (!file.name.toLowerCase().endsWith('.json')) {
                Alert.alert('Wrong File', 'Please select a valid .json menu backup file.');
                return;
              }

              const jsonString = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
              await processMenuImport(jsonString);
            } catch (e) {
              Alert.alert('Error', 'Failed to read the menu file.');
              console.error(e);
            }
          }
        },
        {
          text: 'Open WhatsApp',
          onPress: () => {
            import('expo-linking').then(Linking => {
              Linking.openURL('whatsapp://send?text= ').catch(() => {
                Alert.alert('Error', 'WhatsApp is not installed or cannot be opened.');
              });
            });
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
            <Text style={styles.headerTitle}>Utility Settings</Text>
          </View>
          <ScrollView contentContainerStyle={[styles.scrollContent, isLandscape && styles.scrollContentLandscape]} showsVerticalScrollIndicator={false}>
            {printerService?.isMock && (
              <View style={styles.warningCard}>
                <View style={styles.warningHeader}>
                  <MaterialCommunityIcons name="alert-decagram" size={20} color="#E74C3C" />
                  <Text style={styles.warningTitle}>Setup Required</Text>
                </View>
                <Text style={styles.warningText}>
                  Bluetooth printing is currently in <Text style={{ fontWeight: 'bold' }}>Mock Mode</Text>. 
                </Text>
              </View>
            )}
            
            

          {/* Bluetooth Printer */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="printer-pos" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Bluetooth Printer</Text>
            </View>
            
            <Text style={styles.fieldLabel}>Paper Width</Text>
            <View style={styles.tabRow}>
              <TouchableOpacity 
                style={[styles.tab, paperWidth === 48 && styles.tabActive]}
                onPress={() => handlePaperWidth(48)}
              >
                <Text style={[styles.tabText, paperWidth === 48 && styles.tabTextActive]}>48mm</Text>
                <Text style={[styles.tabText, paperWidth === 48 && styles.tabTextActive, { fontSize: 9 }]}>2" Compact</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, paperWidth === 58 && styles.tabActive]}
                onPress={() => handlePaperWidth(58)}
              >
                <Text style={[styles.tabText, paperWidth === 58 && styles.tabTextActive]}>58mm</Text>
                <Text style={[styles.tabText, paperWidth === 58 && styles.tabTextActive, { fontSize: 9 }]}>2" Standard</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, paperWidth === 80 && styles.tabActive]}
                onPress={() => handlePaperWidth(80)}
              >
                <Text style={[styles.tabText, paperWidth === 80 && styles.tabTextActive]}>80mm</Text>
                <Text style={[styles.tabText, paperWidth === 80 && styles.tabTextActive, { fontSize: 9 }]}>3" Standard</Text>
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

          {/* Barcode Settings */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="barcode-scan" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Barcode</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: Spacing.md }}>
                <Text style={styles.fieldLabel}>Require Barcode for Items</Text>
                <Text style={{ ...Typography.caption, color: Colors.textMuted, marginTop: 4 }}>
                  When enabled, you can scan or enter a barcode when adding items. You can also scan barcodes on the home page to add items directly to the cart.
                </Text>
              </View>
              <Switch
                value={settings.require_barcode === '1'}
                onValueChange={(val) => {
                  const strVal = val ? '1' : '0';
                  setSettings(s => ({ ...s, require_barcode: strVal }));
                  setSetting('require_barcode', strVal);
                }}
                trackColor={{ false: Colors.surface, true: Colors.goldOverlay }}
                thumbColor={settings.require_barcode === '1' ? Colors.gold : Colors.textMuted}
              />
            </View>
          </View>

          {/* Products Settings */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="cube-outline" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Products Settings</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
              <View style={{ flex: 1, paddingRight: Spacing.md }}>
                <Text style={styles.fieldLabel}>Auto Generate Image</Text>
                <Text style={{ ...Typography.caption, color: Colors.textMuted, marginTop: 4 }}>
                  Automatically generate an AI image when saving an item if no image is provided.
                </Text>
              </View>
              <Switch
                value={settings.auto_generate_image === '1'}
                onValueChange={(val) => {
                  const strVal = val ? '1' : '0';
                  setSettings(s => ({ ...s, auto_generate_image: strVal }));
                  setSetting('auto_generate_image', strVal);
                }}
                trackColor={{ false: Colors.surface, true: Colors.goldOverlay }}
                thumbColor={settings.auto_generate_image === '1' ? Colors.gold : Colors.textMuted}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: Spacing.md }}>
                <Text style={styles.fieldLabel}>Add Product By Click Card</Text>
                <Text style={{ ...Typography.caption, color: Colors.textMuted, marginTop: 4 }}>
                  Add a product to cart or increment its quantity by simply tapping its card.
                </Text>
              </View>
              <Switch
                value={settings.add_product_by_click === '1'}
                onValueChange={(val) => {
                  const strVal = val ? '1' : '0';
                  setSettings(s => ({ ...s, add_product_by_click: strVal }));
                  setSetting('add_product_by_click', strVal);
                }}
                trackColor={{ false: Colors.surface, true: Colors.goldOverlay }}
                thumbColor={settings.add_product_by_click === '1' ? Colors.gold : Colors.textMuted}
              />
            </View>
          </View>

          {/* Backup & Restore — export always visible, import hidden for demo users */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="database-sync-outline" size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Backup & Restore</Text>
            </View>

            {/* Sub-section 1: Menu Transfer */}
            <View style={{ marginBottom: Spacing.xl }}>
              <Text style={[styles.fieldLabel, { marginBottom: Spacing.xs, color: Colors.gold, fontFamily: Typography.semiBold }]}>
                1. Menu Transfer (Categories & Items)
              </Text>
              <Text style={[styles.fieldLabel, { marginBottom: Spacing.md }]}>
                Export your menu to a JSON file. Share this via WhatsApp and import it on another device without affecting past orders or settings.
              </Text>

              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <TouchableOpacity style={[styles.backupBtn, { flex: isDemo ? undefined : 1, marginBottom: 0 }]} onPress={handleExportMenu}>
                  <MaterialCommunityIcons name="export-variant" size={20} color={Colors.textInverse} />
                  <Text style={styles.backupBtnText}>Export Menu</Text>
                </TouchableOpacity>

                {!isDemo && (
                  <TouchableOpacity style={[styles.restoreBtn, { flex: 1, marginBottom: 0 }]} onPress={handleImportMenu}>
                    <MaterialCommunityIcons name="import" size={20} color={Colors.gold} />
                    <Text style={styles.restoreBtnText}>Import Menu</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: Colors.border, marginBottom: Spacing.xl }} />

            {/* Sub-section 2: Full Database */}
            <View>
              <Text style={[styles.fieldLabel, { marginBottom: Spacing.xs, color: Colors.gold, fontFamily: Typography.semiBold }]}>
                2. Full Database Backup
              </Text>
              <Text style={[styles.fieldLabel, { marginBottom: Spacing.md }]}>
                Export the ENTIRE database (including all past orders and settings). Restoring will overwrite everything on the device.
              </Text>

              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <TouchableOpacity style={[styles.backupBtn, { flex: isDemo ? undefined : 1, marginBottom: 0, backgroundColor: Colors.surface }]} onPress={handleExportDatabase}>
                  <MaterialCommunityIcons name="export-variant" size={20} color={Colors.textPrimary} />
                  <Text style={[styles.backupBtnText, { color: Colors.textPrimary }]}>Export DB</Text>
                </TouchableOpacity>

                {!isDemo && (
                  <TouchableOpacity style={[styles.restoreBtn, { flex: 1, marginBottom: 0, borderColor: '#E74C3C' }]} onPress={handleImportDatabase}>
                    <MaterialCommunityIcons name="alert" size={20} color="#E74C3C" />
                    <Text style={[styles.restoreBtnText, { color: '#E74C3C' }]}>Import DB</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>


            {/* App Theme */}
            <TouchableOpacity 
              style={styles.section} 
              onPress={() => router.push('/settings/theme')}
              activeOpacity={0.8}
            >
              <View style={[styles.sectionHeader, { borderBottomWidth: 0, marginBottom: 0, justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <MaterialCommunityIcons name="palette" size={20} color={Colors.gold} />
                  <Text style={styles.sectionTitle}>App Theme</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </View>
              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>
                Customize your primary accent color and background theme              </Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* DB File Selector Modal */}
          <Modal
            visible={dbSelectionVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setDbSelectionVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Backup File</Text>
                  <TouchableOpacity onPress={() => setDbSelectionVisible(false)}>
                    <MaterialCommunityIcons name="close" size={24} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: Colors.textMuted, marginBottom: 12, fontFamily: Typography.regular, fontSize: 13 }}>
                  Tap the file you want to restore/import:
                </Text>
                <FlatList
                  data={dbFilesFound}
                  keyExtractor={(item) => item.uri}
                  style={{ width: '100%', maxHeight: 400 }}
                  renderItem={({ item }) => {
                    const isJson = item.name.toLowerCase().endsWith('.json');
                    const isDb = item.name.toLowerCase().endsWith('.db') || item.name.toLowerCase().endsWith('.sqlite');
                    
                    return (
                      <TouchableOpacity
                        style={[styles.dbFileItem, (!isJson && !isDb) && { opacity: 0.4 }]}
                        onPress={async () => {
                          if (!isJson && !isDb) {
                            Alert.alert('Wrong File', `"${item.name}" is not a supported file type.`);
                            return;
                          }
                          
                          setDbSelectionVisible(false);
                          
                          if (isJson) {
                            try {
                              const jsonString = await FileSystem.readAsStringAsync(item.uri, { encoding: FileSystem.EncodingType.UTF8 });
                              await processMenuImport(jsonString);
                            } catch (e) {
                              Alert.alert('Error', 'Failed to read JSON file.');
                            }
                          } else {
                            confirmRestore(item.uri);
                          }
                        }}
                      >
                        <MaterialCommunityIcons
                          name={isJson ? 'code-json' : (isDb ? 'database' : 'file-outline')}
                          size={24}
                          color={(isJson || isDb) ? Colors.primary : Colors.textMuted}
                          style={{ marginRight: 12 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dbFileText, (!isJson && !isDb) && { color: Colors.textMuted }]} numberOfLines={2}>
                            {item.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: Colors.gold, fontFamily: Typography.regular }}>
                            {isJson ? 'Tap to import menu' : (isDb ? 'Tap to restore this database' : 'Unsupported format')}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setDbSelectionVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
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


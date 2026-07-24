import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Image, KeyboardAvoidingView, Platform,
  Modal, TouchableWithoutFeedback, useWindowDimensions, Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  addItem, updateItem, getItemById, generateItemCode, isItemCodeUnique, isBarcodeUnique,
} from '../src/db/itemsDB';
import { getAllCategories, Category } from '../src/db/categoriesDB';
import { Colors, Spacing, Radius, Typography, Shadows } from '../src/constants/theme';
import { generateAIImage } from '../src/services/aiService';
import { getSetting } from '../src/db/settingsDB';

import { useThemeVersion } from '../src/context/ThemeContext';

export default function ItemFormScreen() {
  const themeVersion = useThemeVersion();
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const params = useLocalSearchParams<{ id?: string; scannedBarcode?: string }>();
  const { id } = params;
  const isEdit = !!id;

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemNameAr, setItemNameAr] = useState('');
  const [itemNameMl, setItemNameMl] = useState('');
  const [itemNameTa, setItemNameTa] = useState('');
  const [itemNameHi, setItemNameHi] = useState('');
  const [itemNameKn, setItemNameKn] = useState('');
  const [rate, setRate] = useState('');
  const [barcode, setBarcode] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryDropdown, setCategoryDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [prices, setPrices] = useState<{name: string, price: string}[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [requireBarcode, setRequireBarcode] = useState(false);
  const enableMultiplePrices = true;
  const [enableArabic, setEnableArabic] = useState(false);
  const [enableMalayalam, setEnableMalayalam] = useState(false);
  const [enableTamil, setEnableTamil] = useState(false);
  const [enableHindi, setEnableHindi] = useState(false);
  const [enableKannada, setEnableKannada] = useState(false);

  // Receive scanned barcode from barcode-scanner screen via params
  useEffect(() => {
    if (params.scannedBarcode && params.scannedBarcode !== barcode) {
      setBarcode(params.scannedBarcode);
    }
  }, [params.scannedBarcode]);

  const handleAIImage = async () => {
    if (!itemName.trim()) {
      Alert.alert('AI Generator', 'Please enter an item name first.');
      return;
    }
    setIsGeneratingAI(true);
    try {
      const cat = categories.find(c => c.id === categoryId);
      const url = await generateAIImage(itemName, cat?.name || '');
      if (url) {
        setImageUri(url);
      } else {
        Alert.alert('AI Busy', 'The free AI image server is currently generating an image. Please wait 10 seconds and tap Generate again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Auto-transliterate item name when typing pauses
  useEffect(() => {
    if (!itemName.trim()) {
      setItemNameAr('');
      setItemNameMl('');
      setItemNameTa('');
      setItemNameHi('');
      setItemNameKn('');
      return;
    }

    const timerId = setTimeout(async () => {
      try {
        // Arabic
        if (enableArabic) {
          const resAr = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(itemName)}&itc=ar-t-i0-und&num=1`);
          const dataAr = await resAr.json();
          if (dataAr[0] === 'SUCCESS' && Array.isArray(dataAr[1])) {
            setItemNameAr(dataAr[1][0][1][0]);
          }
        }

        // Malayalam
        if (enableMalayalam) {
          const resMl = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(itemName)}&itc=ml-t-i0-und&num=1`);
          const dataMl = await resMl.json();
          if (dataMl[0] === 'SUCCESS' && Array.isArray(dataMl[1])) {
            setItemNameMl(dataMl[1][0][1][0]);
          }
        }

        // Tamil
        if (enableTamil) {
          const resTa = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(itemName)}&itc=ta-t-i0-und&num=1`);
          const dataTa = await resTa.json();
          if (dataTa[0] === 'SUCCESS' && Array.isArray(dataTa[1])) {
            setItemNameTa(dataTa[1][0][1][0]);
          }
        }

        // Hindi
        if (enableHindi) {
          const resHi = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(itemName)}&itc=hi-t-i0-und&num=1`);
          const dataHi = await resHi.json();
          if (dataHi[0] === 'SUCCESS' && Array.isArray(dataHi[1])) {
            setItemNameHi(dataHi[1][0][1][0]);
          }
        }
        
        // Kannada
        if (enableKannada) {
          const resKn = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(itemName)}&itc=kn-t-i0-und&num=1`);
          const dataKn = await resKn.json();
          if (dataKn[0] === 'SUCCESS' && Array.isArray(dataKn[1])) {
            setItemNameKn(dataKn[1][0][1][0]);
          }
        }
      } catch (err) {
        console.log('Transliteration failed:', err);
      }
    }, 800);

    return () => clearTimeout(timerId);
  }, [itemName, enableArabic, enableMalayalam, enableTamil, enableHindi, enableKannada]);

  useEffect(() => {
    const cats = getAllCategories();
    setCategories(cats);
    setCurrencySymbol(getSetting('currency_symbol') || '₹');
    const reqBarcode = getSetting('require_barcode') === '1';
    setRequireBarcode(reqBarcode);
    setEnableArabic(getSetting('enable_arabic') === '1');
    setEnableMalayalam(getSetting('enable_malayalam') === '1');
    setEnableTamil(getSetting('enable_tamil') === '1');
    setEnableHindi(getSetting('enable_hindi') === '1');
    setEnableKannada(getSetting('enable_kannada') === '1');

    if (isEdit && id) {
      const item = getItemById(parseInt(id));
      if (item) {
        setItemCode(item.item_code);
        setItemName(item.item_name);
        setItemNameAr(item.item_name_ar || '');
        setItemNameMl(item.item_name_ml || '');
        setItemNameTa(item.item_name_ta || '');
        setItemNameHi(item.item_name_hi || '');
        setItemNameKn(item.item_name_kn || '');
        setRate(item.rate.toString());
        setImageUri(item.image_uri);
        setCategoryId(item.category_id);
        setBarcode(item.barcode || '');
        if (item.prices_json) {
          try {
            const parsedPrices = JSON.parse(item.prices_json);
            setPrices(parsedPrices.map((p: any) => ({ name: p.name, price: String(p.price) })));
          } catch (e) {
            console.log('Error parsing prices_json', e);
          }
        }
      }
    } else {
      setItemCode(generateItemCode());
    }
  }, [id]);

  const pickImage = () => {
    setImageModalVisible(true);
  };

  const handleSave = async () => {
    if (!itemCode.trim()) { Alert.alert('Validation', 'Item code is required'); return; }
    if (!itemName.trim()) { Alert.alert('Validation', 'Item name is required'); return; }
    
    // Process prices
    let rateNum = parseFloat(rate);
    const validPrices = prices.filter(p => p.name.trim() !== '' && p.price.trim() !== '');
    if (enableMultiplePrices && validPrices.length > 0) {
      const firstPrice = parseFloat(validPrices[0].price);
      if (isNaN(firstPrice) || firstPrice < 0) {
        Alert.alert('Validation', 'Enter a valid price for the first variant');
        return;
      }
      rateNum = firstPrice; // Use first variant as default rate
    } else {
      if (isNaN(rateNum) || rateNum < 0) { Alert.alert('Validation', 'Enter a valid rate'); return; }
    }

    const pricesJson = validPrices.length > 0 ? JSON.stringify(validPrices.map(p => ({ name: p.name.trim(), price: parseFloat(p.price) }))) : null;

    const unique = isItemCodeUnique(itemCode.trim(), isEdit ? parseInt(id!) : undefined);
    if (!unique) { Alert.alert('Duplicate Code', 'This item code already exists'); return; }

    if (barcode.trim()) {
      const barcodeUnique = isBarcodeUnique(barcode.trim(), isEdit ? parseInt(id!) : undefined);
      if (!barcodeUnique) {
        Alert.alert('Duplicate Barcode', 'This barcode is already assigned to another item.');
        return;
      }
    }

    setSaving(true);
    try {
      let finalImageUri = imageUri;
      
      const autoGenerateSetting = getSetting('auto_generate_image');
      if (!finalImageUri && autoGenerateSetting === '1') {
        const cat = categories.find(c => c.id === categoryId);
        const aiUrl = await generateAIImage(itemName, cat?.name || '');
        if (aiUrl) {
          finalImageUri = aiUrl;
        }
      }

      if (isEdit) {
        updateItem(parseInt(id!), itemCode, itemName, itemNameAr, itemNameMl, itemNameTa, itemNameHi, itemNameKn, rateNum, categoryId, finalImageUri, 1, barcode, pricesJson);
      } else {
        addItem(itemCode, itemName, itemNameAr, itemNameMl, itemNameTa, itemNameHi, itemNameKn, rateNum, categoryId, finalImageUri, barcode, pricesJson);
      }

      if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)'); }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save item');
    } finally {
      setSaving(false);
    }
  };

  const selectedCategory = categories.find(c => c.id === categoryId);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => { if(router.canGoBack()) router.back(); else router.replace('/(tabs)'); }}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isEdit ? 'Edit Item' : 'New Item'}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, isLandscape && styles.scrollContentLandscape]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {isLandscape ? (
              <View style={styles.landscapeRow}>
                <TouchableOpacity style={styles.imagePickerLandscape} onPress={pickImage} activeOpacity={0.8} disabled={isGeneratingAI}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                  ) : isGeneratingAI ? (
                    <View style={styles.imagePlaceholder}>
                      <MaterialCommunityIcons name="loading" size={32} color={Colors.gold} />
                      <Text style={styles.imageHint}>Generating...</Text>
                    </View>
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <MaterialCommunityIcons name="camera-plus-outline" size={32} color={Colors.gold} />
                      <Text style={styles.imageHint}>Tap to add photo</Text>
                      <TouchableOpacity style={styles.aiTrigger} onPress={(e) => { e.stopPropagation(); handleAIImage(); }}>
                        <MaterialCommunityIcons name="auto-fix" size={14} color={Colors.textInverse} />
                        <Text style={styles.aiTriggerText}>AI</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <FormFields
                    itemCode={itemCode} setItemCode={setItemCode}
                    itemName={itemName} setItemName={setItemName}
                    itemNameAr={itemNameAr} setItemNameAr={setItemNameAr}
                    itemNameMl={itemNameMl} setItemNameMl={setItemNameMl}
                    itemNameTa={itemNameTa} setItemNameTa={setItemNameTa}
                    itemNameHi={itemNameHi} setItemNameHi={setItemNameHi}
                    itemNameKn={itemNameKn} setItemNameKn={setItemNameKn}
                    enableArabic={enableArabic} enableMalayalam={enableMalayalam} enableTamil={enableTamil} enableHindi={enableHindi} enableKannada={enableKannada}
                    rate={rate} setRate={setRate}
                    prices={prices} setPrices={setPrices}
                    enableMultiplePrices={enableMultiplePrices}
                    barcode={barcode} setBarcode={setBarcode}
                    requireBarcode={requireBarcode}
                    currencySymbol={currencySymbol}
                    categoryId={categoryId} setCategoryId={setCategoryId}
                    categories={categories}
                    categoryDropdown={categoryDropdown} setCategoryDropdown={setCategoryDropdown}
                    selectedCategory={selectedCategory}
                  />
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8} disabled={isGeneratingAI}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                  ) : isGeneratingAI ? (
                    <View style={styles.imagePlaceholder}>
                      <MaterialCommunityIcons name="loading" size={40} color={Colors.gold} style={{ transform: [{ rotate: '45deg' }] }} />
                      <Text style={styles.imageHint}>Generating AI Image...</Text>
                    </View>
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <MaterialCommunityIcons name="camera-plus-outline" size={40} color={Colors.gold} />
                      <Text style={styles.imageHint}>Tap to add photo</Text>
                      <TouchableOpacity style={styles.aiTrigger} onPress={(e) => { e.stopPropagation(); handleAIImage(); }}>
                        <MaterialCommunityIcons name="auto-fix" size={16} color={Colors.textInverse} />
                        <Text style={styles.aiTriggerText}>AI Generate</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>

                <FormFields
                  itemCode={itemCode} setItemCode={setItemCode}
                  itemName={itemName} setItemName={setItemName}
                  itemNameAr={itemNameAr} setItemNameAr={setItemNameAr}
                  itemNameMl={itemNameMl} setItemNameMl={setItemNameMl}
                  itemNameTa={itemNameTa} setItemNameTa={setItemNameTa}
                  itemNameHi={itemNameHi} setItemNameHi={setItemNameHi}
                  itemNameKn={itemNameKn} setItemNameKn={setItemNameKn}
                  enableArabic={enableArabic} enableMalayalam={enableMalayalam} enableTamil={enableTamil} enableHindi={enableHindi} enableKannada={enableKannada}
                  rate={rate} setRate={setRate}
                  prices={prices} setPrices={setPrices}
                  enableMultiplePrices={enableMultiplePrices}
                  barcode={barcode} setBarcode={setBarcode}
                  requireBarcode={requireBarcode}
                  currencySymbol={currencySymbol}
                  categoryId={categoryId} setCategoryId={setCategoryId}
                  categories={categories}
                  categoryDropdown={categoryDropdown} setCategoryDropdown={setCategoryDropdown}
                  selectedCategory={selectedCategory}
                />
              </>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave} disabled={saving} activeOpacity={0.88}>
              <MaterialCommunityIcons name={isEdit ? 'content-save' : 'plus-circle'} size={22} color={Colors.textInverse} />
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Item'}</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={imageModalVisible} transparent animationType="slide" onRequestClose={() => setImageModalVisible(false)}>
            <TouchableWithoutFeedback onPress={() => setImageModalVisible(false)}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                  <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Select Item Image</Text>
                      <TouchableOpacity onPress={() => setImageModalVisible(false)}><MaterialCommunityIcons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
                    </View>
                    <View style={styles.modalOptions}>
                      <TouchableOpacity style={styles.modalOptionBtn} onPress={async () => { setImageModalVisible(false); const { status } = await ImagePicker.requestCameraPermissionsAsync(); if (status !== 'granted') return; const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 }); if (!result.canceled) setImageUri(result.assets[0].uri); }}>
                        <View style={styles.modalOptionIconBg}><MaterialCommunityIcons name="camera" size={22} color={Colors.gold} /></View>
                        <Text style={styles.modalOptionText}>Take Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.modalOptionBtn} onPress={async () => { setImageModalVisible(false); const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (status !== 'granted') return; const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 }); if (!result.canceled) setImageUri(result.assets[0].uri); }}>
                        <View style={styles.modalOptionIconBg}><MaterialCommunityIcons name="image" size={22} color={Colors.gold} /></View>
                        <Text style={styles.modalOptionText}>Choose from Gallery</Text>
                      </TouchableOpacity>
                    </View>
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

function FormFields({
  itemCode, setItemCode, itemName, setItemName, 
  itemNameAr, setItemNameAr, itemNameMl, setItemNameMl, itemNameTa, setItemNameTa, itemNameHi, setItemNameHi, itemNameKn, setItemNameKn,
  enableArabic, enableMalayalam, enableTamil, enableHindi, enableKannada,
  rate, setRate, prices, setPrices, enableMultiplePrices, barcode, setBarcode,
  requireBarcode, currencySymbol,
  categoryId, setCategoryId, categories,
  categoryDropdown, setCategoryDropdown, selectedCategory,
}: any) {
  const themeVersion = useThemeVersion();
  const styles = useMemo(() => createStyles(), [themeVersion]);
  return (
    <View style={styles.formCard}>
      <Text style={styles.label}>Item Code *</Text>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={itemCode} onChangeText={setItemCode} placeholder="e.g. ITM0001" />
      </View>

      <Text style={[styles.label, { marginTop: Spacing.lg }]}>Item Name *</Text>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={itemName} onChangeText={setItemName} placeholder="e.g. Chicken" />
      </View>

      {enableArabic && (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={styles.label}>Item Name (Arabic)</Text>
          <View style={styles.inputRow}><TextInput style={[styles.input, { textAlign: 'right' }]} value={itemNameAr} onChangeText={setItemNameAr} /></View>
        </View>
      )}

      {enableMalayalam && (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={styles.label}>Item Name (Malayalam)</Text>
          <View style={styles.inputRow}><TextInput style={styles.input} value={itemNameMl} onChangeText={setItemNameMl} /></View>
        </View>
      )}

      {enableTamil && (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={styles.label}>Item Name (Tamil)</Text>
          <View style={styles.inputRow}><TextInput style={styles.input} value={itemNameTa} onChangeText={setItemNameTa} /></View>
        </View>
      )}

      {enableHindi && (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={styles.label}>Item Name (Hindi)</Text>
          <View style={styles.inputRow}><TextInput style={styles.input} value={itemNameHi} onChangeText={setItemNameHi} /></View>
        </View>
      )}

      {enableKannada && (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={styles.label}>Item Name (Kannada)</Text>
          <View style={styles.inputRow}><TextInput style={styles.input} value={itemNameKn} onChangeText={setItemNameKn} /></View>
        </View>
      )}

      {(!enableMultiplePrices || prices.length === 0) && (
        <>
          <Text style={[styles.label, { marginTop: Spacing.lg }]}>Rate ({currencySymbol}) *</Text>
          <View style={styles.inputRow}>
            <Text style={{ marginRight: 8, color: Colors.gold, fontFamily: 'Poppins-Bold' }}>{currencySymbol}</Text>
            <TextInput style={styles.input} value={rate} onChangeText={setRate}
              placeholder="0.00" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
          </View>
        </>
      )}

      {enableMultiplePrices && (
        <View style={{ marginTop: Spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm }}>
            <Text style={styles.label}>Prices / Sizes</Text>
            <TouchableOpacity onPress={() => setPrices([...prices, { name: '', price: '' }])}>
              <Text style={{ color: Colors.gold, fontFamily: 'Poppins-Medium', fontSize: 13 }}>+ Add Variant</Text>
            </TouchableOpacity>
          </View>
          
          {prices.map((p: any, idx: number) => (
            <View key={idx} style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm }}>
              <View style={[styles.inputRow, { flex: 1 }]}>
                <TextInput 
                  style={styles.input} 
                  value={p.name} 
                  onChangeText={(val) => {
                    const newPrices = [...prices];
                    newPrices[idx].name = val;
                    setPrices(newPrices);
                  }} 
                  placeholder="e.g. Small" 
                />
              </View>
              <View style={[styles.inputRow, { flex: 0.8 }]}>
                <Text style={{ marginRight: 4, color: Colors.gold, fontFamily: 'Poppins-Bold' }}>{currencySymbol}</Text>
                <TextInput 
                  style={styles.input} 
                  value={p.price} 
                  onChangeText={(val) => {
                    const newPrices = [...prices];
                    newPrices[idx].price = val;
                    setPrices(newPrices);
                  }} 
                  placeholder="0.00" 
                  keyboardType="decimal-pad" 
                />
              </View>
              <TouchableOpacity 
                style={{ width: 48, height: 48, backgroundColor: Colors.errorBg, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => {
                  const newPrices = [...prices];
                  newPrices.splice(idx, 1);
                  setPrices(newPrices);
                }}
              >
                <MaterialCommunityIcons name="delete-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          {prices.length === 0 && (
            <Text style={{ ...Typography.caption, color: Colors.textMuted, marginTop: 4 }}>
              Add size variants (e.g. Small, Jumbo) with different prices. The standard Rate above will be hidden if you add variants.
            </Text>
          )}
        </View>
      )}

      {/* Barcode (shown only if setting is enabled) */}
      {requireBarcode && (
        <>
          <Text style={[styles.label, { marginTop: Spacing.lg }]}>
            Barcode <Text style={{ color: Colors.textMuted, fontFamily: 'Poppins-Regular' }}>(optional)</Text>
          </Text>
          <View style={styles.inputRow}>
            <MaterialCommunityIcons name="barcode-scan" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Enter or scan barcode"
              placeholderTextColor={Colors.textMuted}
              keyboardType="default"
            />
            <TouchableOpacity
              style={styles.scanBarcodeBtn}
              onPress={() => router.push({ pathname: '/barcode-scanner', params: { mode: 'scan_item' } })}
            >
              <MaterialCommunityIcons name="scan-helper" size={20} color={Colors.gold} />
            </TouchableOpacity>
          </View>
          <Text style={styles.barcodeHint}>
            Tap the scan icon to use the camera, or type/paste the barcode manually
          </Text>
        </>
      )}

      {/* Category Dropdown */}
      <Text style={[styles.label, { marginTop: Spacing.lg }]}>Category</Text>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setCategoryDropdown(!categoryDropdown)}>
        <MaterialCommunityIcons name="tag-outline" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
        <Text style={[styles.dropdownText, !selectedCategory && { color: Colors.textMuted }]}>
          {selectedCategory ? selectedCategory.name : 'Select category (optional)'}
        </Text>
        <MaterialCommunityIcons
          name={categoryDropdown ? 'chevron-up' : 'chevron-down'}
          size={20} color={Colors.textMuted} />
      </TouchableOpacity>

      {categoryDropdown && (
        <View style={styles.dropdownList}>
          <TouchableOpacity
            style={[styles.dropdownItem, categoryId === null && styles.dropdownItemActive]}
            onPress={() => { setCategoryId(null); setCategoryDropdown(false); }}>
            <Text style={[styles.dropdownItemText, categoryId === null && { color: Colors.gold }]}>
              None
            </Text>
          </TouchableOpacity>
          {categories.map((cat: any) => (
            <TouchableOpacity key={cat.id}
              style={[styles.dropdownItem, categoryId === cat.id && styles.dropdownItemActive]}
              onPress={() => { setCategoryId(cat.id); setCategoryDropdown(false); }}>
              <View style={[styles.catDot, { backgroundColor: cat.color || Colors.gold }]} />
              <Text style={[styles.dropdownItemText, categoryId === cat.id && { color: Colors.gold }]}>
                {cat.name}
              </Text>
              {categoryId === cat.id && (
                <MaterialCommunityIcons name="check" size={16} color={Colors.gold} />
              )}
            </TouchableOpacity>
          ))}
          {categories.length === 0 && (
            <View style={styles.dropdownItem}>
              <Text style={styles.dropdownItemText}>No categories yet. Add from Categories tab.</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrapper: { flex: 1, maxWidth: 800, width: '100%', alignSelf: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.heading3 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 350 },
  scrollContentLandscape: { paddingTop: Spacing.sm },

  // Landscape layout
  landscapeRow: { flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-start' },
  imagePickerLandscape: {
    width: 130, height: 130, borderRadius: Radius.lg, overflow: 'hidden',
    ...Shadows.card, alignSelf: 'flex-start',
  },

  // Portrait image picker
  imagePicker: {
    alignSelf: 'center', width: 150, height: 150,
    borderRadius: Radius.lg, overflow: 'hidden',
    marginBottom: Spacing.xl, ...Shadows.card,
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%', height: '100%', backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
    borderRadius: Radius.lg,
  },
  imageHint: { ...Typography.captionMedium, color: Colors.gold, marginTop: 8 },
  imageHintSub: { ...Typography.caption, marginTop: 2 },
  imageEditBadge: {
    position: 'absolute', bottom: 8, right: 8,
    width: 28, height: 28, borderRadius: Radius.full,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  formCard: {
    flex: 1,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.card,
  },
  label: { ...Typography.label, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 48,
  },
  input: { flex: 1, color: Colors.textPrimary, fontFamily: 'Poppins-Regular', fontSize: 14 },
  scanBarcodeBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    marginLeft: 4,
  },
  barcodeHint: {
    ...Typography.caption, color: Colors.textMuted, marginTop: 4, marginLeft: 2,
  },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 48,
  },
  dropdownText: { flex: 1, ...Typography.body, fontSize: 14, color: Colors.textPrimary },
  dropdownList: {
    backgroundColor: Colors.cardElevated, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  dropdownItemActive: { backgroundColor: Colors.goldOverlay },
  dropdownItemText: { ...Typography.body, flex: 1, fontSize: 14, color: Colors.textPrimary },
  catDot: { width: 12, height: 12, borderRadius: Radius.full },
  footer: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.gold, borderRadius: Radius.lg, paddingVertical: 16, ...Shadows.button,
  },
  saveBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-Bold', fontSize: 16 },
  aiTrigger: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gold,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md,
    marginTop: 12, gap: 6,
  },
  aiTriggerText: { color: Colors.textInverse, fontFamily: 'Poppins-Medium', fontSize: 12 },
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
  modalTitle: { ...Typography.heading4, color: Colors.textPrimary },
  modalOptions: { gap: Spacing.sm, marginBottom: Spacing.md },
  modalOptionBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  modalOptionBtnDestructive: { borderColor: Colors.errorBg },
  modalOptionIconBg: {
    width: 38, height: 38, borderRadius: Radius.md,
    backgroundColor: Colors.goldOverlay, alignItems: 'center', justifyContent: 'center',
  },
  modalOptionText: { ...Typography.bodyMedium, color: Colors.textPrimary, fontSize: 14 },
  modalCancelBtn: {
    backgroundColor: Colors.surface, paddingVertical: 14, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.xs,
  },
  modalCancelText: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.textMuted },
});
}

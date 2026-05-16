import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  addItem, updateItem, getItemById, generateItemCode, isItemCodeUnique,
} from '../src/db/itemsDB';
import { getAllCategories, Category } from '../src/db/categoriesDB';
import { Colors, Spacing, Radius, Typography, Shadows } from '../src/constants/theme';
import { generateAIImage } from '../src/services/aiService';
import { getSetting } from '../src/db/settingsDB';

export default function ItemFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [rate, setRate] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryDropdown, setCategoryDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [pendingAI, setPendingAI] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  const handleAIImage = async (isSilent = false) => {
    if (!itemName.trim()) {
      if (!isSilent) Alert.alert('AI Generator', 'Please enter an item name first.');
      return;
    }
    setPendingAI(true);
    setImageUri('https://via.placeholder.com/300?text=AI+Generating...'); // Temporary placeholder
    if (!isSilent) Alert.alert('AI Queued', 'Image will be generated in the background after you save.');
  };

  useEffect(() => {
    const cats = getAllCategories();
    setCategories(cats);
    setCurrencySymbol(getSetting('currency_symbol') || '₹');
    if (isEdit && id) {
      const item = getItemById(parseInt(id));
      if (item) {
        setItemCode(item.item_code);
        setItemName(item.item_name);
        setRate(item.rate.toString());
        setImageUri(item.image_uri);
        setCategoryId(item.category_id);
      }
    } else {
      setItemCode(generateItemCode());
    }
  }, [id]);

  const pickImage = async () => {
    Alert.alert('Select Image', 'Choose source', [
      {
        text: 'Camera', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission needed'); return; }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.7,
          });
          if (!result.canceled) setImageUri(result.assets[0].uri);
        },
      },
      {
        text: 'Gallery', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission needed'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.7,
          });
          if (!result.canceled) setImageUri(result.assets[0].uri);
        },
      },
      { text: 'Remove Image', onPress: () => setImageUri(null), style: 'destructive' },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!itemCode.trim()) { Alert.alert('Validation', 'Item code is required'); return; }
    if (!itemName.trim()) { Alert.alert('Validation', 'Item name is required'); return; }
    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum < 0) { Alert.alert('Validation', 'Enter a valid rate'); return; }

    const unique = isItemCodeUnique(itemCode.trim(), isEdit ? parseInt(id!) : undefined);
    if (!unique) { Alert.alert('Duplicate Code', 'This item code already exists'); return; }

    setSaving(true);
    try {
      let savedId = isEdit ? parseInt(id!) : 0;
      if (isEdit && id) {
        const item = getItemById(parseInt(id));
        updateItem(parseInt(id), itemCode, itemName, rateNum, categoryId, imageUri, item?.is_available ?? 1);
      } else {
        savedId = addItem(itemCode, itemName, rateNum, categoryId, imageUri);
      }

      // BACKGROUND AI GENERATION
      if (pendingAI) {
        const cat = categories.find(c => c.id === categoryId);
        const nameToUse = itemName;
        const catToUse = cat?.name || '';
        const finalId = savedId;
        const currentItem = getItemById(finalId);

        // Start background process without awaiting
        (async () => {
          try {
            console.log(`Background AI starting for Item ${finalId}...`);
            const url = await generateAIImage(nameToUse, catToUse);
            if (url) {
              updateItem(
                finalId,
                itemCode,
                nameToUse,
                rateNum,
                categoryId,
                url, // The new AI URL
                currentItem?.is_available ?? 1
              );
              console.log(`Background AI complete for Item ${finalId}`);
            }
          } catch (err) {
            console.error('Background AI failed:', err);
          }
        })();
      }

      router.back();
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
          {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Item' : 'New Item'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Image Picker */}
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
                <Text style={styles.imageHintSub}>(optional)</Text>
                
                <TouchableOpacity 
                  style={styles.aiTrigger} 
                  onPress={(e) => {
                    e.stopPropagation();
                    handleAIImage();
                  }}
                >
                  <MaterialCommunityIcons name="auto-fix" size={16} color={Colors.textInverse} />
                  <Text style={styles.aiTriggerText}>AI Generate</Text>
                </TouchableOpacity>
              </View>
            )}
            {imageUri && !isGeneratingAI && (
              <View style={styles.imageEditBadge}>
                <MaterialCommunityIcons name="pencil" size={14} color={Colors.white} />
              </View>
            )}
          </TouchableOpacity>

          {/* Form Fields */}
          <View style={styles.formCard}>
            {/* Item Code */}
            <Text style={styles.label}>Item Code *</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="barcode" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
              <TextInput style={styles.input} value={itemCode} onChangeText={setItemCode}
                placeholder="e.g. ITM0001" placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters" />
            </View>

            {/* Item Name */}
            <Text style={[styles.label, { marginTop: Spacing.lg }]}>Item Name *</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="food-variant" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
              <TextInput style={styles.input} value={itemName} onChangeText={setItemName}
                placeholder="e.g. Chicken Biryani" placeholderTextColor={Colors.textMuted} />
            </View>

            {/* Rate */}
            <Text style={[styles.label, { marginTop: Spacing.lg }]}>Rate ({currencySymbol}) *</Text>
            <View style={styles.inputRow}>
              <Text style={{ marginRight: 8, color: Colors.gold, fontFamily: 'Poppins-Bold' }}>{currencySymbol}</Text>
              <TextInput style={styles.input} value={rate} onChangeText={setRate}
                placeholder="0.00" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
            </View>

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
                {categories.map(cat => (
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

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave} disabled={saving} activeOpacity={0.88}>
            <MaterialCommunityIcons name={isEdit ? 'content-save' : 'plus-circle'} size={22} color={Colors.textInverse} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Item'}</Text>
          </TouchableOpacity>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrapper: { flex: 1, maxWidth: 800, width: '100%', alignSelf: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.heading3 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 20 },
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
});

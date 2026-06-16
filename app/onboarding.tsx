import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ScrollView, Animated, Dimensions, Modal,
  TouchableWithoutFeedback, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { getAllSettings, updateSettings, setSetting } from '../src/db/settingsDB';
import { Colors, applyTheme } from '../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LANGUAGES = [
  { key: 'enable_arabic',   label: 'Arabic',    nativeLabel: 'العربية',  flag: '🇸🇦' },
  { key: 'enable_malayalam',label: 'Malayalam', nativeLabel: 'മലയാളം',  flag: '🇮🇳' },
  { key: 'enable_tamil',    label: 'Tamil',     nativeLabel: 'தமிழ்',   flag: '🇮🇳' },
  { key: 'enable_hindi',    label: 'Hindi',     nativeLabel: 'हिन्दी',  flag: '🇮🇳' },
  { key: 'enable_kannada',  label: 'Kannada',   nativeLabel: 'ಕನ್ನಡ',   flag: '🇮🇳' },
];

const DARK_THEMES = [
  { label: 'Classic Gold', accent: '#D4A853', bg: '#0D0D0D' },
  { label: 'Midnight',     accent: '#60A5FA', bg: '#020617' },
  { label: 'Emerald',      accent: '#34D399', bg: '#0A1A11' },
  { label: 'Ruby',         accent: '#F87171', bg: '#1A0A0A' },
];

const LIGHT_THEMES = [
  { label: 'Ivory Gold',  accent: '#B8860B', bg: '#FDFAF4' },
  { label: 'Soft Blue',   accent: '#2563EB', bg: '#F0F6FF' },
  { label: 'Mint Green',  accent: '#059669', bg: '#F0FDF9' },
  { label: 'Blush Rose',  accent: '#DB2777', bg: '#FFF0F6' },
];

const STEP_COUNT = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoModalVisible, setLogoModalVisible] = useState(false);

  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  const [selectedTheme, setSelectedTheme] = useState<{ accent: string; bg: string } | null>(null);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
    scrollRef.current?.scrollTo({ x: step * SCREEN_WIDTH, animated: true });
  }, []);

  const saveStep1 = () => {
    if (companyName.trim() || companyPhone.trim() || companyAddress.trim()) {
      try {
        const current = getAllSettings();
        updateSettings({
          ...current,
          restaurant_name: companyName.trim() || current.restaurant_name,
          restaurant_phone: companyPhone.trim() || current.restaurant_phone,
          restaurant_address: companyAddress.trim() || current.restaurant_address,
        });
      } catch (e) {}
    }
  };

  const saveStep2 = async () => {
    if (logoUri) await AsyncStorage.setItem('printer_logo_uri', logoUri);
  };

  const saveStep3 = () => {
    if (selectedLanguage) {
      ['enable_arabic', 'enable_malayalam', 'enable_tamil', 'enable_hindi', 'enable_kannada'].forEach(k => {
        setSetting(k, k === selectedLanguage ? '1' : '0');
      });
    }
  };

  const saveStep4 = () => {
    if (selectedTheme) {
      setSetting('theme_primary', selectedTheme.accent);
      setSetting('theme_secondary', selectedTheme.bg);
      applyTheme(selectedTheme.accent, selectedTheme.bg);
    }
  };

  const handleNext = async () => {
    if (currentStep === 0) saveStep1();
    if (currentStep === 1) await saveStep2();
    if (currentStep === 2) saveStep3();
    if (currentStep === 3) { saveStep4(); await finish(); return; }
    goToStep(currentStep + 1);
  };

  const handleSkip = async () => {
    if (currentStep === STEP_COUNT - 1) { await finish(); return; }
    goToStep(currentStep + 1);
  };

  const finish = async () => {
    await AsyncStorage.setItem('onboarding_complete', 'true');
    router.replace('/(tabs)');
  };

  const pickFromGallery = async () => {
    setLogoModalVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow gallery access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setLogoUri(result.assets[0].uri);
  };

  const pickFromCamera = async () => {
    setLogoModalVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow camera access.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setLogoUri(result.assets[0].uri);
  };

  const stepTitles    = ['Company Setup', 'Brand Logo', 'Language', 'App Theme'];
  const stepIcons     = ['store-outline', 'image-outline', 'translate', 'palette-outline'] as const;
  const stepSubtitles = ['Tell us about your business', 'Add your receipt logo', 'Choose a secondary language', 'Personalise your app look'];
  const nextLabels    = ['Next', 'Next', 'Next', 'Get Started'];

  const renderThemeCard = (preset: { label: string; accent: string; bg: string }, idx: number, isLight: boolean) => {
    const isSelected = selectedTheme?.accent === preset.accent && selectedTheme?.bg === preset.bg;
    return (
      <TouchableOpacity
        id={`theme-${isLight ? 'light' : 'dark'}-${idx}`}
        key={preset.label}
        style={[styles.themeCard, isLight && styles.themeCardLight, isSelected && styles.themeCardActive]}
        onPress={() => setSelectedTheme(isSelected ? null : preset)}
        activeOpacity={0.8}
      >
        <View style={[styles.themePreviewBox, { backgroundColor: preset.bg }, isLight && styles.themePreviewBoxLight]}>
          <View style={[styles.themePreviewBar, { backgroundColor: preset.accent }]} />
          <View style={styles.themePreviewLines}>
            <View style={[styles.themePreviewLine, { backgroundColor: preset.accent + '60', width: '70%' }]} />
            <View style={[styles.themePreviewLine, { backgroundColor: preset.accent + '30', width: '50%' }]} />
          </View>
          <View style={[styles.themePreviewBtn, { backgroundColor: preset.accent }]} />
        </View>
        <Text style={[styles.themeLabel, isLight && styles.themeLabelLight, isSelected && styles.themeLabelActive]}>
          {preset.label}
        </Text>
        {isSelected && (
          <View style={styles.themeCheckBadge}>
            <MaterialCommunityIcons name="check" size={12} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {currentStep > 0 && (
            <TouchableOpacity id="onboarding-back-btn" onPress={() => goToStep(currentStep - 1)} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#F5F5F5" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.stepsIndicator}>
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <View key={i} style={[styles.stepDot, i === currentStep && styles.stepDotActive, i < currentStep && styles.stepDotDone]} />
          ))}
        </View>
        <TouchableOpacity id="onboarding-skip-btn" onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* ── Step icon + title ── */}
      <View style={styles.stepHeader}>
        <LinearGradient colors={['#D4A85333', '#D4A85310']} style={styles.stepIconBg}>
          <MaterialCommunityIcons name={stepIcons[currentStep]} size={32} color="#D4A853" />
        </LinearGradient>
        <Text style={styles.stepCount}>Step {currentStep + 1} of {STEP_COUNT}</Text>
        <Text style={styles.stepTitle}>{stepTitles[currentStep]}</Text>
        <Text style={styles.stepSubtitle}>{stepSubtitles[currentStep]}</Text>
      </View>

      {/* ── Content ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >

          {/* ═══ Step 1: Company ═══ */}
          <ScrollView style={styles.stepPage} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Restaurant Name</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={18} color="#D4A853" style={styles.inputIcon} />
                <TextInput id="company-name-input" style={styles.textInput} value={companyName} onChangeText={setCompanyName} placeholder="e.g. The Golden Fork" placeholderTextColor="#6A6A6A" returnKeyType="next" />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="phone-outline" size={18} color="#D4A853" style={styles.inputIcon} />
                <TextInput id="company-phone-input" style={styles.textInput} value={companyPhone} onChangeText={setCompanyPhone} placeholder="e.g. +91 9876543210" placeholderTextColor="#6A6A6A" keyboardType="phone-pad" returnKeyType="next" />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address</Text>
              <View style={[styles.inputWrapper, styles.inputWrapperMulti]}>
                <MaterialCommunityIcons name="map-marker-outline" size={18} color="#D4A853" style={[styles.inputIcon, { alignSelf: 'flex-start', marginTop: 14 }]} />
                <TextInput id="company-address-input" style={[styles.textInput, styles.textInputMulti]} value={companyAddress} onChangeText={setCompanyAddress} placeholder="Full restaurant address" placeholderTextColor="#6A6A6A" multiline numberOfLines={3} textAlignVertical="top" />
              </View>
            </View>
            <View style={styles.hintCard}>
              <MaterialCommunityIcons name="information-outline" size={16} color="#D4A853" />
              <Text style={styles.hintText}>This information will appear on your printed receipts. You can update it anytime from Settings.</Text>
            </View>
          </ScrollView>

          {/* ═══ Step 2: Logo ═══ */}
          <ScrollView style={styles.stepPage} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
            <TouchableOpacity id="logo-picker-btn" style={[styles.logoPicker, logoUri && styles.logoPickerFilled]} onPress={() => setLogoModalVisible(true)} activeOpacity={0.8}>
              {logoUri ? (
                <>
                  <Image source={{ uri: logoUri }} style={styles.logoPreview} resizeMode="contain" />
                  <View style={styles.logoEditBadge}>
                    <MaterialCommunityIcons name="pencil" size={14} color="#fff" />
                    <Text style={styles.logoEditText}>Change</Text>
                  </View>
                </>
              ) : (
                <View style={styles.logoPlaceholder}>
                  <LinearGradient colors={['#D4A85333', '#D4A85310']} style={styles.logoPlaceholderIconBg}>
                    <MaterialCommunityIcons name="image-plus" size={40} color="#D4A853" />
                  </LinearGradient>
                  <Text style={styles.logoPlaceholderTitle}>Tap to Add Logo</Text>
                  <Text style={styles.logoPlaceholderSub}>Appears at the top of every receipt</Text>
                </View>
              )}
            </TouchableOpacity>
            {logoUri && (
              <TouchableOpacity id="remove-logo-btn" style={styles.removeLogoBtn} onPress={() => setLogoUri(null)}>
                <MaterialCommunityIcons name="delete-outline" size={16} color="#EF4444" />
                <Text style={styles.removeLogoText}>Remove Logo</Text>
              </TouchableOpacity>
            )}
            <View style={styles.hintCard}>
              <MaterialCommunityIcons name="information-outline" size={16} color="#D4A853" />
              <Text style={styles.hintText}>Recommended: Square image (PNG with transparent background) for best results on thermal prints.</Text>
            </View>
          </ScrollView>

          {/* ═══ Step 3: Language ═══ */}
          <ScrollView style={styles.stepPage} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>

            {/* English — always ticked default */}
            <View style={[styles.optionCard, styles.optionCardDefault]}>
              <View style={[styles.optionIconBg, styles.optionIconBgDefault]}>
                <Text style={styles.optionFlag}>🇬🇧</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.optionLabel, styles.optionLabelActive]}>English</Text>
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                  </View>
                </View>
                <Text style={styles.optionNative}>Always enabled</Text>
              </View>
              <View style={styles.tickCircle}>
                <MaterialCommunityIcons name="check" size={14} color="#0D0D0D" />
              </View>
            </View>

            {/* Secondary languages */}
            {LANGUAGES.map(lang => {
              const isSelected = selectedLanguage === lang.key;
              return (
                <TouchableOpacity
                  id={`lang-${lang.key}`}
                  key={lang.key}
                  style={[styles.optionCard, isSelected && styles.optionCardActive]}
                  onPress={() => setSelectedLanguage(isSelected ? null : lang.key)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.optionIconBg, isSelected && styles.optionIconBgActive]}>
                    <Text style={styles.optionFlag}>{lang.flag}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelActive]}>{lang.label}</Text>
                    <Text style={styles.optionNative}>{lang.nativeLabel}</Text>
                  </View>
                  {isSelected ? (
                    <View style={styles.tickCircle}>
                      <MaterialCommunityIcons name="check" size={14} color="#0D0D0D" />
                    </View>
                  ) : (
                    <View style={styles.optionRadio} />
                  )}
                </TouchableOpacity>
              );
            })}

            <View style={styles.hintCard}>
              <MaterialCommunityIcons name="information-outline" size={16} color="#D4A853" />
              <Text style={styles.hintText}>English is always active. Selecting another language adds a second language to your menu display.</Text>
            </View>
          </ScrollView>

          {/* ═══ Step 4: Theme ═══ */}
          <ScrollView style={styles.stepPage} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.themeSectionLabel}>🌙 Dark Mode</Text>
            <View style={styles.themeGrid}>
              {DARK_THEMES.map((preset, i) => renderThemeCard(preset, i, false))}
            </View>

            <Text style={styles.themeSectionLabel}>☀️ Light Mode</Text>
            <View style={styles.themeGrid}>
              {LIGHT_THEMES.map((preset, i) => renderThemeCard(preset, i, true))}
            </View>

            <View style={styles.hintCard}>
              <MaterialCommunityIcons name="information-outline" size={16} color="#D4A853" />
              <Text style={styles.hintText}>Choose the look that feels right. You can customise colors further anytime from Settings → Theme.</Text>
            </View>
          </ScrollView>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Bottom nav ── */}
      <View style={styles.bottomNav}>
        <TouchableOpacity id="onboarding-next-btn" style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <LinearGradient colors={['#D4A853', '#D4A853CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtnGradient}>
            <Text style={styles.nextBtnText}>{nextLabels[currentStep]}</Text>
            <MaterialCommunityIcons name={currentStep === STEP_COUNT - 1 ? 'rocket-launch-outline' : 'arrow-right'} size={20} color="#0D0D0D" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Logo modal ── */}
      <Modal visible={logoModalVisible} transparent animationType="slide" onRequestClose={() => setLogoModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setLogoModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Add Your Logo</Text>
                <TouchableOpacity id="logo-camera-btn" style={styles.modalOption} onPress={pickFromCamera} activeOpacity={0.75}>
                  <View style={styles.modalOptionIcon}>
                    <MaterialCommunityIcons name="camera-outline" size={22} color="#D4A853" />
                  </View>
                  <Text style={styles.modalOptionText}>Take Photo</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#6A6A6A" />
                </TouchableOpacity>
                <TouchableOpacity id="logo-gallery-btn" style={styles.modalOption} onPress={pickFromGallery} activeOpacity={0.75}>
                  <View style={styles.modalOptionIcon}>
                    <MaterialCommunityIcons name="image-outline" size={22} color="#D4A853" />
                  </View>
                  <Text style={styles.modalOptionText}>Choose from Gallery</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#6A6A6A" />
                </TouchableOpacity>
                <TouchableOpacity id="logo-modal-cancel" style={styles.modalCancel} onPress={() => setLogoModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerLeft: { width: 40 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2E2E2E' },
  stepsIndicator: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2E2E2E' },
  stepDotActive: { width: 22, height: 6, borderRadius: 3, backgroundColor: '#D4A853' },
  stepDotDone: { backgroundColor: '#D4A85360' },
  skipBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  skipText: { color: '#6A6A6A', fontFamily: 'Poppins-Medium', fontSize: 13 },

  // Step header
  stepHeader: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20, paddingTop: 4 },
  stepIconBg: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#D4A85330' },
  stepCount: { fontFamily: 'Poppins-Medium', fontSize: 11, color: '#D4A853', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  stepTitle: { fontFamily: 'Poppins-Bold', fontSize: 24, color: '#F5F5F5', textAlign: 'center', marginBottom: 6 },
  stepSubtitle: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#6A6A6A', textAlign: 'center' },

  // Step pages
  stepPage: { width: SCREEN_WIDTH },
  stepContent: { paddingHorizontal: 20, paddingBottom: 24 },

  // Inputs
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#B0B0B0', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#2E2E2E', paddingHorizontal: 14, height: 52 },
  inputWrapperMulti: { height: 90, alignItems: 'flex-start', paddingVertical: 0 },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 14, color: '#F5F5F5' },
  textInputMulti: { paddingVertical: 14, height: 90 },

  // Logo
  logoPicker: { backgroundColor: '#1A1A1A', borderRadius: 16, borderWidth: 1.5, borderColor: '#2E2E2E', borderStyle: 'dashed', height: 200, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 },
  logoPickerFilled: { borderStyle: 'solid', borderColor: '#D4A85350', height: 220 },
  logoPreview: { width: '85%', height: '85%' },
  logoEditBadge: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  logoEditText: { fontFamily: 'Poppins-Medium', fontSize: 11, color: '#fff' },
  logoPlaceholder: { alignItems: 'center', gap: 10 },
  logoPlaceholderIconBg: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  logoPlaceholderTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: '#F5F5F5' },
  logoPlaceholderSub: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#6A6A6A' },
  removeLogoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#EF444440', marginBottom: 12 },
  removeLogoText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: '#EF4444' },

  // Language
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, borderColor: '#2E2E2E', padding: 14, marginBottom: 10, gap: 14 },
  optionCardActive: { borderColor: '#D4A853', backgroundColor: '#D4A85310' },
  optionCardDefault: { borderColor: '#D4A85550', backgroundColor: '#D4A85308' },
  optionIconBg: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#242424', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2E2E2E' },
  optionIconBgActive: { borderColor: '#D4A85340', backgroundColor: '#D4A85315' },
  optionIconBgDefault: { borderColor: '#D4A85550', backgroundColor: '#D4A85515' },
  optionFlag: { fontSize: 24 },
  optionLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#F5F5F5' },
  optionLabelActive: { color: '#D4A853' },
  optionNative: { fontFamily: 'Poppins-Regular', fontSize: 13, color: '#6A6A6A', marginTop: 2 },
  optionRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#2E2E2E' },
  tickCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#D4A853', alignItems: 'center', justifyContent: 'center' },
  defaultBadge: { backgroundColor: '#D4A85325', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#D4A85340' },
  defaultBadgeText: { fontFamily: 'Poppins-Bold', fontSize: 9, color: '#D4A853', letterSpacing: 0.5 },

  // Theme
  themeSectionLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#6A6A6A', marginBottom: 10, marginTop: 4, letterSpacing: 0.3 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  themeCard: { width: (SCREEN_WIDTH - 52) / 2, backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, borderColor: '#2E2E2E', padding: 12, gap: 10, position: 'relative' },
  themeCardLight: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  themeCardActive: { borderColor: '#D4A853', borderWidth: 2 },
  themePreviewBox: { height: 80, borderRadius: 10, overflow: 'hidden', padding: 8 },
  themePreviewBoxLight: { borderWidth: 1, borderColor: '#E5E7EB' },
  themePreviewBar: { height: 18, borderRadius: 5, marginBottom: 8 },
  themePreviewLines: { gap: 4, marginBottom: 8 },
  themePreviewLine: { height: 6, borderRadius: 3 },
  themePreviewBtn: { height: 14, width: '60%', borderRadius: 7, alignSelf: 'center' },
  themeLabel: { fontFamily: 'Poppins-Medium', fontSize: 13, color: '#B0B0B0', textAlign: 'center' },
  themeLabelLight: { color: '#374151' },
  themeLabelActive: { color: '#D4A853' },
  themeCheckBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#D4A853', alignItems: 'center', justifyContent: 'center' },

  // Hint
  hintCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#D4A85312', borderRadius: 12, borderWidth: 1, borderColor: '#D4A85330', padding: 12, marginTop: 4 },
  hintText: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 12, color: '#B0B0B0', lineHeight: 18 },

  // Bottom nav
  bottomNav: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  nextBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#D4A853', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  nextBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  nextBtnText: { fontFamily: 'Poppins-Bold', fontSize: 16, color: '#0D0D0D' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: '#2E2E2E' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: '#F5F5F5', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#242424', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2E2E2E' },
  modalOptionIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#D4A85320', alignItems: 'center', justifyContent: 'center' },
  modalOptionText: { flex: 1, fontFamily: 'Poppins-Medium', fontSize: 14, color: '#F5F5F5' },
  modalCancel: { backgroundColor: '#242424', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4, borderWidth: 1, borderColor: '#2E2E2E' },
  modalCancelText: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#6A6A6A' },
});

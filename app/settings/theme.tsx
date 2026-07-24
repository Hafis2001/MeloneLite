import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, KeyboardAvoidingView, TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSetting, setSetting } from '../../src/db/settingsDB';
import { Colors, Spacing, Radius, Typography, Shadows, applyTheme } from '../../src/constants/theme';
import { ThemeContext } from '../../src/context/ThemeContext';
import ColorPicker, { Panel1, HueSlider } from 'reanimated-color-picker';
import { runOnJS } from 'react-native-reanimated';



export default function ThemeSettingsScreen() {
  const { refreshTheme, themeVersion } = useContext(ThemeContext);
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const router = useRouter();
  
  const [accentColor, setAccentColor] = useState('#D4A853');
  const [backgroundColor, setBackgroundColor] = useState('#0D0D0D');

  const [isBgPickerOpen, setIsBgPickerOpen] = useState(false);
  const [isAccentPickerOpen, setIsAccentPickerOpen] = useState(false);

  useEffect(() => {
    const p = getSetting('theme_primary') || '#D4A853';
    let s = getSetting('theme_secondary') || '#0D0D0D';
    if (s === 'default') s = '#0D0D0D';
    if (s === 'midnight') s = '#020617';
    if (s === 'forest') s = '#052e16';
    if (s === 'maroon') s = '#4c0519';

    setAccentColor(p);
    setBackgroundColor(s);
  }, []);

  const onBgColorComplete = ({ hex }: { hex: string }) => {
    'worklet';
    runOnJS(setBackgroundColor)(hex);
  };

  const onAccentColorComplete = ({ hex }: { hex: string }) => {
    'worklet';
    runOnJS(setAccentColor)(hex);
  };

  const handleSave = async () => {
    let finalAccent = accentColor;
    let finalBg = backgroundColor;
    if (!finalAccent.startsWith('#')) finalAccent = '#' + finalAccent;
    if (!finalBg.startsWith('#')) finalBg = '#' + finalBg;

    // Save to database
    setSetting('theme_primary', finalAccent);
    setSetting('theme_secondary', finalBg);

    // Apply immediately — mutates Colors object and triggers root re-render
    applyTheme(finalAccent, finalBg);
    refreshTheme();

    // Navigate back — theme is already live
    if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)'); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { if(router.canGoBack()) router.back(); else router.replace('/(tabs)'); }} style={{ marginRight: 16 }}>
              <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>App Theme</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* Background Color */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.dropdownHeader}
                onPress={() => setIsBgPickerOpen(!isBgPickerOpen)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.colorCircle, { backgroundColor, marginRight: 12 }]} />
                  <View>
                    <Text style={styles.sectionTitle}>Primary Color (Background)</Text>
                    <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Tap to change</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name={isBgPickerOpen ? 'chevron-up' : 'chevron-down'} size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              
              {isBgPickerOpen && (
                <View style={styles.dropdownContent}>
                  <ColorPicker
                    style={{ width: '100%', padding: Spacing.sm }}
                    value={backgroundColor}
                    onComplete={onBgColorComplete}
                  >
                    <Panel1 style={{ height: 180, borderRadius: Radius.md, marginBottom: Spacing.md }} />
                    <HueSlider style={{ borderRadius: Radius.full, marginBottom: Spacing.sm }} />
                  </ColorPicker>

                  <View style={styles.inputRow}>
                    <Text style={styles.hexSymbol}>#</Text>
                    <TextInput
                      style={styles.hexInput}
                      value={backgroundColor.replace('#', '')}
                      onChangeText={(t) => setBackgroundColor('#' + t)}
                      placeholder="Custom Hex (e.g. FFFFFF)"
                      placeholderTextColor={Colors.textMuted}
                      maxLength={6}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Accent Color */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.dropdownHeader}
                onPress={() => setIsAccentPickerOpen(!isAccentPickerOpen)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.colorCircle, { backgroundColor: accentColor, marginRight: 12 }]} />
                  <View>
                    <Text style={styles.sectionTitle}>Secondary Color (Accent)</Text>
                    <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Tap to change</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name={isAccentPickerOpen ? 'chevron-up' : 'chevron-down'} size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              
              {isAccentPickerOpen && (
                <View style={styles.dropdownContent}>
                  <ColorPicker
                    style={{ width: '100%', padding: Spacing.sm }}
                    value={accentColor}
                    onComplete={onAccentColorComplete}
                  >
                    <Panel1 style={{ height: 180, borderRadius: Radius.md, marginBottom: Spacing.md }} />
                    <HueSlider style={{ borderRadius: Radius.full, marginBottom: Spacing.sm }} />
                  </ColorPicker>

                  <View style={styles.inputRow}>
                    <Text style={styles.hexSymbol}>#</Text>
                    <TextInput
                      style={styles.hexInput}
                      value={accentColor.replace('#', '')}
                      onChangeText={(t) => setAccentColor('#' + t)}
                      placeholder="Custom Hex (e.g. D4A853)"
                      placeholderTextColor={Colors.textMuted}
                      maxLength={6}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Live Preview */}
            <View style={[styles.section, { backgroundColor, borderColor: backgroundColor }]}>
              <Text style={[styles.sectionTitle, { color: accentColor }]}>Live Preview</Text>
              <Text style={[styles.fieldLabel, { color: accentColor }]}>This is how your selected colors will look.</Text>
              
              <TouchableOpacity style={[styles.previewBtn, { backgroundColor: accentColor }]}>
                <Text style={{ color: accentColor.toUpperCase() === '#FFFFFF' ? '#000' : '#FFF', fontFamily: 'Poppins-Bold' }}>
                  Sample Button
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accentColor }]} onPress={handleSave}>
              <MaterialCommunityIcons name="check-circle" size={20} color={accentColor.toUpperCase() === '#FFFFFF' ? '#000' : '#FFF'} />
              <Text style={[styles.saveBtnText, { color: accentColor.toUpperCase() === '#FFFFFF' ? '#000' : '#FFF' }]}>Apply Theme</Text>
            </TouchableOpacity>

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
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { ...Typography.heading2 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadows.card,
  },
  dropdownHeader: {
    padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownContent: {
    padding: Spacing.lg,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.sm,
  },
  sectionTitle: { ...Typography.heading4, color: Colors.textPrimary, marginBottom: 4 },
  fieldLabel: { ...Typography.caption, marginBottom: Spacing.lg, color: Colors.textMuted },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  colorItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    padding: Spacing.sm, paddingRight: Spacing.md, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  colorItemActive: {
    backgroundColor: Colors.surface,
  },
  colorCircle: {
    width: 24, height: 24, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)'
  },
  colorName: { ...Typography.bodyMedium, fontSize: 13 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 48, marginTop: Spacing.lg,
  },
  hexSymbol: { ...Typography.bodyMedium, color: Colors.textMuted, marginRight: 8 },
  hexInput: { flex: 1, color: Colors.textPrimary, fontFamily: 'Poppins-Regular', fontSize: 14 },
  previewBtn: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.lg, paddingVertical: Spacing.md, ...Shadows.button,
    marginTop: Spacing.sm,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Radius.lg, paddingVertical: Spacing.lg, ...Shadows.button,
    marginTop: Spacing.xs,
  },
  saveBtnText: { fontFamily: 'Poppins-Bold', fontSize: 16 },
  });
}

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, useWindowDimensions, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSetting, setSetting } from '../../src/db/settingsDB';
import { getAllItems, updateItem } from '../../src/db/itemsDB';
import { ThemeContext } from '../../src/context/ThemeContext';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';
import { useThemeVersion } from '../../src/context/ThemeContext';

const LANGUAGES = [
  {
    key: 'enable_arabic',
    label: 'Arabic',
    nativeLabel: 'العربية',
    flag: '🇸🇦',
    description: 'Phonetic transliteration from English to Arabic script. Item names are auto-translated when added.',
    direction: 'rtl' as const,
  },
  {
    key: 'enable_malayalam',
    label: 'Malayalam',
    nativeLabel: 'മലയാളം',
    flag: '🇮🇳',
    description: 'Phonetic transliteration from English to Malayalam script. Item names are auto-translated when added.',
    direction: 'ltr' as const,
  },
  {
    key: 'enable_tamil',
    label: 'Tamil',
    nativeLabel: 'தமிழ்',
    flag: '🇮🇳',
    description: 'Phonetic transliteration from English to Tamil script. Item names are auto-translated when added.',
    direction: 'ltr' as const,
  },
  {
    key: 'enable_hindi',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
    flag: '🇮🇳',
    description: 'Phonetic transliteration from English to Hindi script. Item names are auto-translated when added.',
    direction: 'ltr' as const,
  },
  {
    key: 'enable_kannada',
    label: 'Kannada',
    nativeLabel: 'ಕನ್ನಡ',
    flag: '🇮🇳',
    description: 'Phonetic transliteration from English to Kannada script. Item names are auto-translated when added.',
    direction: 'ltr' as const,
  },
];

export default function LanguageSettingsScreen() {
  const themeVersion = useThemeVersion();
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { refreshTheme } = React.useContext(ThemeContext);

  const [langStates, setLangStates] = useState<Record<string, boolean>>({
    enable_arabic: false,
    enable_malayalam: false,
    enable_tamil: false,
    enable_hindi: false,
    enable_kannada: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [totalSync, setTotalSync] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const newState: Record<string, boolean> = {};
      LANGUAGES.forEach(lang => {
        newState[lang.key] = getSetting(lang.key) === '1';
      });
      setLangStates(newState);
    }, [])
  );

  const toggleLanguage = async (key: string, value: boolean) => {
    // Only allow one language to be true at a time
    if (value) {
      setSetting('enable_arabic', key === 'enable_arabic' ? '1' : '0');
      setSetting('enable_malayalam', key === 'enable_malayalam' ? '1' : '0');
      setSetting('enable_tamil', key === 'enable_tamil' ? '1' : '0');
      setSetting('enable_hindi', key === 'enable_hindi' ? '1' : '0');
      setSetting('enable_kannada', key === 'enable_kannada' ? '1' : '0');
      setLangStates({
        enable_arabic: key === 'enable_arabic',
        enable_malayalam: key === 'enable_malayalam',
        enable_tamil: key === 'enable_tamil',
        enable_hindi: key === 'enable_hindi',
        enable_kannada: key === 'enable_kannada',
      });
    } else {
      setSetting(key, '0');
      setLangStates(prev => ({ ...prev, [key]: false }));
    }
    // Force global app re-render to apply language changes
    refreshTheme();
  };

  const handleSyncTranslations = async () => {
    const items = getAllItems();
    const itemsToUpdate = items.filter(item => !item.item_name_ar || !item.item_name_ml || !item.item_name_ta || !item.item_name_hi || !item.item_name_kn);
    
    if (itemsToUpdate.length === 0) {
      Alert.alert('All Up To Date', 'All your items already have translations for all languages.');
      return;
    }

    Alert.alert(
      'Sync Translations',
      `Found ${itemsToUpdate.length} items missing translations. This will auto-translate them using Google Translate. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sync Now', 
          onPress: async () => {
            setIsSyncing(true);
            setTotalSync(itemsToUpdate.length);
            let synced = 0;

            for (const item of itemsToUpdate) {
              let ar = item.item_name_ar;
              let ml = item.item_name_ml;
              let ta = item.item_name_ta;
              let hi = item.item_name_hi;
              let kn = item.item_name_kn;
              const name = item.item_name;

              try {
                if (!ar) {
                  const res = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(name)}&itc=ar-t-i0-und&num=1`);
                  const data = await res.json();
                  if (data[0] === 'SUCCESS' && Array.isArray(data[1])) {
                    ar = data[1].map((chunk: any) => chunk[1][0]).join('');
                  }
                }
                if (!ml) {
                  const res = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(name)}&itc=ml-t-i0-und&num=1`);
                  const data = await res.json();
                  if (data[0] === 'SUCCESS' && Array.isArray(data[1])) {
                    ml = data[1].map((chunk: any) => chunk[1][0]).join('');
                  }
                }
                if (!ta) {
                  const res = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(name)}&itc=ta-t-i0-und&num=1`);
                  const data = await res.json();
                  if (data[0] === 'SUCCESS' && Array.isArray(data[1])) {
                    ta = data[1].map((chunk: any) => chunk[1][0]).join('');
                  }
                }
                if (!hi) {
                  const res = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(name)}&itc=hi-t-i0-und&num=1`);
                  const data = await res.json();
                  if (data[0] === 'SUCCESS' && Array.isArray(data[1])) {
                    hi = data[1].map((chunk: any) => chunk[1][0]).join('');
                  }
                }
                if (!kn) {
                  const res = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(name)}&itc=kn-t-i0-und&num=1`);
                  const data = await res.json();
                  if (data[0] === 'SUCCESS' && Array.isArray(data[1])) {
                    kn = data[1].map((chunk: any) => chunk[1][0]).join('');
                  }
                }
                
                updateItem(item.id, item.item_code, item.item_name, ar || null, ml || null, ta || null, hi || null, kn || null, item.rate, item.category_id, item.image_uri, item.is_available, item.barcode || null);
              } catch (e) {
                console.log('Failed to sync item:', name);
              }

              synced++;
              setSyncProgress(synced);
            }

            setIsSyncing(false);
            Alert.alert('Sync Complete', `Successfully generated translations for ${synced} items.`);
          }
        }
      ]
    );
  };

  const enabledCount = Object.values(langStates).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.contentWrapper}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { if(router.canGoBack()) router.back(); else router.replace('/(tabs)'); }} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Language</Text>
              <Text style={styles.headerSub}>
                {enabledCount === 0 ? 'No secondary language enabled' : `${enabledCount} language${enabledCount > 1 ? 's' : ''} enabled`}
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, isLandscape && styles.scrollContentLandscape]}
            showsVerticalScrollIndicator={false}
          >
            {/* Info card */}
            <View style={styles.infoCard}>
              <MaterialCommunityIcons name="information-outline" size={18} color={Colors.gold} />
              <Text style={styles.infoText}>
                When enabled, item names are automatically transliterated into the selected language as you type. Requires a brief internet connection.
              </Text>
            </View>

            {/* Language list */}
            {LANGUAGES.map((lang, index) => {
              const isEnabled = langStates[lang.key] ?? false;
              return (
                <View key={lang.key} style={[styles.langCard, isEnabled && styles.langCardActive]}>
                  {/* Top row */}
                  <View style={styles.langRow}>
                    <View style={styles.flagBg}>
                      <Text style={styles.flagText}>{lang.flag}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.langLabel}>{lang.label}</Text>
                        <Text style={styles.langNative}>{lang.nativeLabel}</Text>
                        {isEnabled && (
                          <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>ON</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.langDesc}>{lang.description}</Text>
                    </View>
                    <Switch
                      value={isEnabled}
                      onValueChange={(val) => toggleLanguage(lang.key, val)}
                      trackColor={{ false: Colors.surface, true: Colors.goldOverlay }}
                      thumbColor={isEnabled ? Colors.gold : Colors.textMuted}
                    />
                  </View>

                  {/* Preview when enabled */}
                  {isEnabled && (
                    <View style={styles.previewRow}>
                      <MaterialCommunityIcons name="eye-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.previewLabel}>Example: </Text>
                      <Text style={[styles.previewText, { writingDirection: lang.direction }]}>
                        {lang.key === 'enable_arabic' ? 'بُرجر - برياني دجاج' : lang.key === 'enable_malayalam' ? 'ബർഗർ - ചിക്കൻ ബിരിയാണി' : lang.key === 'enable_tamil' ? 'பர்கர் - சிக்கன் பிரியாணி' : lang.key === 'enable_hindi' ? 'बर्गर - चिकन बिरयानी' : 'ಬರ್ಗರ್ - ಚಿಕನ್ ಬಿರಿಯಾನಿ'}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            <TouchableOpacity 
              style={[styles.syncBtn, isSyncing && { opacity: 0.7 }]} 
              onPress={handleSyncTranslations}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <Text style={styles.syncBtnText}>Syncing... ({syncProgress}/{totalSync})</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="sync" size={20} color={Colors.textInverse} />
                  <Text style={styles.syncBtnText}>Sync Missing Translations</Text>
                </>
              )}
            </TouchableOpacity>

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
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.heading3, color: Colors.textPrimary },
  headerSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl },
  scrollContentLandscape: { paddingHorizontal: Spacing.xxl },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.goldOverlay, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.gold + '40',
  },
  infoText: { ...Typography.caption, color: Colors.textPrimary, flex: 1, lineHeight: 18 },

  langCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.card,
  },
  langCardActive: {
    borderColor: Colors.gold + '60',
    backgroundColor: Colors.card,
  },
  langRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  flagBg: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  flagText: { fontSize: 26 },
  langLabel: { ...Typography.bodyMedium, color: Colors.textPrimary, fontSize: 15 },
  langNative: { ...Typography.body, color: Colors.textMuted, fontSize: 14 },
  activeBadge: {
    backgroundColor: Colors.goldOverlay, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.gold,
  },
  activeBadgeText: { color: Colors.gold, fontFamily: 'Poppins-Bold', fontSize: 10 },
  langDesc: { ...Typography.caption, color: Colors.textMuted, marginTop: 4, lineHeight: 18, paddingRight: 8 },

  previewRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md,
    paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  previewLabel: { ...Typography.caption, color: Colors.textMuted, marginLeft: 6 },
  previewText: { ...Typography.bodyMedium, color: Colors.gold, flex: 1, marginLeft: 4 },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.gold, borderRadius: Radius.lg, paddingVertical: Spacing.lg,
    marginTop: Spacing.xs, ...Shadows.button,
  },
  syncBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-Bold', fontSize: 15 },
});
}

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Image, ActivityIndicator, FlatList, Modal,
  Dimensions, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  addItem, updateItem as dbUpdateItem,
  generateItemCode, getItemById,
} from '../src/db/itemsDB';
import { getAllCategories, addCategory } from '../src/db/categoriesDB';
import { generateAIImage } from '../src/services/aiService';
import { Colors, Spacing, Radius, Typography, Shadows } from '../src/constants/theme';

type Step = 'capture' | 'processing' | 'review' | 'importing';

interface Page { id: string; uri: string; base64: string; }
interface ScannedItem {
  id: string; name: string; price: string;
  description: string; category: string; removed: boolean;
}

// A palette of distinct colors for auto-created categories
const CAT_COLORS = [
  '#D4A853','#E07B5A','#5A9BD4','#6DBF82','#B45AE0',
  '#E0B45A','#5AE0D4','#E05A9B','#9BE05A','#5A6BE0',
];

const uid = () => Math.random().toString(36).slice(2, 10);
const { width: SW } = Dimensions.get('window');

export default function MenuScannerScreen() {
  const [step, setStep] = useState<Step>('capture');
  const [pages, setPages] = useState<Page[]>([]);
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [processingMsg, setProcessingMsg] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // ── Capture ──────────────────────────────────────────────────────────
  const addFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera permission required.'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.4, allowsEditing: false, base64: true });
    if (!res.canceled && res.assets[0].base64) {
      setPages(p => [...p, { id: uid(), uri: res.assets[0].uri, base64: res.assets[0].base64! }]);
    }
  };

  const addFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Gallery permission required.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true, quality: 0.4, base64: true,
    });
    if (!res.canceled) {
      const newPages: Page[] = res.assets
        .filter(a => a.base64)
        .map(a => ({ id: uid(), uri: a.uri, base64: a.base64! }));
      setPages(p => [...p, ...newPages]);
    }
  };

  // ── Step 1: OCR via OCR.Space (free, no account needed) ─────────────────
  const ocrImage = async (base64: string): Promise<string> => {
    const form = new FormData();
    form.append('base64Image', `data:image/jpeg;base64,${base64}`);
    form.append('apikey', 'helloworld'); // OCR.Space free demo key
    form.append('language', 'eng');
    form.append('isOverlayRequired', 'false');
    form.append('detectOrientation', 'true');
    form.append('scale', 'true');
    form.append('OCREngine', '2'); // Engine 2 is better for printed/menu text
    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(`OCR HTTP ${res.status}`);
    const data = await res.json();
    if (data.IsErroredOnProcessing) throw new Error(data.ErrorMessage?.[0] || 'OCR failed');
    const text = data.ParsedResults?.[0]?.ParsedText || '';
    console.log('OCR result:', text.slice(0, 300));
    return text;
  };

  // ── Step 2: Parse OCR text into structured items via Pollinations ───────────
  const parseMenuText = async (text: string): Promise<ScannedItem[]> => {
    const prompt = `You are a restaurant menu parser. From this OCR-scanned menu text, extract all food and drink items.
Crucial Task: Identify the section headings (e.g., "Main Course", "Starters", "Drinks", "Rice") and assign that heading as the "category" for all items that appear under it until the next heading.
Return ONLY a JSON array with no other text.
Format: [{"name":"Item Name","price":0,"description":"brief or empty","category":"Heading Name"}]
Rules:
- price must be a plain number (strip ₹ Rs or any currency), use 0 if unclear
- category MUST be the section heading the item belongs to. If none found, use "General".
- Do NOT include the section headers themselves as items.

Menu text:
${text}`;
    const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { method: 'GET' });
    if (!res.ok) throw new Error(`Parse HTTP ${res.status}`);
    const raw = await res.text();
    console.log('AI parse response:', raw.slice(0, 400));
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in parse response');
    const arr = JSON.parse(match[0]);
    return arr
      .filter((x: any) => x?.name?.trim())
      .map((x: any) => ({
        id: uid(),
        name: String(x.name || '').trim(),
        price: String(Number(x.price) || 0),
        description: String(x.description || '').trim(),
        category: String(x.category || 'General').trim(),
        removed: false,
      }));
  };

  const startProcessing = async () => {
    if (pages.length === 0) { Alert.alert('No Pages', 'Add at least one menu card photo.'); return; }
    setStep('processing');

    // Step 1: OCR all pages
    let combinedText = '';
    for (let i = 0; i < pages.length; i++) {
      setProcessingMsg(`Reading page ${i + 1} of ${pages.length}…`);
      try {
        const pageText = await ocrImage(pages[i].base64);
        combinedText += pageText + '\n';
      } catch (e) {
        console.error('OCR page error:', e);
      }
    }

    if (!combinedText.trim()) {
      Alert.alert('Could Not Read Photos', 'OCR failed. Try better lighting and keep camera steady.', [
        { text: 'Back', onPress: () => setStep('capture') },
      ]);
      return;
    }

    // Step 2: AI parse
    setProcessingMsg('Identifying items with AI…');
    try {
      const extracted = await parseMenuText(combinedText);
      if (extracted.length === 0) {
        Alert.alert('No Items Found', 'Could not identify items. Try a clearer photo with good lighting.', [
          { text: 'Back', onPress: () => setStep('capture') },
        ]);
        return;
      }
      setItems(extracted);
      setStep('review');
    } catch (e) {
      console.error('Parse error:', e);
      Alert.alert('AI Parse Error', 'Could not process menu. Check internet and try again.', [
        { text: 'Back', onPress: () => setStep('capture') },
      ]);
    }
  };

  // ── Review helpers ───────────────────────────────────────────────────
  const editItem = (id: string, field: 'name' | 'price' | 'description' | 'category', val: string) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));

  const toggleRemove = (id: string) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, removed: !it.removed } : it));

  const active = items.filter(i => !i.removed && i.name.trim());

  // ── Import ────────────────────────────────────────────────────────────
  const startImport = async () => {
    if (active.length === 0) { Alert.alert('Nothing to Import', 'Keep at least one item.'); return; }
    setImportTotal(active.length);
    setImportProgress(0);
    setImportDone(false);
    setStep('importing');

    // Build category name → ID map (auto-create missing ones)
    const existingCats = getAllCategories();
    const catMap: Record<string, number | null> = {};
    const uniqueCatNames = [...new Set(active.map(i => i.category?.trim()).filter(Boolean))];
    let colorIdx = existingCats.length % CAT_COLORS.length;
    for (const catName of uniqueCatNames) {
      const existing = existingCats.find(c => c.name.toLowerCase() === catName.toLowerCase());
      if (existing) {
        catMap[catName] = existing.id;
      } else {
        const color = CAT_COLORS[colorIdx % CAT_COLORS.length];
        colorIdx++;
        const newId = addCategory(catName, color);
        catMap[catName] = newId;
      }
    }

    // Pre-calculate base item code to avoid DB race conditions during bulk insert
    const baseCodeStr = generateItemCode();
    let nextCodeNum = parseInt(baseCodeStr.replace(/\D/g, '')) || Date.now();

    for (let i = 0; i < active.length; i++) {
      const it = active[i];
      try {
        const code = `ITM${String(nextCodeNum).padStart(4, '0')}`;
        nextCodeNum++;
        
        const price = parseFloat(it.price) || 0;
        const catId = catMap[it.category?.trim()] ?? null;
        const savedId = addItem(code, it.name.trim(), price, catId, null);
        // background AI image
        const catName = it.category || '';
        ;(async () => {
          try {
            const url = await generateAIImage(it.name.trim(), catName);
            if (url) {
              const saved = getItemById(savedId);
              dbUpdateItem(savedId, code, it.name.trim(), price, catId, url, saved?.is_available ?? 1);
            }
          } catch (_) {}
        })();
      } catch (e) { console.error('save error', e); }
      setImportProgress(i + 1);
      await new Promise(r => setTimeout(r, 80));
    }
    setImportDone(true);
  };

  // ── Renders ──────────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.contentWrapper}>
        <View style={styles.centered}>
          <View style={styles.processingIcon}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
          <Text style={styles.procTitle}>Analyzing Menu</Text>
          <Text style={styles.procMsg}>{processingMsg}</Text>
          <Text style={styles.procNote}>AI is extracting items from your menu card</Text>
        </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'importing') {
    const pct = importTotal > 0 ? importProgress / importTotal : 0;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.contentWrapper}>
        <View style={styles.centered}>
          {!importDone ? (
            <>
              <ActivityIndicator size="large" color={Colors.gold} />
              <Text style={styles.procTitle}>Importing Items</Text>
              <Text style={styles.procMsg}>{importProgress} of {importTotal} saved</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
              </View>
              <Text style={styles.procNote}>AI images generating in background…</Text>
            </>
          ) : (
            <>
              <View style={styles.doneCircle}>
                <MaterialCommunityIcons name="check-bold" size={40} color={Colors.textInverse} />
              </View>
              <Text style={styles.procTitle}>Import Complete!</Text>
              <Text style={styles.procMsg}>{importTotal} items added to your menu</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
                <Text style={styles.doneBtnText}>Go to Items →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'review') {
    const removed = items.filter(i => i.removed).length;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.contentWrapper}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep('capture')}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={styles.headerTitle}>Review Items</Text>
            <Text style={styles.headerSub}>
              {active.length} to import{removed > 0 ? `, ${removed} removed` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.importBtn}
            onPress={startImport}
            disabled={active.length === 0}
          >
            <MaterialCommunityIcons name="check" size={16} color={Colors.textInverse} />
            <Text style={styles.importBtnText}>Import {active.length}</Text>
          </TouchableOpacity>
        </View>

        {/* Page thumbnails strip */}
        <View style={styles.pageStrip}>
          <FlatList
            horizontal
            data={pages}
            keyExtractor={p => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}
            renderItem={({ item: pg }) => (
              <TouchableOpacity onPress={() => setPreviewUri(pg.uri)}>
                <Image source={{ uri: pg.uri }} style={styles.pageThumbnail} />
                <View style={styles.pageZoomBadge}>
                  <MaterialCommunityIcons name="magnify" size={10} color={Colors.white} />
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.divider} />

        {/* Items list */}
        <FlatList
          data={items}
          keyExtractor={it => it.id}
          contentContainerStyle={styles.reviewList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.reviewListHdr}>
              Tap ✕ to remove items you don't want
            </Text>
          }
          renderItem={({ item: it }) => (
            <View style={[styles.reviewCard, it.removed && styles.reviewCardRemoved]}>
              <View style={styles.reviewCardIcon}>
                <MaterialCommunityIcons
                  name={it.removed ? 'close' : 'food-variant'}
                  size={20}
                  color={it.removed ? Colors.textMuted : Colors.gold}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[styles.reviewName, it.removed && styles.reviewTextRemoved]}
                  value={it.name}
                  onChangeText={v => editItem(it.id, 'name', v)}
                  placeholderTextColor={Colors.textMuted}
                  placeholder="Item name"
                  editable={!it.removed}
                />
                <TextInput
                  style={[styles.reviewCategory, it.removed && styles.reviewTextRemoved]}
                  value={it.category}
                  onChangeText={v => editItem(it.id, 'category', v)}
                  placeholderTextColor={Colors.textMuted}
                  placeholder="Category"
                  editable={!it.removed}
                />
                {it.description ? (
                  <Text style={styles.reviewDesc} numberOfLines={1}>{it.description}</Text>
                ) : null}
                <View style={styles.reviewPriceRow}>
                  <Text style={styles.reviewPriceSym}>₹</Text>
                  <TextInput
                    style={[styles.reviewPriceInput, it.removed && styles.reviewTextRemoved]}
                    value={it.price}
                    onChangeText={v => editItem(it.id, 'price', v)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    editable={!it.removed}
                  />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.removeBtn, it.removed && styles.restoreBtn]}
                onPress={() => toggleRemove(it.id)}
              >
                <MaterialCommunityIcons
                  name={it.removed ? 'restore' : 'close'}
                  size={16}
                  color={it.removed ? Colors.success : Colors.error}
                />
              </TouchableOpacity>
            </View>
          )}
        />

        {/* Full-page preview modal */}
        <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPreviewUri(null)} />
            {previewUri && (
              <Image source={{ uri: previewUri }} style={styles.previewFull} resizeMode="contain" />
            )}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setPreviewUri(null)}>
              <MaterialCommunityIcons name="close" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </Modal>
        </View>
      </SafeAreaView>
    );
  }

  // ── Capture Step ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.contentWrapper}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={styles.headerTitle}>Scan Menu Card</Text>
          <Text style={styles.headerSub}>Add one or more menu pages</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.captureScroll} showsVerticalScrollIndicator={false}>
        {/* Captured pages grid */}
        {pages.length > 0 ? (
          <View style={styles.pagesGrid}>
            {pages.map(pg => (
              <View key={pg.id} style={styles.pageCard}>
                <TouchableOpacity onPress={() => setPreviewUri(pg.uri)}>
                  <Image source={{ uri: pg.uri }} style={styles.pageCardImg} />
                  <View style={styles.pageZoomOverlay}>
                    <MaterialCommunityIcons name="magnify-plus-outline" size={22} color={Colors.white} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pageDeleteBtn} onPress={() => setPages(p => p.filter(x => x.id !== pg.id))}>
                  <MaterialCommunityIcons name="close" size={12} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCapture}>
            <MaterialCommunityIcons name="camera-document" size={72} color={Colors.textMuted} />
            <Text style={styles.emptyCaptureTitle}>No pages added yet</Text>
            <Text style={styles.emptyCaptureText}>
              Take a photo of each menu card page.{'\n'}Multiple pages are supported.
            </Text>
          </View>
        )}

        {/* Add buttons */}
        <View style={styles.captureBtns}>
          <TouchableOpacity style={styles.captureBtn} onPress={addFromCamera}>
            <MaterialCommunityIcons name="camera" size={24} color={Colors.gold} />
            <Text style={styles.captureBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={addFromGallery}>
            <MaterialCommunityIcons name="image-multiple" size={24} color={Colors.gold} />
            <Text style={styles.captureBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Menu text input */}
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information-outline" size={18} color={Colors.gold} />
          <Text style={styles.infoText}>
            AI will automatically read text from your photos and extract all menu items with prices.
          </Text>
        </View>

        {pages.length > 0 && (
          <TouchableOpacity style={styles.analyzeBtn} onPress={startProcessing}>
            <MaterialCommunityIcons name="text-recognition" size={20} color={Colors.textInverse} />
            <Text style={styles.analyzeBtnText}>
              Scan {pages.length} Page{pages.length > 1 ? 's' : ''} →
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Full-page preview modal */}
      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPreviewUri(null)} />
          {previewUri && (
            <Image source={{ uri: previewUri }} style={styles.previewFull} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.closeModalBtn} onPress={() => setPreviewUri(null)}>
            <MaterialCommunityIcons name="close" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const THUMB = (SW - Spacing.lg * 2 - Spacing.md * 2) / 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrapper: { flex: 1, maxWidth: 800, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.heading3 },
  headerSub: { ...Typography.caption, marginTop: 1 },

  // Processing
  processingIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.goldOverlay,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  procTitle: { ...Typography.heading3, marginBottom: Spacing.sm, textAlign: 'center' },
  procMsg: { ...Typography.body, textAlign: 'center', marginBottom: Spacing.md },
  procNote: { ...Typography.caption, textAlign: 'center', color: Colors.textMuted },

  // Progress bar
  progressTrack: {
    width: '100%', height: 6, backgroundColor: Colors.surface,
    borderRadius: Radius.full, marginTop: Spacing.xl, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: Radius.full },

  // Done state
  doneCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  doneBtn: {
    marginTop: Spacing.xxl, backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md,
    borderRadius: Radius.full, ...Shadows.goldGlow,
  },
  doneBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 15 },

  // Capture step
  captureScroll: { padding: Spacing.lg, paddingBottom: 40 },
  pagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  pageCard: { width: THUMB, height: THUMB, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  pageCardImg: { width: '100%', height: '100%' },
  pageZoomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  pageDeleteBtn: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20,
    borderRadius: 10, backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyCapture: { alignItems: 'center', paddingVertical: Spacing.xxxl * 2 },
  emptyCaptureTitle: { ...Typography.heading3, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  emptyCaptureText: { ...Typography.body, textAlign: 'center', lineHeight: 22 },

  captureBtns: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  captureBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg, paddingVertical: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm, ...Shadows.card,
  },
  captureBtnText: { ...Typography.bodyMedium, color: Colors.gold },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.goldOverlay, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '40',
    padding: Spacing.md, marginBottom: Spacing.xl,
  },
  infoText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.gold, borderRadius: Radius.lg, paddingVertical: 16,
    marginBottom: Spacing.md, ...Shadows.goldGlow,
  },
  analyzeBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-Bold', fontSize: 15 },

  // Review step
  importBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.gold, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  importBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 13 },
  pageStrip: { paddingVertical: Spacing.sm },
  pageThumbnail: {
    width: 56, height: 56, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  pageZoomBadge: {
    position: 'absolute', bottom: 2, right: 2, width: 16, height: 16,
    borderRadius: 8, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: Colors.border },
  reviewList: { padding: Spacing.lg, paddingBottom: 40 },
  reviewListHdr: {
    ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.md, textAlign: 'center',
  },
  reviewCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginBottom: Spacing.sm, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm, ...Shadows.card,
  },
  reviewCardRemoved: { opacity: 0.4, borderColor: Colors.error },
  reviewCardIcon: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.goldOverlay, alignItems: 'center', justifyContent: 'center',
  },
  reviewName: {
    fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.textPrimary,
    paddingVertical: 0, paddingHorizontal: 0,
  },
  reviewCategory: {
    fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.gold,
    paddingVertical: 0, paddingHorizontal: 0, marginTop: 2,
    backgroundColor: Colors.goldOverlay, borderRadius: 4, paddingHorizontal: 4, alignSelf: 'flex-start',
  },
  reviewDesc: { ...Typography.caption, marginTop: 4, color: Colors.textMuted },
  reviewPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  reviewPriceSym: { fontFamily: 'Poppins-Medium', fontSize: 12, color: Colors.gold, marginRight: 2 },
  reviewPriceInput: {
    fontFamily: 'Poppins-SemiBold', fontSize: 13, color: Colors.gold,
    paddingVertical: 0, paddingHorizontal: 0, minWidth: 60,
  },
  reviewTextRemoved: { color: Colors.textMuted },
  removeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.errorBg, alignItems: 'center', justifyContent: 'center',
  },
  restoreBtn: { backgroundColor: Colors.successBg },

  // Preview modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewFull: { width: SW - 32, height: '80%', borderRadius: Radius.lg },
  closeModalBtn: {
    position: 'absolute', top: 56, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});

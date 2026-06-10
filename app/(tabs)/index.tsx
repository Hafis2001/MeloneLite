import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, RefreshControl, ScrollView, Platform,
  useWindowDimensions, Modal, TouchableWithoutFeedback, Animated,
} from 'react-native';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllItems, Item, getItemByBarcode } from '../../src/db/itemsDB';
import { getAllCategories, Category } from '../../src/db/categoriesDB';
import { useCart } from '../../src/context/CartContext';
import { formatCurrency } from '../../src/utils/currencyUtils';
import { getSetting } from '../../src/db/settingsDB';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';
import { DualText } from '../../src/components/DualText';
import { t } from '../../src/utils/translations';
import { useThemeVersion } from '../../src/context/ThemeContext';

export default function MenuScreen() {
  const themeVersion = useThemeVersion();
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [requireBarcode, setRequireBarcode] = useState(false);
  const [addProductByClick, setAddProductByClick] = useState(false);

  // Barcode → quantity modal
  const [barcodeModalItem, setBarcodeModalItem] = useState<Item | null>(null);
  const [barcodeQty, setBarcodeQty] = useState(1);
  const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  const { addItem, getItemQuantity, updateQuantity, getTotalItems, getSubtotal } = useCart();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isPhone = width < 768;

  // In landscape phone mode, give fewer columns to avoid tiny cards
  const numColumns = width >= 1024 ? 5 : width >= 768 ? 4 : (isLandscape && isPhone) ? 3 : 2;
  const cardWidth = `${100 / numColumns - 2}%`;

  // Receive scanned barcode from barcode-scanner
  const params = useLocalSearchParams<{ scannedBarcode?: string }>();
  const lastHandledBarcode = useRef<string>('');

  useEffect(() => {
    const bc = params.scannedBarcode;
    if (!bc || bc === lastHandledBarcode.current) return;
    lastHandledBarcode.current = bc;
    // Look up item by barcode
    const found = getItemByBarcode(bc);
    if (!found) {
      // Item not found — show info
      setBarcodeModalItem(null);
      setBarcodeModalVisible(false);
      // Small delay to let screen settle
      setTimeout(() => {
        setBarcodeModalItem({ id: -1, item_name: `Barcode: ${bc}`, rate: 0, item_code: '', image_uri: null, is_available: 0, created_at: '', category_id: null } as any);
        setBarcodeQty(1);
        setBarcodeModalVisible(true);
      }, 300);
    } else {
      setBarcodeModalItem(found);
      setBarcodeQty(1);
      setBarcodeModalVisible(true);
    }
  }, [params.scannedBarcode]);

  // Animate modal open
  useEffect(() => {
    if (barcodeModalVisible) {
      Animated.spring(scaleAnim, {
        toValue: 1, useNativeDriver: true,
        tension: 120, friction: 8,
      }).start();
    } else {
      scaleAnim.setValue(0.85);
    }
  }, [barcodeModalVisible]);

  const loadData = useCallback(() => {
    setItems(getAllItems());
    setCategories(getAllCategories());
    setRequireBarcode(getSetting('require_barcode') === '1');
    setAddProductByClick(getSetting('add_product_by_click') === '1');
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 500);
  }, [loadData]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedCategoryId !== null) {
      result = result.filter(i => i.category_id === selectedCategoryId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.item_name.toLowerCase().includes(q) ||
        i.item_code.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, selectedCategoryId, searchQuery]);

  const cartCount = getTotalItems();
  const cartSubtotal = getSubtotal();

  const closeBarcodeModal = () => {
    setBarcodeModalVisible(false);
    setBarcodeModalItem(null);
    setBarcodeQty(1);
    // Clear the param so re-scan works
    lastHandledBarcode.current = '';
  };

  const confirmBarcodeAdd = () => {
    if (!barcodeModalItem || barcodeModalItem.id === -1) {
      closeBarcodeModal();
      return;
    }
    const currentQty = getItemQuantity(barcodeModalItem.id);
    
    if (currentQty === 0) {
      addItem(barcodeModalItem);
      if (barcodeQty > 1) {
        updateQuantity(barcodeModalItem.id, barcodeQty);
      }
    } else {
      updateQuantity(barcodeModalItem.id, currentQty + barcodeQty);
    }
    closeBarcodeModal();
  };

  const renderCategoryPill = ({ item }: { item: Category }) => {
    const isSelected = selectedCategoryId === item.id;
    return (
      <TouchableOpacity
        style={[styles.categoryPill, isSelected && { backgroundColor: Colors.gold, borderColor: Colors.gold }]}
        onPress={() => setSelectedCategoryId(isSelected ? null : item.id)}
        activeOpacity={0.7}
      >
        <DualText 
          text={item.name} 
          arabicText={item.name_ar} 
          malayalamText={item.name_ml}
          tamilText={item.name_ta}
          hindiText={item.name_hi}
          style={[styles.categoryPillText, isSelected && { color: Colors.textInverse }]} 
        />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: Item }) => {
    const qty = getItemQuantity(item.id);
    // In landscape phone, reduce image height
    const imgHeight = isLandscape && isPhone ? 80 : 120;

    const handleCardPress = () => {
      if (qty === 0) {
        addItem(item);
      } else {
        updateQuantity(item.id, qty + 1);
      }
    };

    return (
      <TouchableOpacity 
        style={[styles.menuCard, { width: cardWidth as any }]}
        activeOpacity={addProductByClick ? 0.7 : 1}
        onPress={addProductByClick ? handleCardPress : undefined}
      >
        {item.image_uri ? (
          <Image source={{ uri: item.image_uri }} style={[styles.itemImage, { height: imgHeight }]} resizeMode="cover" />
        ) : (
          <View style={[styles.itemImagePlaceholder, { height: imgHeight }]}>
            <MaterialCommunityIcons name="food" size={isLandscape && isPhone ? 28 : 36} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.cardContent}>
          {item.category_name && (
            <View style={[styles.categoryTag, { borderColor: item.category_color || Colors.gold }]}>
              <DualText 
                text={item.category_name} 
                arabicText={item.category_name_ar} 
                malayalamText={item.category_name_ml}
                tamilText={item.category_name_ta}
                hindiText={item.category_name_hi}
                kannadaText={item.category_name_kn}
                style={[styles.categoryTagText, { color: item.category_color || Colors.gold }]} 
              />
            </View>
          )}
          <DualText 
            text={item.item_name} 
            arabicText={item.item_name_ar} 
            malayalamText={item.item_name_ml}
            tamilText={item.item_name_ta}
            hindiText={item.item_name_hi}
            kannadaText={item.item_name_kn}
            style={styles.itemName} 
            numberOfLines={2} 
          />
          <Text style={styles.itemCode}>{item.item_code}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.itemPrice}>{formatCurrency(item.rate)}</Text>
            <View style={styles.actionContainer}>
              {qty === 0 ? (
                <TouchableOpacity
                  style={styles.addBtnFull}
                  onPress={() => addItem(item)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={Colors.textInverse} />
                  <Text style={styles.addBtnFullText}>Add</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.qtyControlsFull}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.id, qty - 1)}
                  >
                    <MaterialCommunityIcons name="minus" size={20} color={Colors.gold} />
                  </TouchableOpacity>
                  <Text style={styles.qtyTextFull}>{qty}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.id, qty + 1)}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color={Colors.gold} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={isLandscape && isPhone ? ['left', 'right'] : ['top']}
    >
      <View style={styles.contentWrapper}>
        {/* Header */}
        <View style={[styles.header, isLandscape && isPhone && styles.headerLandscape]}>
          <View>
            <DualText text="Menu" style={[styles.headerTitle, isLandscape && isPhone && { fontSize: 18 }]} />
            {!isLandscape && (
              <Text style={styles.headerSub}>{items.length} items available</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {/* Barcode Scan Button */}
            {requireBarcode && (
              <TouchableOpacity
                style={styles.headerScanBtn}
                onPress={() => router.push({ pathname: '/barcode-scanner', params: { mode: 'scan_cart' } })}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="barcode-scan" size={22} color={Colors.gold} />
              </TouchableOpacity>
            )}
            {/* Cart Button */}
            <TouchableOpacity style={styles.headerCartBtn} onPress={() => router.push('/cart')}>
              <MaterialCommunityIcons name="cart-outline" size={24} color={Colors.gold} />
              {cartCount > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, isLandscape && isPhone && styles.searchContainerLandscape]}>
          <MaterialCommunityIcons name="magnify" size={20} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={getSetting('enable_arabic') === '1' ? 'Search items... / ابحث عن العناصر...' : getSetting('enable_malayalam') === '1' ? 'Search items... / സാധനങ്ങൾ തിരയുക...' : getSetting('enable_tamil') === '1' ? 'Search items... / பொருட்களை தேடு...' : 'Search items...'}
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter */}
        {categories.length > 0 && (
          <View style={[styles.categoryRow, isLandscape && isPhone && { marginBottom: Spacing.sm }]}>
            <FlatList
              data={categories}
              horizontal
              keyExtractor={item => item.id.toString()}
              renderItem={renderCategoryPill}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}
              ListHeaderComponent={
                <TouchableOpacity
                  style={[styles.categoryPill, selectedCategoryId === null && { backgroundColor: Colors.gold, borderColor: Colors.gold }]}
                  onPress={() => setSelectedCategoryId(null)}
                >
                  <DualText text="All" style={[styles.categoryPillText, selectedCategoryId === null && { color: Colors.textInverse }]} />
                </TouchableOpacity>
              }
            />
          </View>
        )}

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="food-off" size={64} color={Colors.textMuted} />
            <DualText text="No Items Found" style={styles.emptyTitle} />
            <DualText text={items.length === 0 ? 'Add items from the Items tab to get started' : 'Try a different search or category'} style={styles.emptySubtitle} />
            {items.length === 0 && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/items')}>
                <DualText text="Add Items" style={styles.emptyBtnText} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            key={numColumns}
            data={filteredItems}
            keyExtractor={item => item.id.toString()}
            renderItem={renderItem}
            numColumns={numColumns}
            columnWrapperStyle={styles.row}
            contentContainerStyle={[styles.listContent, { paddingBottom: cartCount > 0 ? 110 : 60 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Floating Cart Bar */}
        {cartCount > 0 && (
          <TouchableOpacity style={styles.cartBar} onPress={() => router.push('/cart')} activeOpacity={0.9}>
            <View style={styles.cartBarLeft}>
              <View style={styles.cartCountBubble}>
                <Text style={styles.cartCountText}>{cartCount}</Text>
              </View>
              <DualText text="View Cart" style={styles.cartBarLabel} />
            </View>
            <View style={styles.cartBarRight}>
              <Text style={styles.cartBarTotal}>{formatCurrency(cartSubtotal)}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textInverse} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Barcode Item Modal */}
      <Modal
        visible={barcodeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeBarcodeModal}
      >
        <TouchableWithoutFeedback onPress={closeBarcodeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}>
                {barcodeModalItem?.id === -1 ? (
                  // Not found
                  <>
                    <View style={styles.modalNotFoundIcon}>
                      <MaterialCommunityIcons name="barcode-off" size={40} color={Colors.error} />
                    </View>
                    <Text style={styles.modalItemName}>Barcode Not Found</Text>
                    <Text style={styles.modalNotFoundSub}>
                      {barcodeModalItem.item_name}
                    </Text>
                    <Text style={styles.modalHint}>
                      No item is assigned this barcode.{'\n'}You can assign barcodes in the Items tab.
                    </Text>
                    <TouchableOpacity style={styles.modalCloseBtn} onPress={closeBarcodeModal}>
                      <Text style={styles.modalCloseBtnText}>Close</Text>
                    </TouchableOpacity>
                  </>
                ) : barcodeModalItem ? (
                  // Found — show qty selector
                  <>
                    <View style={styles.modalItemHeader}>
                      {barcodeModalItem.image_uri ? (
                        <Image source={{ uri: barcodeModalItem.image_uri }} style={styles.modalItemImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.modalItemImagePlaceholder}>
                          <MaterialCommunityIcons name="food-variant" size={32} color={Colors.textMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        {barcodeModalItem.category_name && (
                          <View style={[styles.modalCatTag, { borderColor: barcodeModalItem.category_color || Colors.gold }]}>
                            <Text style={[styles.modalCatTagText, { color: barcodeModalItem.category_color || Colors.gold }]}>
                              {barcodeModalItem.category_name}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.modalItemName} numberOfLines={2}>{barcodeModalItem.item_name}</Text>
                        <Text style={styles.modalItemCode}>{barcodeModalItem.item_code}</Text>
                        <Text style={styles.modalItemPrice}>{formatCurrency(barcodeModalItem.rate)}</Text>
                      </View>
                    </View>

                    <View style={styles.modalDivider} />

                    {/* Quantity selector */}
                    <Text style={styles.modalQtyLabel}>Select Quantity</Text>
                    <View style={styles.modalQtyRow}>
                      <TouchableOpacity
                        style={[styles.modalQtyBtn, barcodeQty <= 1 && { opacity: 0.4 }]}
                        onPress={() => setBarcodeQty(q => Math.max(1, q - 1))}
                        disabled={barcodeQty <= 1}
                      >
                        <MaterialCommunityIcons name="minus" size={20} color={Colors.gold} />
                      </TouchableOpacity>
                      <View style={styles.modalQtyDisplay}>
                        <Text style={styles.modalQtyNumber}>{barcodeQty}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.modalQtyBtn}
                        onPress={() => setBarcodeQty(q => q + 1)}
                      >
                        <MaterialCommunityIcons name="plus" size={20} color={Colors.gold} />
                      </TouchableOpacity>
                    </View>

                    {/* Subtotal */}
                    <View style={styles.modalSubtotalRow}>
                      <Text style={styles.modalSubtotalLabel}>Subtotal</Text>
                      <Text style={styles.modalSubtotalValue}>{formatCurrency(barcodeModalItem.rate * barcodeQty)}</Text>
                    </View>

                    {/* Buttons */}
                    <View style={styles.modalBtns}>
                      <TouchableOpacity style={styles.modalCancelBtn} onPress={closeBarcodeModal}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.modalAddBtn} onPress={confirmBarcodeAdd}>
                        <MaterialCommunityIcons name="cart-plus" size={18} color={Colors.textInverse} />
                        <Text style={styles.modalAddText}>Add to Cart</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles() {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrapper: { flex: 1, width: '100%', alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerLandscape: { paddingVertical: Spacing.sm },
  headerTitle: { ...Typography.heading2 },
  headerSub: { ...Typography.caption, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerScanBtn: {
    width: 44, height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.goldOverlay,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.gold + '40',
  },
  headerCartBtn: {
    width: 44, height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.goldOverlay,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.error, borderRadius: Radius.full,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  headerBadgeText: { color: Colors.white, fontSize: 10, fontFamily: 'Poppins-Bold' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md, height: 46, borderWidth: 1, borderColor: Colors.border,
  },
  searchContainerLandscape: { height: 40, marginBottom: Spacing.sm },
  searchInput: { flex: 1, color: Colors.textPrimary, fontFamily: 'Poppins-Regular', fontSize: 14 },
  categoryRow: { marginBottom: Spacing.md },
  categoryPill: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  categoryPillText: { ...Typography.captionMedium, fontSize: 12 },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  row: { gap: Spacing.md, marginBottom: Spacing.md },
  menuCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.card,
  },
  itemImage: { width: '100%', height: 120 },
  itemImagePlaceholder: {
    width: '100%', height: 120,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  cardContent: { padding: Spacing.md },
  categoryTag: {
    alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4,
  },
  categoryTagText: { fontSize: 9, fontFamily: 'Poppins-Medium' },
  itemName: { ...Typography.bodyMedium, fontSize: 13, lineHeight: 18, marginBottom: 2 },
  itemCode: { ...Typography.caption, fontSize: 10 },
  cardFooter: { marginTop: Spacing.sm },
  actionContainer: { marginTop: Spacing.sm, width: '100%' },
  itemPrice: { ...Typography.price, fontSize: 15 },
  addBtnFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    width: '100%', height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.gold, ...Shadows.goldGlow,
  },
  addBtnFullText: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 13 },
  qtyControlsFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', height: 36, backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold, overflow: 'hidden',
  },
  qtyTextFull: { ...Typography.bodyMedium, fontSize: 15, color: Colors.gold },
  qtyBtn: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  emptyTitle: { ...Typography.heading3, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  emptySubtitle: { ...Typography.body, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: Spacing.xl, backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.full,
  },
  emptyBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 14 },
  cartBar: {
    position: 'absolute', bottom: 16, left: Spacing.lg, right: Spacing.lg,
    backgroundColor: Colors.gold, borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    ...Shadows.button,
  },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cartCountBubble: {
    backgroundColor: Colors.textInverse, borderRadius: Radius.full,
    width: 26, height: 26, alignItems: 'center', justifyContent: 'center',
  },
  cartCountText: { color: Colors.gold, fontFamily: 'Poppins-Bold', fontSize: 12 },
  cartBarLabel: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 14 },
  cartBarRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cartBarTotal: { color: Colors.textInverse, fontFamily: 'Poppins-Bold', fontSize: 16 },

  // Barcode Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.cardElevated,
    borderRadius: Radius.xl, padding: Spacing.xl,
    width: '100%', maxWidth: 380,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.card,
  },
  modalItemHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  modalItemImage: { width: 72, height: 72, borderRadius: Radius.md },
  modalItemImagePlaceholder: {
    width: 72, height: 72, borderRadius: Radius.md,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  modalCatTag: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4,
  },
  modalCatTagText: { fontSize: 9, fontFamily: 'Poppins-Medium' },
  modalItemName: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.textPrimary, marginBottom: 2 },
  modalItemCode: { ...Typography.caption, fontSize: 11, color: Colors.textMuted },
  modalItemPrice: { ...Typography.price, fontSize: 18, marginTop: 4 },
  modalDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  modalQtyLabel: { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing.md },
  modalQtyRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.lg, marginBottom: Spacing.lg,
  },
  modalQtyBtn: {
    width: 48, height: 48, borderRadius: Radius.full,
    backgroundColor: Colors.goldOverlay, borderWidth: 1.5, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  modalQtyDisplay: {
    width: 64, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  modalQtyNumber: { fontFamily: 'Poppins-Bold', fontSize: 22, color: Colors.textPrimary },
  modalSubtotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.goldOverlay, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
  },
  modalSubtotalLabel: { ...Typography.bodyMedium, color: Colors.textMuted },
  modalSubtotalValue: { fontFamily: 'Poppins-Bold', fontSize: 18, color: Colors.gold },
  modalBtns: { flexDirection: 'row', gap: Spacing.md },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  modalCancelText: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.textMuted },
  modalAddBtn: {
    flex: 2, paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8, ...Shadows.goldGlow,
  },
  modalAddText: { fontFamily: 'Poppins-Bold', fontSize: 15, color: Colors.textInverse },

  // Not found state
  modalNotFoundIcon: {
    alignSelf: 'center', width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.errorBg, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  modalNotFoundSub: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: Spacing.md },
  modalHint: {
    ...Typography.body, color: Colors.textMuted, textAlign: 'center',
    lineHeight: 22, marginBottom: Spacing.xl,
  },
  modalCloseBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: 'center', ...Shadows.goldGlow,
  },
  modalCloseBtnText: { fontFamily: 'Poppins-Bold', fontSize: 15, color: Colors.textInverse },
  });
}

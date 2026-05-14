import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, RefreshControl, ScrollView, Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllItems, Item } from '../../src/db/itemsDB';
import { getAllCategories, Category } from '../../src/db/categoriesDB';
import { useCart } from '../../src/context/CartContext';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';

export default function MenuScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { addItem, getItemQuantity, updateQuantity, getTotalItems, getSubtotal } = useCart();

  const loadData = useCallback(() => {
    setItems(getAllItems());
    setCategories(getAllCategories());
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

  const renderCategoryPill = ({ item }: { item: Category }) => {
    const isSelected = selectedCategoryId === item.id;
    return (
      <TouchableOpacity
        style={[styles.categoryPill, isSelected && { backgroundColor: Colors.gold, borderColor: Colors.gold }]}
        onPress={() => setSelectedCategoryId(isSelected ? null : item.id)}
        activeOpacity={0.7}
      >
        <Text style={[styles.categoryPillText, isSelected && { color: Colors.textInverse }]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: Item }) => {
    const qty = getItemQuantity(item.id);
    return (
      <View style={styles.menuCard}>
        {item.image_uri ? (
          <Image source={{ uri: item.image_uri }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <MaterialCommunityIcons name="food" size={36} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.cardContent}>
          {item.category_name && (
            <View style={[styles.categoryTag, { borderColor: item.category_color || Colors.gold }]}>
              <Text style={[styles.categoryTagText, { color: item.category_color || Colors.gold }]}>
                {item.category_name}
              </Text>
            </View>
          )}
          <Text style={styles.itemName} numberOfLines={2}>{item.item_name}</Text>
          <Text style={styles.itemCode}>{item.item_code}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.itemPrice}>₹{item.rate.toFixed(2)}</Text>
            {qty === 0 ? (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => addItem(item)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="plus" size={20} color={Colors.textInverse} />
              </TouchableOpacity>
            ) : (
              <View style={styles.qtyControls}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.id, qty - 1)}
                >
                  <MaterialCommunityIcons name="minus" size={14} color={Colors.gold} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.id, qty + 1)}
                >
                  <MaterialCommunityIcons name="plus" size={14} color={Colors.gold} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Menu</Text>
          <Text style={styles.headerSub}>{items.length} items available</Text>
        </View>
        <TouchableOpacity style={styles.headerCartBtn} onPress={() => router.push('/cart')}>
          <MaterialCommunityIcons name="cart-outline" size={24} color={Colors.gold} />
          {cartCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={Colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
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
        <View style={styles.categoryRow}>
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
                <Text style={[styles.categoryPillText, selectedCategoryId === null && { color: Colors.textInverse }]}>All</Text>
              </TouchableOpacity>
            }
          />
        </View>
      )}

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="food-off" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Items Found</Text>
          <Text style={styles.emptySubtitle}>
            {items.length === 0 ? 'Add items from the Items tab to get started' : 'Try a different search or category'}
          </Text>
          {items.length === 0 && (
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/items')}>
              <Text style={styles.emptyBtnText}>Add Items</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
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
            <Text style={styles.cartBarLabel}>View Cart</Text>
          </View>
          <View style={styles.cartBarRight}>
            <Text style={styles.cartBarTotal}>₹{cartSubtotal.toFixed(2)}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textInverse} />
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const CARD_WIDTH = '48%';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: { ...Typography.heading2 },
  headerSub: { ...Typography.caption, marginTop: 2 },
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
  searchInput: { flex: 1, color: Colors.textPrimary, fontFamily: 'Poppins-Regular', fontSize: 14 },
  categoryRow: { marginBottom: Spacing.md },
  categoryPill: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  categoryPillText: { ...Typography.captionMedium, fontSize: 12 },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  row: { justifyContent: 'space-between', marginBottom: Spacing.md },
  menuCard: {
    width: CARD_WIDTH, backgroundColor: Colors.card,
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
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  itemPrice: { ...Typography.price, fontSize: 15 },
  addBtn: {
    width: 32, height: 32, borderRadius: Radius.full,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
    ...Shadows.goldGlow,
  },
  qtyControls: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold, overflow: 'hidden',
  },
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  qtyText: { ...Typography.bodyMedium, fontSize: 13, paddingHorizontal: 6, color: Colors.gold },
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
});

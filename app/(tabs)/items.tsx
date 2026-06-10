import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, Image, TextInput, useWindowDimensions,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllItems, deleteItem, Item } from '../../src/db/itemsDB';
import { formatCurrency } from '../../src/utils/currencyUtils';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';
import { getSetting } from '../../src/db/settingsDB';
import { DualText } from '../../src/components/DualText';
import { useThemeVersion } from '../../src/context/ThemeContext';

export default function ItemsScreen() {
  const themeVersion = useThemeVersion();
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const [items, setItems] = useState<Item[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { width, height } = useWindowDimensions();
  const isLandscapePhone = width > height && width < 1024;

  const loadItems = useCallback(() => {
    setItems(getAllItems());
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i =>
      i.item_name.toLowerCase().includes(q) ||
      (i.item_code && i.item_code.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  useFocusEffect(useCallback(() => {
    loadItems();
  }, [loadItems]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadItems();
    setTimeout(() => setRefreshing(false), 500);
  }, [loadItems]);

  const handleDelete = (item: Item) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.item_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteItem(item.id);
            loadItems();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Item }) => (
    <View style={styles.itemCard}>
      {item.image_uri ? (
        <Image source={{ uri: item.image_uri }} style={styles.itemImage} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <MaterialCommunityIcons name="food-variant" size={28} color={Colors.textMuted} />
        </View>
      )}
      <View style={styles.itemDetails}>
        <View style={styles.itemHeader}>
          <View style={styles.codeChip}>
            <Text style={styles.codeText}>{item.item_code}</Text>
          </View>
          {item.category_name && (
            <View style={[styles.catChip, { borderColor: item.category_color || Colors.gold }]}>
              <DualText 
                text={item.category_name} 
                arabicText={item.category_name_ar} 
                malayalamText={item.category_name_ml}
                tamilText={item.category_name_ta}
                hindiText={item.category_name_hi}
                style={[styles.catText, { color: item.category_color || Colors.gold }]} 
              />
            </View>
          )}
        </View>
        <DualText 
          text={item.item_name} 
          arabicText={item.item_name_ar} 
          malayalamText={item.item_name_ml}
          tamilText={item.item_name_ta}
          hindiText={item.item_name_hi}
          kannadaText={item.item_name_kn}
          style={styles.itemName} 
          numberOfLines={1} 
        />
        <Text style={styles.itemRate}>{formatCurrency(item.rate)}</Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push({ pathname: '/item-form', params: { id: item.id } })}
        >
          <MaterialCommunityIcons name="pencil" size={16} color={Colors.gold} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={16} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={isLandscapePhone ? ['left', 'right'] : ['top']}>
      <View style={styles.contentWrapper}>
        {/* Header */}
        <View style={[styles.header, isLandscapePhone && styles.headerLandscape]}>
        <View>
          <DualText text="Items" style={styles.headerTitle} />
          <Text style={styles.headerSub}>{items.length} items in menu</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push({ pathname: '/menu-scanner' })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="text-recognition" size={18} color={Colors.gold} />
            <DualText text="Scan" style={styles.scanButtonText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push({ pathname: '/item-form' })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus" size={20} color={Colors.textInverse} />
            <DualText text="Add" style={styles.addButtonText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {items.length > 0 && (
        <View style={styles.searchContainer}>
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
      )}

      {/* List */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="food-variant" size={64} color={Colors.textMuted} />
          <DualText text="No Items Found" style={styles.emptyTitle} />
          <DualText text="Add your restaurant menu items to get started" style={styles.emptySubtitle} />
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push({ pathname: '/item-form' })}
          >
            <DualText text="Add Items" style={styles.emptyBtnText} />
          </TouchableOpacity>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="food-off" size={64} color={Colors.textMuted} />
          <DualText text="No Items Found" style={styles.emptyTitle} />
          <DualText text="Try a different search or category" style={styles.emptySubtitle} />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
          showsVerticalScrollIndicator={false}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

function createStyles() {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrapper: { flex: 1, width: '100%', alignSelf: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerLandscape: { paddingVertical: Spacing.sm },
  headerTitle: { ...Typography.heading2 },
  headerSub: { ...Typography.caption, marginTop: 2 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.gold, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    ...Shadows.goldGlow,
  },
  addButtonText: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 13, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  scanButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: Colors.gold, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.goldOverlay,
  },
  scanButtonText: { color: Colors.gold, fontFamily: 'Poppins-SemiBold', fontSize: 13 },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginBottom: Spacing.md, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.card,
  },
  itemImage: { width: 80, height: 80 },
  imagePlaceholder: {
    width: 80, height: 80, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  itemDetails: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  itemHeader: { flexDirection: 'row', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  codeChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  codeText: { fontSize: 10, fontFamily: 'Poppins-Medium', color: Colors.textMuted },
  catChip: {
    borderWidth: 1, borderRadius: Radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  catText: { fontSize: 10, fontFamily: 'Poppins-Medium' },
  itemName: { ...Typography.bodyMedium, fontSize: 14 },
  itemRate: { ...Typography.price, fontSize: 15, marginTop: 2 },
  itemActions: { paddingRight: Spacing.md, gap: Spacing.sm },
  editBtn: {
    width: 34, height: 34, borderRadius: Radius.md,
    backgroundColor: Colors.goldOverlay, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    width: 34, height: 34, borderRadius: Radius.md,
    backgroundColor: Colors.errorBg, alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  emptyTitle: { ...Typography.heading3, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  emptySubtitle: { ...Typography.body, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: Spacing.xl, backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.full,
  },
  emptyBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 14 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md, height: 46, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontFamily: 'Poppins-Regular', fontSize: 14 },
  });
}

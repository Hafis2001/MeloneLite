import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, Image,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllItems, deleteItem, Item } from '../../src/db/itemsDB';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';

export default function ItemsScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = useCallback(() => {
    setItems(getAllItems());
  }, []);

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
              <Text style={[styles.catText, { color: item.category_color || Colors.gold }]}>
                {item.category_name}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.itemName} numberOfLines={1}>{item.item_name}</Text>
        <Text style={styles.itemRate}>₹{item.rate.toFixed(2)}</Text>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Items</Text>
          <Text style={styles.headerSub}>{items.length} items in menu</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push({ pathname: '/item-form' })}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus" size={22} color={Colors.textInverse} />
          <Text style={styles.addButtonText}>Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="food-variant" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Items Yet</Text>
          <Text style={styles.emptySubtitle}>Add your restaurant menu items to get started</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push({ pathname: '/item-form' })}
          >
            <Text style={styles.emptyBtnText}>Add First Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { ...Typography.heading2 },
  headerSub: { ...Typography.caption, marginTop: 2 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.gold, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    ...Shadows.goldGlow,
  },
  addButtonText: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 14 },
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
});

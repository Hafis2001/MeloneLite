import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllCategories, deleteCategory, Category } from '../../src/db/categoriesDB';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';
import AddCategoryModal from '../../src/components/AddCategoryModal';

const CATEGORY_COLORS = [
  '#D4A853', '#E57373', '#81C784', '#64B5F6',
  '#BA68C8', '#FF8A65', '#4DB6AC', '#F06292',
  '#A1887F', '#90A4AE',
];

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  const loadCategories = useCallback(() => {
    setCategories(getAllCategories());
  }, []);

  useFocusEffect(useCallback(() => {
    loadCategories();
  }, [loadCategories]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCategories();
    setTimeout(() => setRefreshing(false), 500);
  }, [loadCategories]);

  const handleDelete = (cat: Category) => {
    Alert.alert(
      'Delete Category',
      `Delete "${cat.name}"?\n${cat.item_count && cat.item_count > 0 ? `${cat.item_count} items will be uncategorized.` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCategory(cat.id);
            loadCategories();
          },
        },
      ]
    );
  };

  const renderCategory = ({ item, index }: { item: Category; index: number }) => (
    <View style={styles.categoryCard}>
      <View style={[styles.colorDot, { backgroundColor: item.color || Colors.gold }]} />
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.itemCount}>
          {item.item_count ?? 0} {(item.item_count ?? 0) === 1 ? 'item' : 'items'}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => { setEditCategory(item); setModalVisible(true); }}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color={Colors.gold} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => handleDelete(item)}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Categories</Text>
          <Text style={styles.headerSub}>{categories.length} categories</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => { setEditCategory(null); setModalVisible(true); }}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus" size={22} color={Colors.textInverse} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Color Palette hint */}
      <View style={styles.colorPalette}>
        {CATEGORY_COLORS.map(color => (
          <View key={color} style={[styles.paletteDot, { backgroundColor: color }]} />
        ))}
      </View>

      {/* List */}
      {categories.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="tag-multiple-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Categories Yet</Text>
          <Text style={styles.emptySubtitle}>Create categories to organize your menu items</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => { setEditCategory(null); setModalVisible(true); }}
          >
            <Text style={styles.emptyBtnText}>Add First Category</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={item => item.id.toString()}
          renderItem={renderCategory}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add/Edit Modal */}
      <AddCategoryModal
        visible={modalVisible}
        editCategory={editCategory}
        availableColors={CATEGORY_COLORS}
        onClose={() => { setModalVisible(false); setEditCategory(null); }}
        onSaved={() => { setModalVisible(false); setEditCategory(null); loadCategories(); }}
      />
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
  colorPalette: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md, gap: 8,
  },
  paletteDot: { width: 12, height: 12, borderRadius: Radius.full },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  categoryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.card,
  },
  colorDot: { width: 18, height: 18, borderRadius: Radius.full, marginRight: Spacing.md },
  categoryInfo: { flex: 1 },
  categoryName: { ...Typography.bodyMedium, fontSize: 15 },
  itemCount: { ...Typography.caption, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.goldOverlay, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: { backgroundColor: Colors.errorBg },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  emptyTitle: { ...Typography.heading3, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  emptySubtitle: { ...Typography.body, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: Spacing.xl, backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.full,
  },
  emptyBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 14 },
});

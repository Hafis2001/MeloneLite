import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllOrders, getOrderById, deleteOrder, getOrderStats, Order } from '../../src/db/ordersDB';
import { getAllSettings } from '../../src/db/settingsDB';
import { printReceipt, sharePDF } from '../../src/utils/printUtils';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total_orders: 0, total_revenue: 0, today_orders: 0, today_revenue: 0 });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);

  const loadOrders = useCallback(() => {
    setOrders(getAllOrders());
    setStats(getOrderStats());
  }, []);

  useFocusEffect(useCallback(() => {
    loadOrders();
  }, [loadOrders]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders();
    setTimeout(() => setRefreshing(false), 600);
  }, [loadOrders]);

  const handleDelete = (order: Order) => {
    Alert.alert(
      'Delete Order',
      `Delete order ${order.order_number}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => { deleteOrder(order.id); loadOrders(); },
        },
      ]
    );
  };

  const handlePrint = async (order: Order) => {
    setPrintingId(order.id);
    try {
      const full = getOrderById(order.id);
      if (!full || !full.items) return;
      const settings = getAllSettings();
      await printReceipt(full, full.items, settings);
    } catch (e: any) {
      Alert.alert('Print Error', e?.message ?? 'Could not print');
    } finally {
      setPrintingId(null);
    }
  };

  const handlePDF = async (order: Order) => {
    setPrintingId(order.id);
    try {
      const full = getOrderById(order.id);
      if (!full || !full.items) return;
      const settings = getAllSettings();
      await sharePDF(full, full.items, settings);
    } catch (e: any) {
      Alert.alert('PDF Error', e?.message ?? 'Could not generate PDF');
    } finally {
      setPrintingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const isExpanded = expandedId === item.id;
    const isBusy = printingId === item.id;
    const fullOrder = isExpanded ? getOrderById(item.id) : null;

    return (
      <View style={styles.orderCard}>
        {/* Card Header */}
        <TouchableOpacity
          style={styles.orderHeader}
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
          activeOpacity={0.8}
        >
          <View style={styles.orderHeaderLeft}>
            <View style={styles.orderNumberBadge}>
              <Text style={styles.orderNumberText}>#</Text>
            </View>
            <View>
              <Text style={styles.orderNumber}>{item.order_number}</Text>
              <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
          <View style={styles.orderHeaderRight}>
            <Text style={styles.orderTotal}>₹{item.grand_total.toFixed(2)}</Text>
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20} color={Colors.textMuted}
            />
          </View>
        </TouchableOpacity>

        {/* Meta Row */}
        <View style={styles.metaRow}>
          {item.table_no ? (
            <View style={styles.metaChip}>
              <MaterialCommunityIcons name="table-chair" size={12} color={Colors.gold} />
              <Text style={styles.metaText}>Table {item.table_no}</Text>
            </View>
          ) : null}
          {item.customer_name ? (
            <View style={styles.metaChip}>
              <MaterialCommunityIcons name="account-outline" size={12} color={Colors.info} />
              <Text style={styles.metaText}>{item.customer_name}</Text>
            </View>
          ) : null}
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="cash" size={12} color={Colors.success} />
            <Text style={styles.metaText}>{item.payment_method}</Text>
          </View>
        </View>

        {/* Expanded Items */}
        {isExpanded && fullOrder?.items && (
          <View style={styles.expandedSection}>
            <View style={styles.divider} />
            {fullOrder.items.map((oi, idx) => (
              <View key={idx} style={styles.orderItemRow}>
                <Text style={styles.orderItemName} numberOfLines={1}>{oi.item_name}</Text>
                <Text style={styles.orderItemQty}>× {oi.quantity}</Text>
                <Text style={styles.orderItemSubtotal}>₹{oi.subtotal.toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            {item.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={[styles.totalValue, { color: Colors.error }]}>- ₹{item.discount.toFixed(2)}</Text>
              </View>
            )}

            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>₹{item.grand_total.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.printBtn}
            onPress={() => handlePrint(item)}
            disabled={isBusy}
          >
            <MaterialCommunityIcons name="printer-outline" size={16} color={Colors.textInverse} />
            <Text style={styles.printBtnText}>{isBusy ? 'Printing...' : 'Print'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={() => handlePDF(item)}
            disabled={isBusy}
          >
            <MaterialCommunityIcons name="file-pdf-box" size={16} color={Colors.gold} />
            <Text style={styles.pdfBtnText}>PDF Share</Text>
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
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₹{stats.today_revenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Today's Sales</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMiddle]}>
          <Text style={styles.statValue}>{stats.today_orders}</Text>
          <Text style={styles.statLabel}>Today's Orders</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total_orders}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>
      </View>

      {/* Orders List */}
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="receipt" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptySubtitle}>Placed orders will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id.toString()}
          renderItem={renderOrder}
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
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { ...Typography.heading2 },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg, gap: Spacing.sm,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  statCardMiddle: { borderColor: Colors.goldDark, backgroundColor: Colors.goldOverlay },
  statValue: { ...Typography.heading3, color: Colors.gold, fontSize: 18 },
  statLabel: { ...Typography.caption, marginTop: 2, textAlign: 'center' },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  orderCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', ...Shadows.card,
  },
  orderHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  orderHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  orderNumberBadge: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.goldOverlay, alignItems: 'center', justifyContent: 'center',
  },
  orderNumberText: { color: Colors.gold, fontFamily: 'Poppins-Bold', fontSize: 16 },
  orderNumber: { ...Typography.bodyMedium, fontSize: 14 },
  orderDate: { ...Typography.caption, fontSize: 11 },
  orderHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  orderTotal: { ...Typography.price, fontSize: 16 },
  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: 6,
  },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  metaText: { ...Typography.caption, fontSize: 11 },
  expandedSection: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  orderItemName: { flex: 1, ...Typography.body, fontSize: 13 },
  orderItemQty: { ...Typography.caption, width: 36, textAlign: 'center' },
  orderItemSubtotal: { ...Typography.bodyMedium, fontSize: 13, width: 80, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  totalLabel: { ...Typography.body, fontSize: 13 },
  totalValue: { ...Typography.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  grandTotalRow: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  grandTotalLabel: { ...Typography.heading4, color: Colors.textPrimary },
  grandTotalValue: { ...Typography.price, fontSize: 16 },
  actionRow: {
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  printBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm,
  },
  printBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 13 },
  pdfBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.goldOverlay, borderRadius: Radius.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.gold,
  },
  pdfBtnText: { color: Colors.gold, fontFamily: 'Poppins-SemiBold', fontSize: 13 },
  deleteBtn: {
    width: 40, height: 38, borderRadius: Radius.md,
    backgroundColor: Colors.errorBg, alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  emptyTitle: { ...Typography.heading3, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  emptySubtitle: { ...Typography.body, textAlign: 'center' },
});

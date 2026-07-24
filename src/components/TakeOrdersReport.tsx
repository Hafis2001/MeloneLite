import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, useWindowDimensions
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAllTakeOrders, getTakeOrderById, deleteTakeOrder, updateTakeOrderStatus, TakeOrder, incrementTakeOrderPrintCount } from '../db/takeOrdersDB';
import { getAllSettings } from '../db/settingsDB';
import { printReceipt, sharePDF } from '../utils/printUtils';
import { formatCurrency } from '../utils/currencyUtils';
import printerService from '../services/printerService';
import { Colors, Spacing, Radius, Typography, Shadows } from '../constants/theme';
import { DualText } from './DualText';

export function TakeOrdersReport() {
  const [takeOrders, setTakeOrders] = useState<TakeOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'saved'>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const { width, height } = useWindowDimensions();

  const loadOrders = useCallback(() => {
    setTakeOrders(getAllTakeOrders(statusFilter));
  }, [statusFilter]);

  useFocusEffect(useCallback(() => {
    loadOrders();
  }, [loadOrders]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders();
    setTimeout(() => setRefreshing(false), 600);
  }, [loadOrders]);

  const handleCancel = (order: TakeOrder) => {
    Alert.alert(
      'Cancel Order',
      `Cancel order ${order.order_number}?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => { updateTakeOrderStatus(order.id, 'cancelled'); loadOrders(); } }
      ]
    );
  };

  const handleSave = (order: TakeOrder) => {
    Alert.alert(
      'Save Order',
      `Mark order ${order.order_number} as saved?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', style: 'default', onPress: () => { 
            updateTakeOrderStatus(order.id, 'saved'); 
            loadOrders(); 
            // Also print immediately after save, as requested: "print option needed after saved"
            // We can prompt to print, or just show it in the saved section.
            Alert.alert("Order Saved", "The order has been saved successfully.", [
              { text: "Print Now", onPress: () => handlePrint(order) },
              { text: "OK", style: "cancel" }
            ]);
        }}
      ]
    );
  };

  const handleDelete = (order: TakeOrder) => {
    Alert.alert(
      'Delete Order',
      `Delete order ${order.order_number}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { deleteTakeOrder(order.id); loadOrders(); } }
      ]
    );
  };

  const handlePrint = async (order: TakeOrder) => {
    const full = getTakeOrderById(order.id);
    if (!full || !full.items) return;
    const settings = getAllSettings();

    if (!printerService.connected && !printerService.currentPrinter) {
      Alert.alert("Printer Not Connected", "Connect a Bluetooth printer in Settings.");
      return;
    }
    setPrintingId(order.id);
    try {
      const success = await printReceipt(full, full.items, settings);
      if (success) {
        incrementTakeOrderPrintCount(order.id);
        loadOrders();
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message ?? 'Could not print');
    } finally {
      setPrintingId(null);
    }
  };

  const handlePDF = async (order: TakeOrder) => {
    setPrintingId(order.id);
    try {
      const full = getTakeOrderById(order.id);
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

  const renderOrder = ({ item }: { item: TakeOrder }) => {
    const isExpanded = expandedId === item.id;
    const isBusy = printingId === item.id;
    const fullOrder = isExpanded ? getTakeOrderById(item.id) : null;

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity style={styles.orderHeader} onPress={() => setExpandedId(isExpanded ? null : item.id)} activeOpacity={0.8}>
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
            <Text style={styles.orderTotal}>{formatCurrency(item.grand_total)}</Text>
            <MaterialCommunityIcons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
          </View>
        </TouchableOpacity>

        {isExpanded && fullOrder?.items && (
          <View style={styles.expandedSection}>
            <View style={styles.divider} />
            {fullOrder.items.map((oi, idx) => (
              <View key={idx} style={styles.orderItemRow}>
                <Text style={styles.orderItemName} numberOfLines={1}>{oi.item_name}</Text>
                <Text style={styles.orderItemQty}>× {oi.quantity}</Text>
                <Text style={styles.orderItemSubtotal}>{formatCurrency(oi.subtotal)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            {item.discount > 0 && (
              <View style={styles.totalRow}>
                <DualText text="Discount" style={styles.totalLabel} />
                <Text style={[styles.totalValue, { color: Colors.error }]}>- {formatCurrency(item.discount)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <DualText text="Grand Total" style={styles.grandTotalLabel} />
              <Text style={styles.grandTotalValue}>{formatCurrency(item.grand_total)}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {statusFilter === 'pending' ? (
            <>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.errorBg }]} onPress={() => handleCancel(item)}>
                <MaterialCommunityIcons name="close" size={16} color={Colors.error} />
                <Text style={[styles.btnText, { color: Colors.error }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.success }]} onPress={() => handleSave(item)}>
                <MaterialCommunityIcons name="check" size={16} color={Colors.textInverse} />
                <Text style={[styles.btnText, { color: Colors.textInverse }]}>Save Order</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.gold }]} onPress={() => handlePrint(item)} disabled={isBusy}>
                <MaterialCommunityIcons name="printer-outline" size={16} color={Colors.textInverse} />
                <Text style={[styles.btnText, { color: Colors.textInverse }]}>{isBusy ? '...' : 'Print'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.goldOverlay, borderWidth: 1, borderColor: Colors.gold }]} onPress={() => handlePDF(item)} disabled={isBusy}>
                <MaterialCommunityIcons name="file-pdf-box" size={16} color={Colors.gold} />
                <Text style={[styles.btnText, { color: Colors.gold }]}>PDF Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.errorBg, flex: 0, paddingHorizontal: 16 }]} onPress={() => handleDelete(item)}>
                <MaterialCommunityIcons name="trash-can-outline" size={16} color={Colors.error} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusTabs}>
        <TouchableOpacity style={[styles.statusTab, statusFilter === 'pending' && styles.statusTabActive]} onPress={() => setStatusFilter('pending')}>
          <Text style={[styles.statusTabText, statusFilter === 'pending' && styles.statusTabTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statusTab, statusFilter === 'saved' && styles.statusTabActive]} onPress={() => setStatusFilter('saved')}>
          <Text style={[styles.statusTabText, statusFilter === 'saved' && styles.statusTabTextActive]}>Saved</Text>
        </TouchableOpacity>
      </View>

      {takeOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="clipboard-text-off-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Orders Found</Text>
        </View>
      ) : (
        <FlatList
          data={takeOrders}
          keyExtractor={item => item.id.toString()}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  statusTabs: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  statusTab: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  statusTabActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  statusTabText: { ...Typography.bodyMedium, color: Colors.textPrimary },
  statusTabTextActive: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold' },
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
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
  },
  btnText: { fontFamily: 'Poppins-SemiBold', fontSize: 13 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  emptyTitle: { ...Typography.heading3, marginTop: Spacing.lg },
});

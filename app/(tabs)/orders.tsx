import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, Modal, TouchableWithoutFeedback,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { getAllOrders, getOrderById, deleteOrder, getOrderStats, Order, incrementPrintCount } from '../../src/db/ordersDB';
import { getAllSettings } from '../../src/db/settingsDB';
import { printReceipt, sharePDF } from '../../src/utils/printUtils';
import { formatCurrency } from '../../src/utils/currencyUtils';
import printerService from '../../src/services/printerService';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';

export default function OrdersScreen() {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total_orders: 0, total_revenue: 0, today_orders: 0, today_revenue: 0 });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);
  
  // Date filter state
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  const loadOrders = useCallback(() => {
    setAllOrders(getAllOrders());
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

  const changeDate = (days: number) => {
    setFilterDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
  };

  const onDayPress = (day: any) => {
    setFilterDate(new Date(day.timestamp));
    setShowCalendar(false);
  };

  const isSameDay = (d1: Date, dateStr: string) => {
    const d2 = new Date(dateStr);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const isToday = isSameDay(filterDate, new Date().toISOString());

  const displayedOrders = allOrders.filter(o => isSameDay(filterDate, o.created_at));
  
  const filteredRevenue = displayedOrders.reduce((sum, o) => sum + o.grand_total, 0);
  const filteredCount = displayedOrders.length;

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
    const full = getOrderById(order.id);
    if (!full || !full.items) return;
    const settings = getAllSettings();

    // Check if a printer is already connected or saved
    if (!printerService.connected && !printerService.currentPrinter) {
      Alert.alert(
        "Printer Not Connected",
        "You haven't selected a Bluetooth printer yet. Would you like to go to Settings or use standard PDF print?",
        [
          { text: "Go to Settings", onPress: () => router.push('/settings') },
          { 
            text: "Standard Print", 
            onPress: async () => {
              setPrintingId(order.id);
              try {
                await printReceipt(full, full.items, settings);
              } catch (e: any) {
                Alert.alert('Print Error', e.message);
              } finally {
                setPrintingId(null);
              }
            } 
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    setPrintingId(order.id);
    try {
      const success = await printReceipt(full, full.items, settings);
      if (success) {
        incrementPrintCount(order.id);
        loadOrders();
      }
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
      const success = await sharePDF(full, full.items, settings);
      if (success) {
        incrementPrintCount(order.id);
        loadOrders();
      }
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
            <Text style={styles.orderTotal}>{formatCurrency(item.grand_total)}</Text>
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
          <View style={[styles.metaChip, { backgroundColor: Colors.infoBg }]}>
            <MaterialCommunityIcons name="printer" size={12} color={Colors.info} />
            <Text style={[styles.metaText, { color: Colors.info, fontFamily: 'Poppins-Medium' }]}>Prints: {item.print_count || 0}</Text>
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
                <Text style={styles.orderItemSubtotal}>{formatCurrency(oi.subtotal)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            {item.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={[styles.totalValue, { color: Colors.error }]}>- {formatCurrency(item.discount)}</Text>
              </View>
            )}

            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(item.grand_total)}</Text>
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

  const selectedDateStr = `${filterDate.getFullYear()}-${String(filterDate.getMonth() + 1).padStart(2, '0')}-${String(filterDate.getDate()).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.contentWrapper}>
        {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
      </View>

      {/* Date Filter */}
      <View style={styles.dateFilterContainer}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(-1)}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.dateCenterBtn} 
          onPress={() => setShowCalendar(true)}
        >
          <MaterialCommunityIcons name="calendar-month" size={18} color={Colors.gold} />
          <Text style={styles.dateText}>
            {isToday ? "Today" : filterDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(1)} disabled={isToday}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={isToday ? Colors.border : Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowCalendar(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.calendarContainer}>
                <Calendar
                  current={selectedDateStr}
                  onDayPress={onDayPress}
                  maxDate={new Date().toISOString().split('T')[0]}
                  theme={{
                    todayTextColor: Colors.gold,
                    selectedDayBackgroundColor: Colors.gold,
                    selectedDayTextColor: Colors.white,
                    arrowColor: Colors.gold,
                  }}
                  markedDates={{
                    [selectedDateStr]: { selected: true, selectedColor: Colors.gold }
                  }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCurrency(filteredRevenue)}</Text>
          <Text style={styles.statLabel}>Day's Sales</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMiddle]}>
          <Text style={styles.statValue}>{filteredCount}</Text>
          <Text style={styles.statLabel}>Day's Orders</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCurrency(stats.total_revenue)}</Text>
          <Text style={styles.statLabel}>All-Time Rev</Text>
        </View>
      </View>

      {/* Orders List */}
      {displayedOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="receipt" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Orders Found</Text>
          <Text style={styles.emptySubtitle}>There are no orders for this date</Text>
        </View>
      ) : (
        <FlatList
          data={displayedOrders}
          keyExtractor={item => item.id.toString()}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
          showsVerticalScrollIndicator={false}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrapper: { flex: 1, maxWidth: 800, width: '100%', alignSelf: 'center' },
  header: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { ...Typography.heading2 },
  
  dateFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  dateBtn: {
    padding: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  calendarContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.card,
  },
});

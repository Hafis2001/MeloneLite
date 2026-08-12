import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, Modal, TouchableWithoutFeedback, useWindowDimensions, ScrollView
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { getAllOrders, getOrderById, deleteOrder, getOrderStats, Order, incrementPrintCount, getAdvancedReportStats, getTopMovedItems, AdvancedStats } from '../../src/db/ordersDB';
import { getAllSettings } from '../../src/db/settingsDB';
import { printReceipt, sharePDF, shareReportPDF } from '../../src/utils/printUtils';
import { getTakeOrderAdvancedReportStats, getTakeOrderTopMovedItems } from '../../src/db/takeOrdersDB';
import { formatCurrency } from '../../src/utils/currencyUtils';
import printerService from '../../src/services/printerService';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../src/constants/theme';
import { DualText } from '../../src/components/DualText';
import { t } from '../../src/utils/translations';
import { useThemeVersion, useActiveLanguage } from '../../src/context/ThemeContext';
import { TakeOrdersReport } from '../../src/components/TakeOrdersReport';

export default function OrdersScreen() {
  const themeVersion = useThemeVersion();
  const lang = useActiveLanguage();
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const [mainTab, setMainTab] = useState<'Sales' | 'Orders'>('Sales');
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total_orders: 0, total_revenue: 0, today_orders: 0, today_revenue: 0 });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);
  
  // Date filter state
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  // Advanced Reports state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [reportType, setReportType] = useState<'today' | 'date-wise' | 'monthly' | 'overall'>('overall');
  const [advancedFilterDate, setAdvancedFilterDate] = useState<Date>(new Date());
  const [showAdvancedCalendar, setShowAdvancedCalendar] = useState(false);
  const [advancedStats, setAdvancedStats] = useState<AdvancedStats | null>(null);
  const [topItems, setTopItems] = useState<{ item_name: string; total_quantity: number; total_revenue: number }[]>([]);

  const { width, height } = useWindowDimensions();
  const isLandscapePhone = width > height && width < 1024;
  
  const loadAdvancedReports = useCallback(() => {
    let sDate: string | undefined;
    let eDate: string | undefined;
    
    if (reportType === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      sDate = todayStr;
      eDate = todayStr;
    } else if (reportType === 'date-wise') {
      const dStr = advancedFilterDate.toISOString().split('T')[0];
      sDate = dStr;
      eDate = dStr;
    } else if (reportType === 'monthly') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      sDate = firstDay.toISOString().split('T')[0];
      eDate = lastDay.toISOString().split('T')[0];
    }
    
    if (mainTab === 'Orders') {
      setAdvancedStats(getTakeOrderAdvancedReportStats(sDate, eDate));
      setTopItems(getTakeOrderTopMovedItems(20, sDate, eDate));
    } else {
      setAdvancedStats(getAdvancedReportStats(sDate, eDate));
      setTopItems(getTopMovedItems(20, sDate, eDate));
    }
  }, [reportType, advancedFilterDate, mainTab]);

  // Hook to reload when opened or changed
  useFocusEffect(useCallback(() => {
    if (showAdvanced) loadAdvancedReports();
  }, [showAdvanced, reportType, advancedFilterDate, mainTab, loadAdvancedReports]));

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
  
  let filteredCash = 0;
  let filteredUPI = 0;
  let filteredCard = 0;
  displayedOrders.forEach(o => {
    if (o.is_split_payment) {
      filteredCash += (o.cash_amount || 0);
      filteredUPI += (o.upi_amount || 0);
    } else {
      if (o.payment_method === 'Cash') filteredCash += o.grand_total;
      else if (o.payment_method === 'UPI') filteredUPI += o.grand_total;
      else if (o.payment_method === 'Card') filteredCard += o.grand_total;
    }
  });

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
                await printReceipt(full, full.items || [], settings);
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

  const handleShareReport = async () => {
    if (!advancedStats) return;
    try {
      const settings = getAllSettings();
      let title = 'All Time Report';
      if (reportType === 'today') title = 'Today\'s Report';
      if (reportType === 'date-wise') title = `Report for ${advancedFilterDate.toLocaleDateString()}`;
      if (reportType === 'monthly') title = `Monthly Report (${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })})`;

      await shareReportPDF(advancedStats, topItems, settings, title);
    } catch (e: any) {
      Alert.alert('PDF Error', e?.message ?? 'Could not generate report PDF');
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
          <TouchableOpacity
            style={styles.printBtn}
            onPress={() => handlePrint(item)}
            disabled={isBusy}
          >
            <MaterialCommunityIcons name="printer-outline" size={16} color={Colors.textInverse} />
            <Text style={styles.printBtnText}>{isBusy ? t('Printing...', lang) : <DualText text="Print" />}</Text>
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
    <SafeAreaView style={styles.container} edges={isLandscapePhone ? ['left', 'right'] : ['top']}>
      <View style={[styles.contentWrapper, isLandscapePhone && { paddingHorizontal: Spacing.xl }]}>
        {/* Header */}
      <View style={[styles.header, isLandscapePhone && styles.headerLandscape]}>
        <View style={styles.mainTabs}>
          <TouchableOpacity style={[styles.mainTab, mainTab === 'Sales' && styles.mainTabActive]} onPress={() => { setMainTab('Sales'); loadOrders(); }}>
            <DualText text="Sales" style={[styles.mainTabText, mainTab === 'Sales' && styles.mainTabTextActive]} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mainTab, mainTab === 'Orders' && styles.mainTabActive]} onPress={() => setMainTab('Orders')}>
            <DualText text="Orders" style={[styles.mainTabText, mainTab === 'Orders' && styles.mainTabTextActive]} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.detailedReportsBtn} 
          onPress={() => { setShowAdvanced(true); loadAdvancedReports(); }}
        >
          <MaterialCommunityIcons name="chart-bar" size={16} color={Colors.gold} />
          <DualText text="DETAILED REPORT" style={styles.detailedReportsText} />
        </TouchableOpacity>
      </View>

      {mainTab === 'Orders' ? (
        <TakeOrdersReport />
      ) : (
        <>


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
          <DualText text="No Orders Found" style={styles.emptyTitle} />
          <DualText text="No orders for this period." style={styles.emptySubtitle} />
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
        </>
      )}

      <Modal visible={showAdvanced} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detailed Reports</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={handleShareReport} style={styles.headerPdfBtn}>
                <MaterialCommunityIcons name="file-pdf-box" size={18} color={Colors.gold} />
                <Text style={styles.pdfBtnText}>Share PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAdvanced(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.reportTypeTabs}>
            <TouchableOpacity 
              style={[styles.reportTab, reportType === 'today' && styles.reportTabActive]}
              onPress={() => setReportType('today')}
            >
              <Text style={[styles.reportTabText, reportType === 'today' && styles.reportTabTextActive]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.reportTab, reportType === 'date-wise' && styles.reportTabActive]}
              onPress={() => setReportType('date-wise')}
            >
              <Text style={[styles.reportTabText, reportType === 'date-wise' && styles.reportTabTextActive]}>Selected Date</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.reportTab, reportType === 'monthly' && styles.reportTabActive]}
              onPress={() => setReportType('monthly')}
            >
              <Text style={[styles.reportTabText, reportType === 'monthly' && styles.reportTabTextActive]}>This Month</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.reportTab, reportType === 'overall' && styles.reportTabActive]}
              onPress={() => setReportType('overall')}
            >
              <Text style={[styles.reportTabText, reportType === 'overall' && styles.reportTabTextActive]}>All Time</Text>
            </TouchableOpacity>
          </View>

          {reportType === 'date-wise' && (
            <View style={[styles.dateFilterContainer, { paddingHorizontal: Spacing.lg, marginTop: Spacing.sm }]}>
              <TouchableOpacity 
                style={[styles.dateCenterBtn, { flex: 1, justifyContent: 'center' }]} 
                onPress={() => setShowAdvancedCalendar(true)}
              >
                <MaterialCommunityIcons name="calendar-month" size={18} color={Colors.gold} />
                <Text style={styles.dateText}>
                  {advancedFilterDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          <Modal visible={showAdvancedCalendar} transparent animationType="fade">
            <TouchableWithoutFeedback onPress={() => setShowAdvancedCalendar(false)}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                  <View style={styles.calendarContainer}>
                    <Calendar
                      current={`${advancedFilterDate.getFullYear()}-${String(advancedFilterDate.getMonth() + 1).padStart(2, '0')}-${String(advancedFilterDate.getDate()).padStart(2, '0')}`}
                      onDayPress={(day: any) => {
                        setAdvancedFilterDate(new Date(day.timestamp));
                        setShowAdvancedCalendar(false);
                      }}
                      maxDate={new Date().toISOString().split('T')[0]}
                      theme={{
                        todayTextColor: Colors.gold,
                        selectedDayBackgroundColor: Colors.gold,
                        selectedDayTextColor: Colors.white,
                        arrowColor: Colors.gold,
                      }}
                      markedDates={{
                        [`${advancedFilterDate.getFullYear()}-${String(advancedFilterDate.getMonth() + 1).padStart(2, '0')}-${String(advancedFilterDate.getDate()).padStart(2, '0')}`]: { selected: true, selectedColor: Colors.gold }
                      }}
                    />
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {advancedStats && (
            <FlatList
              data={topItems}
              keyExtractor={(item, index) => `${item.item_name}-${index}`}
              ListHeaderComponent={
                <View style={styles.advancedStatsContainer}>
                  <Text style={styles.sectionTitle}>Key Metrics</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{advancedStats.totalBills}</Text>
                      <Text style={styles.statLabel}>Total Bills</Text>
                    </View>
                    <View style={[styles.statCard, styles.statCardMiddle]}>
                      <Text style={[styles.statValue, { color: Colors.gold }]}>{formatCurrency(advancedStats.totalRevenue)}</Text>
                      <Text style={styles.statLabel}>Total Revenue</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionTitle}>Payment Breakdown</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={[styles.statValue, { color: Colors.success, fontSize: 16 }]}>{formatCurrency(advancedStats.cashRevenue)}</Text>
                      <Text style={styles.statLabel}>Cash</Text>
                    </View>
                    <View style={[styles.statCard, styles.statCardMiddle]}>
                      <Text style={[styles.statValue, { color: Colors.info, fontSize: 16 }]}>{formatCurrency(advancedStats.upiRevenue)}</Text>
                      <Text style={styles.statLabel}>UPI</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={[styles.statValue, { color: Colors.gold, fontSize: 16 }]}>{formatCurrency(advancedStats.cardRevenue)}</Text>
                      <Text style={styles.statLabel}>Card</Text>
                    </View>
                  </View>

                  <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Top Moved Items</Text>
                  {topItems.length === 0 && (
                    <Text style={styles.emptySubtitle}>No items sold in this period.</Text>
                  )}
                </View>
              }
              renderItem={({ item, index }) => (
                <View style={styles.topItemRow}>
                  <View style={styles.topItemRank}>
                    <Text style={styles.topItemRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.topItemInfo}>
                    <Text style={styles.topItemName}>{item.item_name}</Text>
                    <Text style={styles.topItemRevenue}>{formatCurrency(item.total_revenue)}</Text>
                  </View>
                  <View style={styles.topItemQtyBadge}>
                    <Text style={styles.topItemQtyText}>{item.total_quantity} sold</Text>
                  </View>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: Spacing.xxxl }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={showAdvanced} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detailed Reports</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={handleShareReport} style={styles.headerPdfBtn}>
                <MaterialCommunityIcons name="file-pdf-box" size={18} color={Colors.gold} />
                <Text style={styles.pdfBtnText}>Share PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAdvanced(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.reportTypeTabs}>
            <TouchableOpacity 
              style={[styles.reportTab, reportType === 'today' && styles.reportTabActive]}
              onPress={() => setReportType('today')}
            >
              <Text style={[styles.reportTabText, reportType === 'today' && styles.reportTabTextActive]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.reportTab, reportType === 'date-wise' && styles.reportTabActive]}
              onPress={() => setReportType('date-wise')}
            >
              <Text style={[styles.reportTabText, reportType === 'date-wise' && styles.reportTabTextActive]}>Selected Date</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.reportTab, reportType === 'monthly' && styles.reportTabActive]}
              onPress={() => setReportType('monthly')}
            >
              <Text style={[styles.reportTabText, reportType === 'monthly' && styles.reportTabTextActive]}>This Month</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.reportTab, reportType === 'overall' && styles.reportTabActive]}
              onPress={() => setReportType('overall')}
            >
              <Text style={[styles.reportTabText, reportType === 'overall' && styles.reportTabTextActive]}>All Time</Text>
            </TouchableOpacity>
          </View>

          {reportType === 'date-wise' && (
            <View style={[styles.dateFilterContainer, { paddingHorizontal: Spacing.lg, marginTop: Spacing.sm }]}>
              <TouchableOpacity 
                style={[styles.dateCenterBtn, { flex: 1, justifyContent: 'center' }]} 
                onPress={() => setShowAdvancedCalendar(true)}
              >
                <MaterialCommunityIcons name="calendar-month" size={18} color={Colors.gold} />
                <Text style={styles.dateText}>
                  {advancedFilterDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          <Modal visible={showAdvancedCalendar} transparent animationType="fade">
            <TouchableWithoutFeedback onPress={() => setShowAdvancedCalendar(false)}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                  <View style={styles.calendarContainer}>
                    <Calendar
                      current={`${advancedFilterDate.getFullYear()}-${String(advancedFilterDate.getMonth() + 1).padStart(2, '0')}-${String(advancedFilterDate.getDate()).padStart(2, '0')}`}
                      onDayPress={(day: any) => {
                        setAdvancedFilterDate(new Date(day.timestamp));
                        setShowAdvancedCalendar(false);
                      }}
                      maxDate={new Date().toISOString().split('T')[0]}
                      theme={{
                        todayTextColor: Colors.gold,
                        selectedDayBackgroundColor: Colors.gold,
                        selectedDayTextColor: Colors.white,
                        arrowColor: Colors.gold,
                      }}
                      markedDates={{
                        [`${advancedFilterDate.getFullYear()}-${String(advancedFilterDate.getMonth() + 1).padStart(2, '0')}-${String(advancedFilterDate.getDate()).padStart(2, '0')}`]: { selected: true, selectedColor: Colors.gold }
                      }}
                    />
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {advancedStats && (
            <FlatList
              data={topItems}
              keyExtractor={(item, index) => `${item.item_name}-${index}`}
              ListHeaderComponent={
                <View style={styles.advancedStatsContainer}>
                  <Text style={styles.sectionTitle}>Key Metrics</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{advancedStats.totalBills}</Text>
                      <Text style={styles.statLabel}>Total Bills</Text>
                    </View>
                    <View style={[styles.statCard, styles.statCardMiddle]}>
                      <Text style={[styles.statValue, { color: Colors.gold }]}>{formatCurrency(advancedStats.totalRevenue)}</Text>
                      <Text style={styles.statLabel}>Total Revenue</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionTitle}>Payment Breakdown</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={[styles.statValue, { color: Colors.success, fontSize: 16 }]}>{formatCurrency(advancedStats.cashRevenue)}</Text>
                      <Text style={styles.statLabel}>Cash</Text>
                    </View>
                    <View style={[styles.statCard, styles.statCardMiddle]}>
                      <Text style={[styles.statValue, { color: Colors.info, fontSize: 16 }]}>{formatCurrency(advancedStats.upiRevenue)}</Text>
                      <Text style={styles.statLabel}>UPI</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={[styles.statValue, { color: Colors.gold, fontSize: 16 }]}>{formatCurrency(advancedStats.cardRevenue)}</Text>
                      <Text style={styles.statLabel}>Card</Text>
                    </View>
                  </View>

                  <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Top Moved Items</Text>
                  {topItems.length === 0 && (
                    <Text style={styles.emptySubtitle}>No items sold in this period.</Text>
                  )}
                </View>
              }
              renderItem={({ item, index }) => (
                <View style={styles.topItemRow}>
                  <View style={styles.topItemRank}>
                    <Text style={styles.topItemRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.topItemInfo}>
                    <Text style={styles.topItemName}>{item.item_name}</Text>
                    <Text style={styles.topItemRevenue}>{formatCurrency(item.total_revenue)}</Text>
                  </View>
                  <View style={styles.topItemQtyBadge}>
                    <Text style={styles.topItemQtyText}>{item.total_quantity} sold</Text>
                  </View>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: Spacing.xxxl }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

function createStyles() {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrapper: { flex: 1, width: '100%', alignSelf: 'center' },
  header: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  headerLandscape: { paddingVertical: Spacing.sm },
  headerTitle: { ...Typography.heading2 },
  mainTabs: { flexDirection: 'row', gap: Spacing.sm },
  mainTab: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  mainTabActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  mainTabText: { ...Typography.bodyMedium, color: Colors.textPrimary },
  mainTabTextActive: { color: Colors.textInverse },
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
  headerPdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.goldOverlay, borderRadius: Radius.full, 
    paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.gold,
    marginRight: 12,
  },
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
  detailedReportsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.goldOverlay,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gold,
  },
  detailedReportsText: { ...Typography.bodyMedium, color: Colors.gold },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { ...Typography.heading2 },
  closeBtn: { padding: Spacing.xs },
  reportTypeTabs: {
    flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  reportTab: {
    flexBasis: '48%', alignItems: 'center', paddingVertical: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  reportTabActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  reportTabText: { ...Typography.bodyMedium, color: Colors.textPrimary },
  reportTabTextActive: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold' },
  advancedStatsContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  sectionTitle: { ...Typography.heading3, marginBottom: Spacing.md },
  topItemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  topItemRank: { width: 30, alignItems: 'center', justifyContent: 'center' },
  topItemRankText: { ...Typography.heading4, color: Colors.gold },
  topItemInfo: { flex: 1, paddingLeft: Spacing.sm },
  topItemName: { ...Typography.bodyMedium },
  topItemRevenue: { ...Typography.caption, color: Colors.textMuted },
  topItemQtyBadge: {
    backgroundColor: Colors.surface, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  topItemQtyText: { ...Typography.caption, color: Colors.gold },
  });
}

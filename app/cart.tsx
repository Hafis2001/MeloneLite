import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, useWindowDimensions,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { router, useSegments } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../src/context/CartContext';
import { placeOrder, getOrderById, incrementPrintCount } from '../src/db/ordersDB';
import { getSetting, getAllSettings } from '../src/db/settingsDB';
import { printReceipt } from '../src/utils/printUtils';
import printerService from '../src/services/printerService';
import { formatCurrency } from '../src/utils/currencyUtils';
import { Colors, Spacing, Radius, Typography, Shadows } from '../src/constants/theme';
import { DualText } from '../src/components/DualText';
import { useActiveLanguage } from '../src/context/ThemeContext';
import { t } from '../src/utils/translations';

import { useThemeVersion } from '../src/context/ThemeContext';
import { syncOrders } from '../backgroundSync';

const PAYMENT_METHODS = ['Cash', 'Card', 'UPI'];

export default function CartScreen() {
  const themeVersion = useThemeVersion();
  const segments = useSegments();
  const isStandalone = segments.includes('cart');
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const {
    state, removeItem, updateQuantity, clearCart,
    setCustomerName, setTableNo, setPaymentMethod, setNotes, setDiscount,
    setSplitPayment, setCashAmount, setUpiAmount,
    getSubtotal,
  } = useCart();

  const [placing, setPlacing] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [lastOrderTotal, setLastOrderTotal] = useState<number>(0);
  const lang = useActiveLanguage();

  const { width, height } = useWindowDimensions();
  const isLandscapePhone = width > height && width < 1024;

  const subtotal = getSubtotal();
  const discountAmt = Math.max(0, Math.min(state.discount, subtotal));
  const grandTotal = parseFloat((subtotal - discountAmt).toFixed(2));

  const handleDirectPrint = async (orderId: number) => {
    const full = getOrderById(orderId);
    if (!full || !full.items) return;
    const settings = getAllSettings();

    if (!printerService.connected && !printerService.currentPrinter) {
      Alert.alert(
        "Printer Not Connected",
        "You haven't selected a Bluetooth printer yet. Would you like to go to Settings or use standard PDF print?",
        [
          { text: "Go to Settings", onPress: () => { router.dismiss(); router.push('/settings'); } },
          { 
            text: "Standard Print", 
            onPress: async () => {
              try {
                await printReceipt(full, full.items || [], settings);
              } catch (e: any) {
                Alert.alert('Print Error', e.message);
              }
            } 
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    try {
      const success = await printReceipt(full, full.items || [], settings);
      if (success) {
        incrementPrintCount(orderId);
      }
    } catch (e: any) {
      Alert.alert('Print Error', e?.message ?? 'Could not print');
    }
  };

  const handlePlaceOrder = async () => {
    if (state.items.length === 0) {
      Alert.alert('Empty Cart', 'Add items to cart before placing order');
      return;
    }
    setPlacing(true);
    try {
      const orderItems = state.items.map(ci => ({
        item_id: ci.item.id,
        item_code: ci.item.item_code,
        item_name: ci.selectedVariant ? `${ci.item.item_name} — ${ci.selectedVariant.name}` : ci.item.item_name,
        rate: ci.selectedVariant ? ci.selectedVariant.price : ci.item.rate,
        quantity: ci.quantity,
        subtotal: parseFloat(((ci.selectedVariant ? ci.selectedVariant.price : ci.item.rate) * ci.quantity).toFixed(2)),
      }));
      const orderId = placeOrder(
        {
          customer_name: state.customerName,
          table_no: state.tableNo,
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          discount: discountAmt,
          grand_total: grandTotal,
          payment_method: state.isSplitPayment ? 'Split' : state.paymentMethod,
          notes: state.notes,
          is_split_payment: state.isSplitPayment ? 1 : 0,
          cash_amount: state.isSplitPayment ? state.cashAmount : (state.paymentMethod === 'Cash' ? grandTotal : 0),
          upi_amount: state.isSplitPayment ? state.upiAmount : (state.paymentMethod === 'UPI' ? grandTotal : 0),
        },
        orderItems
      );
      setLastOrderId(orderId);
      setLastOrderTotal(grandTotal);
      setSuccessModalVisible(true);
      // Attempt to sync immediately in the background
      syncOrders().catch(() => {});
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={isLandscapePhone ? ['left', 'right'] : ['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.contentWrapper, isLandscapePhone && { paddingHorizontal: Spacing.xl }]}>
          {/* Header */}
        <View style={[styles.header, isLandscapePhone && styles.headerLandscape]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => { if (isStandalone && router.canGoBack()) router.back(); }}>
            <MaterialCommunityIcons name="chevron-down" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Order</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <TouchableOpacity onPress={() => setCustomerModalVisible(true)} style={styles.headerIconBtn}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={24} color={Colors.gold} />
            </TouchableOpacity>
            {state.items.length > 0 && (
              <TouchableOpacity onPress={() => Alert.alert('Clear Cart', 'Remove all items?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: clearCart },
              ])} style={styles.headerIconBtn}>
                <MaterialCommunityIcons name="trash-can-outline" size={24} color={Colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {/* Empty state */}
          {state.items.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="cart-off" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Cart is Empty</Text>
              <Text style={styles.emptySubtitle}>Add items from the Menu tab</Text>
            </View>
          ) : (
            <>
              {/* Cart Items (Scrollable) */}
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }} showsVerticalScrollIndicator={false}>
                <View style={[styles.section, { marginBottom: Spacing.md }]}>
                {state.items.map(ci => (
                  <View key={ci.cartItemId} style={styles.cartItem}>
                    <View style={styles.cartItemTopRow}>
                      <Text style={styles.cartItemName} numberOfLines={1}>
                        {ci.item.item_name}
                        {ci.selectedVariant ? ` — ${ci.selectedVariant.name}` : ''}
                      </Text>
                      <TouchableOpacity onPress={() => removeItem(ci.cartItemId)} style={styles.removeBtn}>
                        <MaterialCommunityIcons name="close" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.cartItemBottomRow}>
                      <Text style={styles.cartItemRate}>{formatCurrency(ci.selectedVariant ? ci.selectedVariant.price : ci.item.rate)}</Text>
                      <View style={styles.qtyControls}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(ci.cartItemId, ci.quantity - 1)}>
                          <MaterialCommunityIcons name="minus" size={14} color={Colors.gold} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{ci.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(ci.cartItemId, ci.quantity + 1)}>
                          <MaterialCommunityIcons name="plus" size={14} color={Colors.gold} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.cartItemSubtotal}>{formatCurrency((ci.selectedVariant ? ci.selectedVariant.price : ci.item.rate) * ci.quantity)}</Text>
                    </View>
                  </View>
                ))}
                </View>
              </ScrollView>

              {/* Fixed Bottom Container */}
              <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm }}>
                
                {state.isSplitPayment && (
                  <View style={[styles.section, { paddingVertical: Spacing.sm, marginBottom: Spacing.sm }]}>
                    <View style={styles.splitInputContainer}>
                      <View style={styles.splitInputBox}>
                        <Text style={styles.splitLabel}>Cash Amount</Text>
                        <View style={styles.inputGroup}>
                          <MaterialCommunityIcons name="cash" size={18} color={Colors.gold} />
                          <TextInput 
                            style={styles.input} 
                            placeholder="0.00" 
                            keyboardType="decimal-pad"
                            value={state.cashAmount > 0 ? state.cashAmount.toString() : ''}
                            onChangeText={v => {
                              const val = parseFloat(v) || 0;
                              setCashAmount(val);
                              setUpiAmount(Math.max(0, grandTotal - val));
                            }}
                          />
                        </View>
                      </View>
                      <View style={styles.splitInputBox}>
                        <Text style={styles.splitLabel}>UPI Amount</Text>
                        <View style={styles.inputGroup}>
                          <MaterialCommunityIcons name="cellphone-nfc" size={18} color={Colors.gold} />
                          <TextInput 
                            style={styles.input} 
                            placeholder="0.00" 
                            keyboardType="decimal-pad"
                            value={state.upiAmount > 0 ? state.upiAmount.toString() : ''}
                            onChangeText={v => {
                              const val = parseFloat(v) || 0;
                              setUpiAmount(val);
                              setCashAmount(Math.max(0, grandTotal - val));
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                )}

              <View style={[styles.section, { marginBottom: 0, paddingVertical: Spacing.sm }]}>
                <Text style={styles.sectionTitle}>Bill Summary</Text>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Subtotal</Text>
                  <Text style={styles.billValue}>{formatCurrency(subtotal)}</Text>
                </View>
                {discountAmt > 0 && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Discount</Text>
                    <Text style={[styles.billValue, { color: Colors.error }]}>- {formatCurrency(discountAmt)}</Text>
                  </View>
                )}
                
                <View style={[styles.billRow, { marginVertical: 4, alignItems: 'center' }]}>
                  <Text style={styles.billLabel}>Payment</Text>
                  <TouchableOpacity 
                    style={[styles.paymentDropdownBtn, { paddingVertical: 4, paddingHorizontal: 8 }]}
                    onPress={() => setPaymentModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.paymentDropdownText, { fontSize: 12 }]}>{state.isSplitPayment ? 'Split' : state.paymentMethod}</Text>
                    <MaterialCommunityIcons name="chevron-down" size={14} color={Colors.textInverse} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.billRow, styles.grandRow, { marginTop: 4, paddingTop: 6 }]}>
                  <Text style={styles.grandLabel}>Grand Total</Text>
                  <Text style={styles.grandValue}>{formatCurrency(grandTotal)}</Text>
                </View>
              </View>
              </View>
            </>
          )}

        {/* Place Order Button */}
        {state.items.length > 0 && (
          <View style={[styles.footer, { paddingHorizontal: Spacing.lg, paddingBottom: 16 }]}>
            <TouchableOpacity
              style={[styles.placeOrderBtn, placing && { opacity: 0.7 }]}
              onPress={handlePlaceOrder}
              disabled={placing}
              activeOpacity={0.88}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={22} color={Colors.textInverse} />
              {placing ? (
                <Text style={styles.placeOrderText}>Saving...</Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.placeOrderText}>Save</Text>
                  <Text style={styles.placeOrderText}>  •  {formatCurrency(grandTotal)}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
        </View>
      </View>

        {/* Modals */}
        <Modal visible={customerModalVisible} transparent animationType="fade" onRequestClose={() => setCustomerModalVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setCustomerModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Order Details</Text>
                    <TouchableOpacity onPress={() => setCustomerModalVisible(false)}>
                      <MaterialCommunityIcons name="close" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <MaterialCommunityIcons name="account-outline" size={18} color={Colors.gold} />
                    <TextInput style={styles.input} placeholder="Customer Name (optional)"
                      placeholderTextColor={Colors.textMuted} value={state.customerName}
                      onChangeText={setCustomerName} />
                  </View>
                  <View style={[styles.inputGroup, { marginTop: Spacing.sm }]}>
                    <MaterialCommunityIcons name="table-chair" size={18} color={Colors.gold} />
                    <TextInput style={styles.input} placeholder="Table No. (optional)"
                      placeholderTextColor={Colors.textMuted} value={state.tableNo}
                      onChangeText={setTableNo} keyboardType="numeric" />
                  </View>
                  <View style={[styles.inputGroup, { marginTop: Spacing.sm }]}>
                    <MaterialCommunityIcons name="tag-outline" size={18} color={Colors.gold} />
                    <TextInput style={styles.input} placeholder="Discount amount"
                      placeholderTextColor={Colors.textMuted}
                      value={state.discount > 0 ? state.discount.toString() : ''}
                      onChangeText={v => setDiscount(parseFloat(v) || 0)}
                      keyboardType="decimal-pad" />
                  </View>
                  <View style={[styles.inputGroup, { marginTop: Spacing.sm }]}>
                    <MaterialCommunityIcons name="note-text-outline" size={18} color={Colors.gold} />
                    <TextInput style={styles.input} placeholder="Notes (optional)"
                      placeholderTextColor={Colors.textMuted} value={state.notes}
                      onChangeText={setNotes} />
                  </View>

                  <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setCustomerModalVisible(false)}>
                    <Text style={styles.modalDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <Modal visible={paymentModalVisible} transparent animationType="fade" onRequestClose={() => setPaymentModalVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setPaymentModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select Payment Method</Text>
                    <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                      <MaterialCommunityIcons name="close" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  {PAYMENT_METHODS.map(method => (
                    <TouchableOpacity key={method}
                      style={[styles.paymentDropdownOption, state.paymentMethod === method && !state.isSplitPayment && styles.paymentDropdownOptionActive]}
                      onPress={() => {
                        setPaymentMethod(method);
                        setSplitPayment(false);
                        setPaymentModalVisible(false);
                      }}>
                      <Text style={[styles.paymentDropdownOptionText, state.paymentMethod === method && !state.isSplitPayment && styles.paymentDropdownOptionTextActive]}>{method}</Text>
                      {state.paymentMethod === method && !state.isSplitPayment && <MaterialCommunityIcons name="check" size={20} color={Colors.gold} />}
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={[styles.paymentDropdownOption, state.isSplitPayment && styles.paymentDropdownOptionActive]}
                    onPress={() => {
                      setSplitPayment(true);
                      setPaymentModalVisible(false);
                    }}>
                    <Text style={[styles.paymentDropdownOptionText, state.isSplitPayment && styles.paymentDropdownOptionTextActive]}>Split Payment</Text>
                    {state.isSplitPayment && <MaterialCommunityIcons name="check" size={20} color={Colors.gold} />}
                  </TouchableOpacity>

                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
        {/* Success Modal */}
        <Modal visible={successModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { alignItems: 'center', paddingVertical: Spacing.xxl }]}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(46, 204, 113, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md }}>
                <MaterialCommunityIcons name="check-decagram" size={36} color="#2ECC71" />
              </View>
              <Text style={{ ...Typography.heading3, color: Colors.textPrimary, marginBottom: Spacing.sm }}>Entry Saved</Text>
              <Text style={{ ...Typography.bodyMedium, color: Colors.textMuted, marginBottom: Spacing.xl }}>Grand Total: {formatCurrency(lastOrderTotal)}</Text>
              
              <View style={{ width: '100%', gap: Spacing.sm }}>
                <TouchableOpacity 
                  style={[styles.modalDoneBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.gold, marginTop: 0 }]} 
                  onPress={async () => {
                    setSuccessModalVisible(false);
                    clearCart();
                    if (isStandalone && router.canGoBack()) router.back();
                    if (lastOrderId) await handleDirectPrint(lastOrderId);
                  }}
                >
                  <Text style={[styles.modalDoneText, { color: Colors.gold }]}>Print Receipt</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalDoneBtn, { marginTop: 0 }]} 
                  onPress={() => {
                    setSuccessModalVisible(false);
                    clearCart();
                    if (isStandalone && router.canGoBack()) router.back();
                  }}
                >
                  <Text style={styles.modalDoneText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
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
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLandscape: { paddingVertical: Spacing.sm },
  backBtn: { padding: 4 },
  headerTitle: { ...Typography.heading3 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 20 },
  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg,
    marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { ...Typography.heading4, marginBottom: Spacing.md, color: Colors.gold },
  cartItem: { flexDirection: 'column', marginBottom: Spacing.md, paddingVertical: 4 },
  cartItemTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cartItemBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartItemName: { ...Typography.bodyMedium, fontSize: 14, flex: 1, marginRight: 8 },
  cartItemRate: { ...Typography.caption, flex: 1 },
  qtyControls: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, marginHorizontal: Spacing.sm,
  },
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  qtyText: { ...Typography.bodyMedium, fontSize: 13, paddingHorizontal: 6, color: Colors.gold },
  cartItemSubtotal: { ...Typography.priceSmall, width: 70, textAlign: 'right' },
  removeBtn: { padding: 6, marginLeft: 4 },
  inputGroup: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 46,
  },
  input: { flex: 1, color: Colors.textPrimary, fontFamily: 'Poppins-Regular', fontSize: 14 },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  paymentChip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  paymentChipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  paymentChipText: { ...Typography.captionMedium, fontSize: 13 },
  paymentChipTextActive: { color: Colors.textInverse },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  billLabel: { ...Typography.body, fontSize: 14 },
  billValue: { ...Typography.bodyMedium, fontSize: 14 },
  grandRow: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: Spacing.sm, marginTop: Spacing.sm, marginBottom: 0,
  },
  grandLabel: { ...Typography.heading4, color: Colors.textPrimary },
  grandValue: { ...Typography.price, fontSize: 18 },
  footer: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  placeOrderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.gold, borderRadius: Radius.lg, paddingVertical: 16, ...Shadows.button,
  },
  placeOrderText: { color: Colors.textInverse, fontFamily: 'Poppins-Bold', fontSize: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 60 },
  emptyTitle: { ...Typography.heading3, marginTop: Spacing.lg },
  emptySubtitle: { ...Typography.body, marginTop: Spacing.sm },
  collapsibleHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  summaryRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryText: {
    ...Typography.captionMedium,
    color: Colors.textMuted,
  },
  paymentHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  splitToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gold,
  },
  splitToggleActive: {
    backgroundColor: Colors.gold,
  },
  splitToggleText: {
    ...Typography.captionMedium,
    color: Colors.gold,
  },
  splitInputContainer: {
    flexDirection: 'row', gap: Spacing.md,
  },
  splitInputBox: {
    flex: 1,
  },
  splitLabel: {
    ...Typography.caption,
    marginBottom: 4,
    color: Colors.textMuted,
  },
  headerIconBtn: { padding: 4 },
  paymentDropdownBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full,
    gap: 4,
  },
  paymentDropdownText: { color: Colors.textInverse, fontFamily: 'Poppins-Medium', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.xl },
  modalCard: { backgroundColor: Colors.background, borderRadius: Radius.lg, padding: Spacing.lg, ...Shadows.card },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { ...Typography.heading4 },
  modalDoneBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginTop: Spacing.lg },
  modalDoneText: { color: Colors.textInverse, fontFamily: 'Poppins-Bold', fontSize: 15 },
  paymentDropdownOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  paymentDropdownOptionActive: { borderBottomColor: Colors.gold },
  paymentDropdownOptionText: { ...Typography.bodyMedium, color: Colors.textPrimary },
  paymentDropdownOptionTextActive: { color: Colors.gold },
  });
}

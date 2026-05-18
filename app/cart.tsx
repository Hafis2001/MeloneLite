import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../src/context/CartContext';
import { placeOrder, getOrderById, incrementPrintCount } from '../src/db/ordersDB';
import { getSetting, getAllSettings } from '../src/db/settingsDB';
import { printReceipt } from '../src/utils/printUtils';
import printerService from '../src/services/printerService';
import { formatCurrency } from '../src/utils/currencyUtils';
import { Colors, Spacing, Radius, Typography, Shadows } from '../src/constants/theme';

const PAYMENT_METHODS = ['Cash', 'Card', 'UPI', 'Wallet'];

export default function CartScreen() {
  const {
    state, removeItem, updateQuantity, clearCart,
    setCustomerName, setTableNo, setPaymentMethod, setNotes, setDiscount,
    setSplitPayment, setCashAmount, setUpiAmount,
    getSubtotal,
  } = useCart();

  const { getTotalItems } = useCart();
  const [placing, setPlacing] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

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
                await printReceipt(full, full.items, settings);
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
      const success = await printReceipt(full, full.items, settings);
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
        item_name: ci.item.item_name,
        rate: ci.item.rate,
        quantity: ci.quantity,
        subtotal: parseFloat((ci.item.rate * ci.quantity).toFixed(2)),
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
      clearCart();
      Alert.alert('Order Placed! 🎉', `Grand Total: ${formatCurrency(grandTotal)}`, [
        { 
          text: 'Print Receipt', 
          onPress: async () => {
            router.dismiss();
            await handleDirectPrint(orderId);
          }
        },
        { 
          text: 'View Orders', 
          onPress: () => { 
            router.dismiss(); 
            router.push('/(tabs)/orders'); 
          } 
        },
        { 
          text: 'OK', 
          onPress: () => router.dismiss(),
          style: 'cancel'
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.contentWrapper}>
          {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.dismiss()}>
            <MaterialCommunityIcons name="chevron-down" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Order</Text>
          {state.items.length > 0 && (
            <TouchableOpacity onPress={() => Alert.alert('Clear Cart', 'Remove all items?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: clearCart },
            ])}>
              <MaterialCommunityIcons name="trash-can-outline" size={22} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Empty state */}
          {state.items.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="cart-off" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Cart is Empty</Text>
              <Text style={styles.emptySubtitle}>Add items from the Menu tab</Text>
            </View>
          ) : (
            <>
              {/* Cart Items */}
              <View style={styles.section}>
                {state.items.map(ci => (
                  <View key={ci.item.id} style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName} numberOfLines={1}>{ci.item.item_name}</Text>
                      <Text style={styles.cartItemRate}>{formatCurrency(ci.item.rate)} each</Text>
                    </View>
                    <View style={styles.qtyControls}>
                      <TouchableOpacity style={styles.qtyBtn}
                        onPress={() => updateQuantity(ci.item.id, ci.quantity - 1)}>
                        <MaterialCommunityIcons name="minus" size={14} color={Colors.gold} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{ci.quantity}</Text>
                      <TouchableOpacity style={styles.qtyBtn}
                        onPress={() => updateQuantity(ci.item.id, ci.quantity + 1)}>
                        <MaterialCommunityIcons name="plus" size={14} color={Colors.gold} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.cartItemSubtotal}>{formatCurrency(ci.item.rate * ci.quantity)}</Text>
                    <TouchableOpacity onPress={() => removeItem(ci.item.id)} style={styles.removeBtn}>
                      <MaterialCommunityIcons name="close" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Customer Details */}
              <View style={styles.section}>
                <TouchableOpacity 
                  style={styles.collapsibleHeader} 
                  onPress={() => setDetailsExpanded(!detailsExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="clipboard-text-outline" size={20} color={Colors.gold} />
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Order Details</Text>
                  </View>
                  <MaterialCommunityIcons 
                    name={detailsExpanded ? 'chevron-up' : 'chevron-down'} 
                    size={24} color={Colors.textMuted} 
                  />
                </TouchableOpacity>

                {detailsExpanded ? (
                  <View style={{ marginTop: Spacing.md }}>
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
                  </View>
                ) : (
                  (state.customerName || state.tableNo || state.discount > 0) && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryText}>
                        {state.customerName && `${state.customerName} • `}
                        {state.tableNo && `Table ${state.tableNo} • `}
                        {state.discount > 0 && `${formatCurrency(state.discount)} Off`}
                      </Text>
                    </View>
                  )
                )}
              </View>

              {/* Payment Method */}
              <View style={styles.section}>
                <View style={styles.paymentHeader}>
                  <Text style={styles.sectionTitle}>Payment Method</Text>
                  <TouchableOpacity 
                    style={[styles.splitToggle, state.isSplitPayment && styles.splitToggleActive]}
                    onPress={() => setSplitPayment(!state.isSplitPayment)}
                  >
                    <MaterialCommunityIcons 
                      name={state.isSplitPayment ? "call-split" : "square-outline"} 
                      size={18} color={state.isSplitPayment ? Colors.textInverse : Colors.gold} 
                    />
                    <Text style={[styles.splitToggleText, state.isSplitPayment && { color: Colors.textInverse }]}>
                      Split
                    </Text>
                  </TouchableOpacity>
                </View>

                {state.isSplitPayment ? (
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
                ) : (
                  <View style={styles.paymentRow}>
                    {PAYMENT_METHODS.map(method => (
                      <TouchableOpacity key={method}
                        style={[styles.paymentChip, state.paymentMethod === method && styles.paymentChipActive]}
                        onPress={() => setPaymentMethod(method)}>
                        <Text style={[styles.paymentChipText, state.paymentMethod === method && styles.paymentChipTextActive]}>
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
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

                <View style={[styles.billRow, styles.grandRow]}>
                  <Text style={styles.grandLabel}>Grand Total</Text>
                  <Text style={styles.grandValue}>{formatCurrency(grandTotal)}</Text>
                </View>
              </View>
            </>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Place Order Button */}
        {state.items.length > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.placeOrderBtn, placing && { opacity: 0.7 }]}
              onPress={handlePlaceOrder}
              disabled={placing}
              activeOpacity={0.88}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={22} color={Colors.textInverse} />
              <Text style={styles.placeOrderText}>
                {placing ? 'Placing Order...' : `Place Order  •  ${formatCurrency(grandTotal)}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentWrapper: { flex: 1, maxWidth: 800, width: '100%', alignSelf: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...Typography.heading3 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 20 },
  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg,
    marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { ...Typography.heading4, marginBottom: Spacing.md, color: Colors.gold },
  cartItem: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  cartItemInfo: { flex: 1 },
  cartItemName: { ...Typography.bodyMedium, fontSize: 14 },
  cartItemRate: { ...Typography.caption, marginTop: 2 },
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
});

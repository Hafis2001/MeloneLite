import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { Item } from '../db/itemsDB';

export interface CartItem {
  cartItemId: string;
  item: Item;
  quantity: number;
  selectedVariant?: { name: string; price: number };
}

interface CartState {
  items: CartItem[];
  customerName: string;
  tableNo: string;
  paymentMethod: string;
  notes: string;
  discount: number;
  isSplitPayment: boolean;
  cashAmount: number;
  upiAmount: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; item: Item; selectedVariant?: { name: string; price: number } }
  | { type: 'REMOVE_ITEM'; cartItemId: string }
  | { type: 'UPDATE_QUANTITY'; cartItemId: string; quantity: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_CUSTOMER'; name: string }
  | { type: 'SET_TABLE'; tableNo: string }
  | { type: 'SET_PAYMENT'; method: string }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'SET_DISCOUNT'; discount: number }
  | { type: 'SET_SPLIT_PAYMENT'; enabled: boolean }
  | { type: 'SET_CASH_AMOUNT'; amount: number }
  | { type: 'SET_UPI_AMOUNT'; amount: number };

const initialState: CartState = {
  items: [],
  customerName: '',
  tableNo: '',
  paymentMethod: 'Cash',
  notes: '',
  discount: 0,
  isSplitPayment: false,
  cashAmount: 0,
  upiAmount: 0,
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const variantName = action.selectedVariant?.name || 'default';
      const cartItemId = `${action.item.id}-${variantName}`;
      
      const existing = state.items.find(ci => ci.cartItemId === cartItemId);
      if (existing) {
        return {
          ...state,
          items: state.items.map(ci =>
            ci.cartItemId === cartItemId
              ? { ...ci, quantity: ci.quantity + 1 }
              : ci
          ),
        };
      }
      return { 
        ...state, 
        items: [...state.items, { 
          cartItemId, 
          item: action.item, 
          quantity: 1, 
          selectedVariant: action.selectedVariant 
        }] 
      };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(ci => ci.cartItemId !== action.cartItemId) };
    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter(ci => ci.cartItemId !== action.cartItemId) };
      }
      return {
        ...state,
        items: state.items.map(ci =>
          ci.cartItemId === action.cartItemId ? { ...ci, quantity: action.quantity } : ci
        ),
      };
    }
    case 'CLEAR_CART':
      return initialState;
    case 'SET_CUSTOMER':
      return { ...state, customerName: action.name };
    case 'SET_TABLE':
      return { ...state, tableNo: action.tableNo };
    case 'SET_PAYMENT':
      return { ...state, paymentMethod: action.method };
    case 'SET_DISCOUNT':
      return { ...state, discount: action.discount };
    case 'SET_SPLIT_PAYMENT':
      return { ...state, isSplitPayment: action.enabled };
    case 'SET_CASH_AMOUNT':
      return { ...state, cashAmount: action.amount };
    case 'SET_UPI_AMOUNT':
      return { ...state, upiAmount: action.amount };
    default:
      return state;
  }
}

interface CartContextType {
  state: CartState;
  addItem: (item: Item, selectedVariant?: { name: string; price: number }) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  setCustomerName: (name: string) => void;
  setTableNo: (tableNo: string) => void;
  setPaymentMethod: (method: string) => void;
  setNotes: (notes: string) => void;
  setDiscount: (discount: number) => void;
  setSplitPayment: (enabled: boolean) => void;
  setCashAmount: (amount: number) => void;
  setUpiAmount: (amount: number) => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getItemQuantity: (itemId: number) => number;
}

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = useCallback((item: Item, selectedVariant?: { name: string; price: number }) => dispatch({ type: 'ADD_ITEM', item, selectedVariant }), []);
  const removeItem = useCallback((cartItemId: string) => dispatch({ type: 'REMOVE_ITEM', cartItemId }), []);
  const updateQuantity = useCallback((cartItemId: string, quantity: number) => dispatch({ type: 'UPDATE_QUANTITY', cartItemId, quantity }), []);
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
  const setCustomerName = useCallback((name: string) => dispatch({ type: 'SET_CUSTOMER', name }), []);
  const setTableNo = useCallback((tableNo: string) => dispatch({ type: 'SET_TABLE', tableNo }), []);
  const setPaymentMethod = useCallback((method: string) => dispatch({ type: 'SET_PAYMENT', method }), []);
  const setNotes = useCallback((notes: string) => dispatch({ type: 'SET_NOTES', notes }), []);
  const setDiscount = useCallback((discount: number) => dispatch({ type: 'SET_DISCOUNT', discount }), []);
  const setSplitPayment = useCallback((enabled: boolean) => dispatch({ type: 'SET_SPLIT_PAYMENT', enabled }), []);
  const setCashAmount = useCallback((amount: number) => dispatch({ type: 'SET_CASH_AMOUNT', amount }), []);
  const setUpiAmount = useCallback((amount: number) => dispatch({ type: 'SET_UPI_AMOUNT', amount }), []);

  const getTotalItems = useCallback(() =>
    state.items.reduce((sum, ci) => sum + ci.quantity, 0), [state.items]);

  const getSubtotal = useCallback(() =>
    state.items.reduce((sum, ci) => sum + (ci.selectedVariant ? ci.selectedVariant.price : ci.item.rate) * ci.quantity, 0), [state.items]);

  const getItemQuantity = useCallback((itemId: number) =>
    state.items.filter(ci => ci.item.id === itemId).reduce((sum, ci) => sum + ci.quantity, 0), [state.items]);

  return (
    <CartContext.Provider value={{
      state, addItem, removeItem, updateQuantity, clearCart,
      setCustomerName, setTableNo, setPaymentMethod, setNotes, setDiscount,
      setSplitPayment, setCashAmount, setUpiAmount,
      getTotalItems, getSubtotal, getItemQuantity,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

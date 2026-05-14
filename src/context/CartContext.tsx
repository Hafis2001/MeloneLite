import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { Item } from '../db/itemsDB';

export interface CartItem {
  item: Item;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  customerName: string;
  tableNo: string;
  paymentMethod: string;
  notes: string;
  discount: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; item: Item }
  | { type: 'REMOVE_ITEM'; itemId: number }
  | { type: 'UPDATE_QUANTITY'; itemId: number; quantity: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_CUSTOMER'; name: string }
  | { type: 'SET_TABLE'; tableNo: string }
  | { type: 'SET_PAYMENT'; method: string }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'SET_DISCOUNT'; discount: number };

const initialState: CartState = {
  items: [],
  customerName: '',
  tableNo: '',
  paymentMethod: 'Cash',
  notes: '',
  discount: 0,
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(ci => ci.item.id === action.item.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map(ci =>
            ci.item.id === action.item.id
              ? { ...ci, quantity: ci.quantity + 1 }
              : ci
          ),
        };
      }
      return { ...state, items: [...state.items, { item: action.item, quantity: 1 }] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(ci => ci.item.id !== action.itemId) };
    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter(ci => ci.item.id !== action.itemId) };
      }
      return {
        ...state,
        items: state.items.map(ci =>
          ci.item.id === action.itemId ? { ...ci, quantity: action.quantity } : ci
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
    case 'SET_NOTES':
      return { ...state, notes: action.notes };
    case 'SET_DISCOUNT':
      return { ...state, discount: action.discount };
    default:
      return state;
  }
}

interface CartContextType {
  state: CartState;
  addItem: (item: Item) => void;
  removeItem: (itemId: number) => void;
  updateQuantity: (itemId: number, quantity: number) => void;
  clearCart: () => void;
  setCustomerName: (name: string) => void;
  setTableNo: (tableNo: string) => void;
  setPaymentMethod: (method: string) => void;
  setNotes: (notes: string) => void;
  setDiscount: (discount: number) => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getItemQuantity: (itemId: number) => number;
}

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = useCallback((item: Item) => dispatch({ type: 'ADD_ITEM', item }), []);
  const removeItem = useCallback((itemId: number) => dispatch({ type: 'REMOVE_ITEM', itemId }), []);
  const updateQuantity = useCallback((itemId: number, quantity: number) => dispatch({ type: 'UPDATE_QUANTITY', itemId, quantity }), []);
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
  const setCustomerName = useCallback((name: string) => dispatch({ type: 'SET_CUSTOMER', name }), []);
  const setTableNo = useCallback((tableNo: string) => dispatch({ type: 'SET_TABLE', tableNo }), []);
  const setPaymentMethod = useCallback((method: string) => dispatch({ type: 'SET_PAYMENT', method }), []);
  const setNotes = useCallback((notes: string) => dispatch({ type: 'SET_NOTES', notes }), []);
  const setDiscount = useCallback((discount: number) => dispatch({ type: 'SET_DISCOUNT', discount }), []);

  const getTotalItems = useCallback(() =>
    state.items.reduce((sum, ci) => sum + ci.quantity, 0), [state.items]);

  const getSubtotal = useCallback(() =>
    state.items.reduce((sum, ci) => sum + ci.item.rate * ci.quantity, 0), [state.items]);

  const getItemQuantity = useCallback((itemId: number) =>
    state.items.find(ci => ci.item.id === itemId)?.quantity ?? 0, [state.items]);

  return (
    <CartContext.Provider value={{
      state, addItem, removeItem, updateQuantity, clearCart,
      setCustomerName, setTableNo, setPaymentMethod, setNotes, setDiscount,
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

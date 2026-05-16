import { getDB } from './database';

export interface OrderItem {
  id?: number;
  order_id?: number;
  item_id: number | null;
  item_code: string;
  item_name: string;
  rate: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  table_no: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  grand_total: number;
  payment_method: string;
  status: string;
  notes: string;
  print_count: number;
  cash_amount: number;
  upi_amount: number;
  is_split_payment: number;
  created_at: string;
  items?: OrderItem[];
}

export const incrementPrintCount = (orderId: number): void => {
  const db = getDB();
  db.runSync('UPDATE orders SET print_count = print_count + 1 WHERE id = ?', [orderId]);
};

export const generateOrderNumber = (): string => {
  const db = getDB();
  const result = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM orders');
  const count = (result?.count ?? 0) + 1;
  const date = new Date();
  const prefix = `ORD${date.getFullYear().toString().slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}${String(count).padStart(4, '0')}`;
};

export const placeOrder = (
  orderData: {
    customer_name: string;
    table_no: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount: number;
    grand_total: number;
    payment_method: string;
    notes: string;
    cash_amount?: number;
    upi_amount?: number;
    is_split_payment?: number;
  },
  items: OrderItem[]
): number => {
  const db = getDB();
  const order_number = generateOrderNumber();

  const result = db.runSync(
    `INSERT INTO orders (order_number, customer_name, table_no, subtotal, tax_rate, tax_amount, discount, grand_total, payment_method, notes, cash_amount, upi_amount, is_split_payment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order_number,
      orderData.customer_name,
      orderData.table_no,
      orderData.subtotal,
      orderData.tax_rate,
      orderData.tax_amount,
      orderData.discount,
      orderData.grand_total,
      orderData.payment_method,
      orderData.notes,
      orderData.cash_amount || 0,
      orderData.upi_amount || 0,
      orderData.is_split_payment || 0,
    ]
  );

  const orderId = result.lastInsertRowId;

  for (const item of items) {
    db.runSync(
      `INSERT INTO order_items (order_id, item_id, item_code, item_name, rate, quantity, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderId, item.item_id, item.item_code, item.item_name, item.rate, item.quantity, item.subtotal]
    );
  }

  return orderId;
};

export const getAllOrders = (): Order[] => {
  const db = getDB();
  return db.getAllSync<Order>(
    `SELECT * FROM orders ORDER BY created_at DESC`
  );
};

export const getOrderById = (id: number): Order | null => {
  const db = getDB();
  const order = db.getFirstSync<Order>('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return null;

  const items = db.getAllSync<OrderItem>(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC',
    [id]
  );

  return { ...order, items };
};

export const getOrderWithItems = (orderId: number): { order: Order; items: OrderItem[] } | null => {
  const order = getOrderById(orderId);
  if (!order) return null;
  return { order, items: order.items ?? [] };
};

export const deleteOrder = (id: number): void => {
  const db = getDB();
  db.runSync('DELETE FROM order_items WHERE order_id = ?', [id]);
  db.runSync('DELETE FROM orders WHERE id = ?', [id]);
};

export const getOrderStats = (): { total_orders: number; total_revenue: number; today_orders: number; today_revenue: number } => {
  const db = getDB();
  const all = db.getFirstSync<{ total_orders: number; total_revenue: number }>(
    'SELECT COUNT(*) as total_orders, SUM(grand_total) as total_revenue FROM orders'
  );
  const today = db.getFirstSync<{ today_orders: number; today_revenue: number }>(
    `SELECT COUNT(*) as today_orders, SUM(grand_total) as today_revenue 
     FROM orders WHERE date(created_at) = date('now','localtime')`
  );
  return {
    total_orders: all?.total_orders ?? 0,
    total_revenue: all?.total_revenue ?? 0,
    today_orders: today?.today_orders ?? 0,
    today_revenue: today?.today_revenue ?? 0,
  };
};

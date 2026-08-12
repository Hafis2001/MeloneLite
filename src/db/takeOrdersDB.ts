import { getDB } from './database';
import { OrderItem, Order } from './ordersDB';

export interface TakeOrder extends Order {
  saved_at?: string;
}

export const incrementTakeOrderPrintCount = (orderId: number): void => {
  const db = getDB();
  db.runSync('UPDATE take_orders SET print_count = print_count + 1 WHERE id = ?', [orderId]);
};

export const generateTakeOrderNumber = (): string => {
  const db = getDB();
  const result = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM take_orders');
  const count = (result?.count ?? 0) + 1;
  const date = new Date();
  const prefix = `TKO${date.getFullYear().toString().slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}${String(count).padStart(4, '0')}`;
};

export const placeTakeOrder = (
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
  const order_number = generateTakeOrderNumber();

  const result = db.runSync(
    `INSERT INTO take_orders (order_number, customer_name, table_no, subtotal, tax_rate, tax_amount, discount, grand_total, payment_method, notes, cash_amount, upi_amount, is_split_payment, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      'pending' // Initial status is pending
    ]
  );

  const orderId = result.lastInsertRowId;

  for (const item of items) {
    db.runSync(
      `INSERT INTO take_order_items (order_id, item_id, item_code, item_name, rate, quantity, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderId, item.item_id, item.item_code, item.item_name, item.rate, item.quantity, item.subtotal]
    );
  }

  return orderId;
};

export const getAllTakeOrders = (statusFilter?: 'pending' | 'saved' | 'cancelled'): TakeOrder[] => {
  const db = getDB();
  let query = 'SELECT * FROM take_orders';
  const params: any[] = [];
  if (statusFilter) {
    query += ' WHERE status = ?';
    params.push(statusFilter);
  }
  query += ' ORDER BY created_at DESC';
  return db.getAllSync<TakeOrder>(query, params);
};

export const getTakeOrderById = (id: number): TakeOrder | null => {
  const db = getDB();
  const order = db.getFirstSync<TakeOrder>('SELECT * FROM take_orders WHERE id = ?', [id]);
  if (!order) return null;

  const items = db.getAllSync<OrderItem>(
    'SELECT * FROM take_order_items WHERE order_id = ? ORDER BY id ASC',
    [id]
  );

  return { ...order, items };
};

export const updateTakeOrderStatus = (id: number, status: 'saved' | 'cancelled'): void => {
  const db = getDB();
  if (status === 'saved') {
    db.runSync('UPDATE take_orders SET status = ?, saved_at = datetime("now","localtime") WHERE id = ?', [status, id]);

    // Insert into orders table to show in local sales reports
    const takeOrder = getTakeOrderById(id);
    if (takeOrder) {
      const order_number = takeOrder.order_number;
      // Check if already exists to avoid duplication
      const existing = db.getFirstSync<{ id: number }>('SELECT id FROM orders WHERE order_number = ?', [order_number]);
      if (!existing) {
        db.runSync(
          `INSERT INTO orders (order_number, customer_name, table_no, subtotal, tax_rate, tax_amount, discount, grand_total, payment_method, notes, cash_amount, upi_amount, is_split_payment, status, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            order_number, takeOrder.customer_name, takeOrder.table_no, takeOrder.subtotal,
            takeOrder.tax_rate, takeOrder.tax_amount, takeOrder.discount, takeOrder.grand_total,
            takeOrder.payment_method, takeOrder.notes, takeOrder.cash_amount, takeOrder.upi_amount,
            takeOrder.is_split_payment, 'completed', 1
          ]
        );
        const newOrderId = db.getFirstSync<{ id: number }>('SELECT id FROM orders WHERE order_number = ?', [order_number])?.id;
        if (newOrderId && takeOrder.items) {
          for (const item of takeOrder.items) {
            db.runSync(
              `INSERT INTO order_items (order_id, item_id, item_code, item_name, rate, quantity, subtotal)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [newOrderId, item.item_id, item.item_code, item.item_name, item.rate, item.quantity, item.subtotal]
            );
          }
        }
      }
    }
  } else {
    db.runSync('UPDATE take_orders SET status = ? WHERE id = ?', [status, id]);
  }
};

export const deleteTakeOrder = (id: number): void => {
  const db = getDB();
  db.runSync('DELETE FROM take_order_items WHERE order_id = ?', [id]);
  db.runSync('DELETE FROM take_orders WHERE id = ?', [id]);
};

export interface AdvancedStats {
  totalBills: number;
  totalRevenue: number;
  cashRevenue: number;
  upiRevenue: number;
  cardRevenue: number;
}

export const getTakeOrderAdvancedReportStats = (startDate?: string, endDate?: string): AdvancedStats => {
  const db = getDB();
  
  let dateFilter = '';
  const params: any[] = [];
  
  // Exclude cancelled/pending orders from revenue
  let statusFilter = "status = 'saved'";

  if (startDate && endDate) {
    if (startDate === endDate) {
      dateFilter = `WHERE ${statusFilter} AND date(created_at) = date(?)`;
      params.push(startDate);
    } else {
      dateFilter = `WHERE ${statusFilter} AND date(created_at) >= date(?) AND date(created_at) <= date(?)`;
      params.push(startDate, endDate);
    }
  } else {
    dateFilter = `WHERE ${statusFilter}`;
  }

  const orders = db.getAllSync<TakeOrder>(
    `SELECT * FROM take_orders ${dateFilter}`,
    params
  );

  let cashRevenue = 0;
  let upiRevenue = 0;
  let cardRevenue = 0;
  let totalRevenue = 0;

  orders.forEach(o => {
    totalRevenue += o.grand_total;
    if (o.is_split_payment) {
      cashRevenue += (o.cash_amount || 0);
      upiRevenue += (o.upi_amount || 0);
    } else {
      if (o.payment_method === 'Cash') cashRevenue += o.grand_total;
      else if (o.payment_method === 'UPI') upiRevenue += o.grand_total;
      else if (o.payment_method === 'Card') cardRevenue += o.grand_total;
    }
  });

  return {
    totalBills: orders.length,
    totalRevenue,
    cashRevenue,
    upiRevenue,
    cardRevenue
  };
};

export const getTakeOrderTopMovedItems = (limit: number = 10, startDate?: string, endDate?: string): { item_name: string; total_quantity: number; total_revenue: number }[] => {
  const db = getDB();
  let dateFilter = '';
  const params: any[] = [];
  let statusFilter = "o.status = 'saved'";
  
  if (startDate && endDate) {
    if (startDate === endDate) {
      dateFilter = `WHERE ${statusFilter} AND date(o.created_at) = date(?)`;
      params.push(startDate);
    } else {
      dateFilter = `WHERE ${statusFilter} AND date(o.created_at) >= date(?) AND date(o.created_at) <= date(?)`;
      params.push(startDate, endDate);
    }
  } else {
    dateFilter = `WHERE ${statusFilter}`;
  }
  
  params.push(limit);

  return db.getAllSync<{ item_name: string; total_quantity: number; total_revenue: number }>(
    `SELECT oi.item_name, SUM(oi.quantity) as total_quantity, SUM(oi.subtotal) as total_revenue
     FROM take_order_items oi
     JOIN take_orders o ON oi.order_id = o.id
     ${dateFilter}
     GROUP BY oi.item_name
     ORDER BY total_quantity DESC
     LIMIT ?`,
    params
  );
};


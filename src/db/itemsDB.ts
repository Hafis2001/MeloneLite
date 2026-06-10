import { getDB } from './database';

export interface Item {
  id: number;
  item_code: string;
  item_name: string;
  item_name_ar?: string | null;
  item_name_ml?: string | null;
  item_name_ta?: string | null;
  item_name_hi?: string | null;
  item_name_kn?: string | null;
  image_uri: string | null;
  rate: number;
  category_id: number | null;
  category_name?: string;
  category_name_ar?: string | null;
  category_name_ml?: string | null;
  category_name_ta?: string | null;
  category_name_hi?: string | null;
  category_color?: string;
  is_available: number;
  created_at: string;
  barcode?: string | null;
}

export const getAllItems = (): Item[] => {
  const db = getDB();
  return db.getAllSync<Item>(
    `SELECT i.*, c.name as category_name, c.name_ar as category_name_ar, c.name_ml as category_name_ml, c.name_ta as category_name_ta, c.name_hi as category_name_hi, c.color as category_color
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     ORDER BY i.item_name ASC`
  );
};

export const getItemsByCategory = (categoryId: number): Item[] => {
  const db = getDB();
  return db.getAllSync<Item>(
    `SELECT i.*, c.name as category_name, c.name_ar as category_name_ar, c.name_ml as category_name_ml, c.name_ta as category_name_ta, c.name_hi as category_name_hi, c.color as category_color
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE i.category_id = ?
     ORDER BY i.item_name ASC`,
    [categoryId]
  );
};

export const getItemById = (id: number): Item | null => {
  const db = getDB();
  return db.getFirstSync<Item>(
    `SELECT i.*, c.name as category_name, c.name_ar as category_name_ar, c.name_ml as category_name_ml, c.name_ta as category_name_ta, c.name_hi as category_name_hi, c.color as category_color
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE i.id = ?`,
    [id]
  );
};

export const getItemByBarcode = (barcode: string): Item | null => {
  const db = getDB();
  return db.getFirstSync<Item>(
    `SELECT i.*, c.name as category_name, c.name_ar as category_name_ar, c.name_ml as category_name_ml, c.name_ta as category_name_ta, c.name_hi as category_name_hi, c.color as category_color
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE i.barcode = ?`,
    [barcode.trim()]
  );
};

export const getItemByCode = (item_code: string): Item | null => {
  const db = getDB();
  return db.getFirstSync<Item>(
    `SELECT i.*, c.name as category_name, c.name_ar as category_name_ar, c.name_ml as category_name_ml, c.name_ta as category_name_ta, c.name_hi as category_name_hi, c.color as category_color
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE i.item_code = ?`,
    [item_code.trim()]
  );
};

export const generateItemCode = (): string => {
  const db = getDB();
  // Use MAX of the parsed integer from item_code to prevent conflicts if items were deleted
  const result = db.getFirstSync<{ max_num: number }>(
    "SELECT MAX(CAST(SUBSTR(item_code, 4) AS INTEGER)) as max_num FROM items WHERE item_code LIKE 'ITM%'"
  );
  const max = (result?.max_num ?? 0) + 1;
  return `ITM${String(max).padStart(4, '0')}`;
};

export const addItem = (
  item_code: string,
  item_name: string,
  item_name_ar: string | null,
  item_name_ml: string | null,
  item_name_ta: string | null,
  item_name_hi: string | null,
  item_name_kn: string | null,
  rate: number,
  category_id: number | null,
  image_uri: string | null,
  barcode?: string | null
): number => {
  const db = getDB();
  const result = db.runSync(
    `INSERT INTO items (item_code, item_name, item_name_ar, item_name_ml, item_name_ta, item_name_hi, item_name_kn, rate, category_id, image_uri, barcode) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item_code.trim(), item_name.trim(), item_name_ar ? item_name_ar.trim() : null, item_name_ml ? item_name_ml.trim() : null, item_name_ta ? item_name_ta.trim() : null, item_name_hi ? item_name_hi.trim() : null, item_name_kn ? item_name_kn.trim() : null, rate, category_id, image_uri, barcode ?? null]
  );
  return result.lastInsertRowId;
};

export const updateItem = (
  id: number,
  item_code: string,
  item_name: string,
  item_name_ar: string | null,
  item_name_ml: string | null,
  item_name_ta: string | null,
  item_name_hi: string | null,
  item_name_kn: string | null,
  rate: number,
  category_id: number | null,
  image_uri: string | null,
  is_available: number,
  barcode?: string | null
): void => {
  const db = getDB();
  db.runSync(
    `UPDATE items SET item_code=?, item_name=?, item_name_ar=?, item_name_ml=?, item_name_ta=?, item_name_hi=?, item_name_kn=?, rate=?, category_id=?, image_uri=?, is_available=?, barcode=? WHERE id=?`,
    [item_code.trim(), item_name.trim(), item_name_ar ? item_name_ar.trim() : null, item_name_ml ? item_name_ml.trim() : null, item_name_ta ? item_name_ta.trim() : null, item_name_hi ? item_name_hi.trim() : null, item_name_kn ? item_name_kn.trim() : null, rate, category_id, image_uri, is_available, barcode ?? null, id]
  );
};

export const deleteItem = (id: number): void => {
  const db = getDB();
  db.runSync('DELETE FROM items WHERE id = ?', [id]);
};

export const searchItems = (query: string): Item[] => {
  const db = getDB();
  const q = `%${query}%`;
  return db.getAllSync<Item>(
    `SELECT i.*, c.name as category_name, c.name_ar as category_name_ar, c.name_ml as category_name_ml, c.name_ta as category_name_ta, c.name_hi as category_name_hi, c.color as category_color
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE i.item_name LIKE ? OR i.item_code LIKE ?
     ORDER BY i.item_name ASC`,
    [q, q]
  );
};

export const isItemCodeUnique = (code: string, excludeId?: number): boolean => {
  const db = getDB();
  const result = excludeId
    ? db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM items WHERE item_code = ? AND id != ?', [code, excludeId])
    : db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM items WHERE item_code = ?', [code]);
  return (result?.count ?? 0) === 0;
};

export const isBarcodeUnique = (barcode: string, excludeId?: number): boolean => {
  if (!barcode.trim()) return true;
  const db = getDB();
  const result = excludeId
    ? db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM items WHERE barcode = ? AND id != ?', [barcode.trim(), excludeId])
    : db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM items WHERE barcode = ?', [barcode.trim()]);
  return (result?.count ?? 0) === 0;
};

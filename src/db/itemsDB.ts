import { getDB } from './database';

export interface Item {
  id: number;
  item_code: string;
  item_name: string;
  image_uri: string | null;
  rate: number;
  category_id: number | null;
  category_name?: string;
  category_color?: string;
  is_available: number;
  created_at: string;
}

export const getAllItems = (): Item[] => {
  const db = getDB();
  return db.getAllSync<Item>(
    `SELECT i.*, c.name as category_name, c.color as category_color
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     ORDER BY i.item_name ASC`
  );
};

export const getItemsByCategory = (categoryId: number): Item[] => {
  const db = getDB();
  return db.getAllSync<Item>(
    `SELECT i.*, c.name as category_name, c.color as category_color
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
    `SELECT i.*, c.name as category_name, c.color as category_color
     FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE i.id = ?`,
    [id]
  );
};

export const generateItemCode = (): string => {
  const db = getDB();
  const result = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM items');
  const count = (result?.count ?? 0) + 1;
  return `ITM${String(count).padStart(4, '0')}`;
};

export const addItem = (
  item_code: string,
  item_name: string,
  rate: number,
  category_id: number | null,
  image_uri: string | null
): number => {
  const db = getDB();
  const result = db.runSync(
    `INSERT INTO items (item_code, item_name, rate, category_id, image_uri) 
     VALUES (?, ?, ?, ?, ?)`,
    [item_code.trim(), item_name.trim(), rate, category_id, image_uri]
  );
  return result.lastInsertRowId;
};

export const updateItem = (
  id: number,
  item_code: string,
  item_name: string,
  rate: number,
  category_id: number | null,
  image_uri: string | null,
  is_available: number
): void => {
  const db = getDB();
  db.runSync(
    `UPDATE items SET item_code=?, item_name=?, rate=?, category_id=?, image_uri=?, is_available=? WHERE id=?`,
    [item_code.trim(), item_name.trim(), rate, category_id, image_uri, is_available, id]
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
    `SELECT i.*, c.name as category_name, c.color as category_color
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

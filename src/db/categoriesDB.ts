import { getDB } from './database';

export interface Category {
  id: number;
  name: string;
  name_ar?: string | null;
  name_ml?: string | null;
  name_ta?: string | null;
  name_hi?: string | null;
  color: string;
  created_at: string;
  item_count?: number;
}

export const getAllCategories = (): Category[] => {
  const db = getDB();
  return db.getAllSync<Category>(
    `SELECT c.*, COUNT(i.id) as item_count 
     FROM categories c 
     LEFT JOIN items i ON i.category_id = c.id 
     GROUP BY c.id 
     ORDER BY c.name ASC`
  );
};

export const getCategoryById = (id: number): Category | null => {
  const db = getDB();
  return db.getFirstSync<Category>('SELECT * FROM categories WHERE id = ?', [id]);
};

export const getCategoryByName = (name: string): Category | null => {
  const db = getDB();
  return db.getFirstSync<Category>('SELECT * FROM categories WHERE name = ?', [name.trim()]);
};

export const addCategory = (name: string, name_ar: string | null = null, name_ml: string | null = null, name_ta: string | null = null, name_hi: string | null = null, color: string = '#D4A853'): number => {
  const db = getDB();
  const result = db.runSync(
    'INSERT INTO categories (name, name_ar, name_ml, name_ta, name_hi, color) VALUES (?, ?, ?, ?, ?, ?)',
    [name.trim(), name_ar ? name_ar.trim() : null, name_ml ? name_ml.trim() : null, name_ta ? name_ta.trim() : null, name_hi ? name_hi.trim() : null, color]
  );
  return result.lastInsertRowId;
};

export const updateCategory = (id: number, name: string, name_ar: string | null, name_ml: string | null, name_ta: string | null, name_hi: string | null, color: string): void => {
  const db = getDB();
  db.runSync(
    'UPDATE categories SET name = ?, name_ar = ?, name_ml = ?, name_ta = ?, name_hi = ?, color = ? WHERE id = ?',
    [name.trim(), name_ar ? name_ar.trim() : null, name_ml ? name_ml.trim() : null, name_ta ? name_ta.trim() : null, name_hi ? name_hi.trim() : null, color, id]
  );
};

export const deleteCategory = (id: number): void => {
  const db = getDB();
  // Unlink items from this category first
  db.runSync('UPDATE items SET category_id = NULL WHERE category_id = ?', [id]);
  db.runSync('DELETE FROM categories WHERE id = ?', [id]);
};

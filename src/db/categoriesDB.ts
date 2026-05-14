import { getDB } from './database';

export interface Category {
  id: number;
  name: string;
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

export const addCategory = (name: string, color: string = '#D4A853'): number => {
  const db = getDB();
  const result = db.runSync(
    'INSERT INTO categories (name, color) VALUES (?, ?)',
    [name.trim(), color]
  );
  return result.lastInsertRowId;
};

export const updateCategory = (id: number, name: string, color: string): void => {
  const db = getDB();
  db.runSync(
    'UPDATE categories SET name = ?, color = ? WHERE id = ?',
    [name.trim(), color, id]
  );
};

export const deleteCategory = (id: number): void => {
  const db = getDB();
  // Unlink items from this category first
  db.runSync('UPDATE items SET category_id = NULL WHERE category_id = ?', [id]);
  db.runSync('DELETE FROM categories WHERE id = ?', [id]);
};

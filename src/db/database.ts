import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDB = (): SQLite.SQLiteDatabase => {
  if (!db) {
    db = SQLite.openDatabaseSync('melonelite.db');
  }
  return db;
};

export const closeDB = () => {
  if (db) {
    try {
      db.closeSync();
    } catch (e) {
      console.warn('Error closing DB', e);
    }
    db = null;
  }
};

export const initDatabase = async (): Promise<void> => {
  const database = getDB();

  // Enable WAL mode for better performance
  database.execSync('PRAGMA journal_mode = WAL;');
  database.execSync('PRAGMA foreign_keys = ON;');

  // Categories table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#D4A853',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Items table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT NOT NULL UNIQUE,
      item_name TEXT NOT NULL,
      image_uri TEXT,
      rate REAL NOT NULL DEFAULT 0,
      category_id INTEGER,
      is_available INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
  `);

  // Orders table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT DEFAULT '',
      table_no TEXT DEFAULT '',
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 5,
      tax_amount REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'Cash',
      status TEXT DEFAULT 'completed',
      notes TEXT DEFAULT '',
      print_count INTEGER DEFAULT 0,
      cash_amount REAL DEFAULT 0,
      upi_amount REAL DEFAULT 0,
      is_split_payment INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Migrations for existing databases
  const migrations = [
    'ALTER TABLE orders ADD COLUMN print_count INTEGER DEFAULT 0;',
    'ALTER TABLE orders ADD COLUMN cash_amount REAL DEFAULT 0;',
    'ALTER TABLE orders ADD COLUMN upi_amount REAL DEFAULT 0;',
    'ALTER TABLE orders ADD COLUMN is_split_payment INTEGER DEFAULT 0;',
    'ALTER TABLE items ADD COLUMN barcode TEXT;',
    'ALTER TABLE items ADD COLUMN item_name_ar TEXT;',
    'ALTER TABLE categories ADD COLUMN name_ar TEXT;',
    'ALTER TABLE items ADD COLUMN item_name_ml TEXT;',
    'ALTER TABLE categories ADD COLUMN name_ml TEXT;',
    'ALTER TABLE items ADD COLUMN item_name_ta TEXT;',
    'ALTER TABLE categories ADD COLUMN name_ta TEXT;',
    'ALTER TABLE items ADD COLUMN item_name_hi TEXT;',
    'ALTER TABLE categories ADD COLUMN name_hi TEXT;',
    'ALTER TABLE items ADD COLUMN item_name_kn TEXT;',
    'ALTER TABLE categories ADD COLUMN name_kn TEXT;',
    'ALTER TABLE items ADD COLUMN prices_json TEXT;',
    // Background sync: track which orders have been synced to the server
    'ALTER TABLE orders ADD COLUMN synced INTEGER DEFAULT 0;'
  ];

  migrations.forEach(sql => {
    try {
      database.execSync(sql);
    } catch (e) {
      // Column already exists or table busy
    }
  });

  // Order items table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      item_id INTEGER,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      rate REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Take Orders table (Pending/Saved)
  database.execSync(`
    CREATE TABLE IF NOT EXISTS take_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT DEFAULT '',
      table_no TEXT DEFAULT '',
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 5,
      tax_amount REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'Cash',
      status TEXT DEFAULT 'pending',
      notes TEXT DEFAULT '',
      print_count INTEGER DEFAULT 0,
      cash_amount REAL DEFAULT 0,
      upi_amount REAL DEFAULT 0,
      is_split_payment INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      saved_at TEXT
    );
  `);

  // Take Order items table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS take_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      item_id INTEGER,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      rate REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES take_orders(id) ON DELETE CASCADE
    );
  `);

  // Settings table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Insert default settings if not exist
  database.execSync(`
    INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('restaurant_name', 'My Restaurant'),
    ('restaurant_address', ''),
    ('restaurant_phone', ''),
    ('tax_rate', '5'),
    ('currency_symbol', '₹'),
    ('decimal_places', '2'),
    ('receipt_footer', 'Thank you for dining with us!'),
    ('require_barcode', '0'),
    ('enable_arabic', '0'),
    ('enable_malayalam', '0'),
    ('enable_tamil', '0'),
    ('enable_hindi', '0'),
    ('enable_kannada', '0'),
    ('theme_primary', '#D4A853'),
    ('theme_secondary', 'default'),
    ('enable_multiple_prices', '0');
  `);
};

import { getDB } from './database';

export interface Settings {
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
  tax_rate: string;
  currency_symbol: string;
  decimal_places?: string;
  receipt_footer: string;
  require_barcode?: string;
  enable_arabic?: string;
  enable_malayalam?: string;
  enable_tamil?: string;
  enable_hindi?: string;
  enable_kannada?: string;
  auto_generate_image?: string;
  add_product_by_click?: string;
}

export const getSetting = (key: string): string => {
  const db = getDB();
  const result = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return result?.value ?? '';
};

export const setSetting = (key: string, value: string): void => {
  const db = getDB();
  db.runSync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
};

export const getAllSettings = (): Settings => {
  return {
    restaurant_name: getSetting('restaurant_name'),
    restaurant_address: getSetting('restaurant_address'),
    restaurant_phone: getSetting('restaurant_phone'),
    tax_rate: getSetting('tax_rate'),
    currency_symbol: getSetting('currency_symbol'),
    decimal_places: getSetting('decimal_places') || '2',
    receipt_footer: getSetting('receipt_footer'),
    require_barcode: getSetting('require_barcode') || '0',
    enable_arabic: getSetting('enable_arabic') || '0',
    enable_malayalam: getSetting('enable_malayalam') || '0',
    enable_tamil: getSetting('enable_tamil') || '0',
    enable_hindi: getSetting('enable_hindi') || '0',
    enable_kannada: getSetting('enable_kannada') || '0',
    auto_generate_image: getSetting('auto_generate_image') || '0',
    add_product_by_click: getSetting('add_product_by_click') || '0',
  };
};

export const updateSettings = (settings: Partial<Settings>): void => {
  for (const [key, value] of Object.entries(settings)) {
    setSetting(key, value);
  }
};

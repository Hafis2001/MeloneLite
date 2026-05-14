import { getDB } from './database';

export interface Settings {
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
  tax_rate: string;
  currency_symbol: string;
  receipt_footer: string;
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
    receipt_footer: getSetting('receipt_footer'),
  };
};

export const updateSettings = (settings: Partial<Settings>): void => {
  for (const [key, value] of Object.entries(settings)) {
    setSetting(key, value);
  }
};

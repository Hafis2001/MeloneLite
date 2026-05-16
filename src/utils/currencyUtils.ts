import { getSetting } from '../db/settingsDB';

export const formatCurrency = (amount: number): string => {
  const symbol = getSetting('currency_symbol') || '₹';
  const decimalsStr = getSetting('decimal_places');
  const decimals = decimalsStr ? parseInt(decimalsStr, 10) : 2;
  
  return `${symbol}${amount.toFixed(decimals)}`;
};

import React from 'react';

import { getSetting } from '../db/settingsDB';

export interface ThemeContextValue {
  refreshTheme: () => void;
  themeVersion: number;
}

export const ThemeContext = React.createContext<ThemeContextValue>({
  refreshTheme: () => {},
  themeVersion: 0,
});

/** Hook — returns the current theme version number. When theme changes this increments,
 *  causing any useMemo that depends on it to re-run with fresh Colors values. */
export const useThemeVersion = () => React.useContext(ThemeContext).themeVersion;

/** Hook — returns the currently active language, forcing re-render when it changes */
export const useActiveLanguage = (): 'ar' | 'ml' | 'ta' | 'hi' | 'kn' | 'en' => {
  useThemeVersion();
  if (getSetting('enable_arabic') === '1') return 'ar';
  if (getSetting('enable_malayalam') === '1') return 'ml';
  if (getSetting('enable_tamil') === '1') return 'ta';
  if (getSetting('enable_hindi') === '1') return 'hi';
  if (getSetting('enable_kannada') === '1') return 'kn';
  return 'en';
};

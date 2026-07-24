import { getSetting } from '../db/settingsDB';

export const Colors = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  card: '#242424',
  cardElevated: '#2C2C2C',
  border: '#2E2E2E',
  borderLight: '#3A3A3A',

  gold: '#D4A853',
  goldLight: '#F0C060',
  goldDark: '#A07830',
  amber: '#F59E0B',

  primary: '#D4A853',
  primaryDark: '#A07830',

  textPrimary: '#F5F5F5',
  textSecondary: '#B0B0B0',
  textMuted: '#6A6A6A',
  textInverse: '#0D0D0D',

  success: '#22C55E',
  successBg: '#0F2D1A',
  error: '#EF4444',
  errorBg: '#2D0F0F',
  warning: '#F59E0B',
  warningBg: '#2D1F0A',
  info: '#3B82F6',
  infoBg: '#0F1A2D',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  overlayDark: 'rgba(0,0,0,0.7)',
  overlayLight: 'rgba(255,255,255,0.05)',
  goldOverlay: 'rgba(212,168,83,0.1)',
  goldOverlayStrong: 'rgba(212,168,83,0.2)',
};

function hexToRgb(hex: string) {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  if (clean.length !== 6) return { r: 13, g: 13, b: 13 }; // Default dark fallback
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return { r, g, b };
}

function getLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function shadeColor(hex: string, percent: number) {
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = percent < 0 ? percent * -1 : percent;
  
  const R = Math.round((t - r) * p) + r;
  const G = Math.round((t - g) * p) + g;
  const B = Math.round((t - b) * p) + b;
  
  return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
}

export const applyTheme = (accentHex: string, backgroundHex: string) => {
  if (!accentHex.startsWith('#')) accentHex = '#D4A853';
  if (!backgroundHex.startsWith('#')) {
    if (backgroundHex === 'default') backgroundHex = '#0D0D0D';
    else if (backgroundHex === 'midnight') backgroundHex = '#020617';
    else if (backgroundHex === 'forest') backgroundHex = '#052e16';
    else if (backgroundHex === 'maroon') backgroundHex = '#4c0519';
    else backgroundHex = '#0D0D0D';
  }

  // Set Accent
  Colors.gold = accentHex;
  Colors.primary = accentHex;
  Colors.goldOverlay = accentHex + '1A'; // 10% opacity
  Colors.goldOverlayStrong = accentHex + '33'; // 20% opacity

  // Determine Light or Dark Mode based on background luminance
  const isLight = getLuminance(backgroundHex) > 0.5;

  Colors.background = backgroundHex;
  
  if (isLight) {
    // Light Mode Palette
    Colors.textPrimary = '#111827';
    Colors.textSecondary = '#4B5563';
    Colors.textMuted = '#9CA3AF';
    Colors.textInverse = '#FFFFFF';
    
    // Lighten to create cards, darken to create borders
    Colors.surface = shadeColor(backgroundHex, 0.05);
    Colors.card = '#FFFFFF'; // Force cards to pure white for crisp look
    Colors.cardElevated = shadeColor(backgroundHex, 0.1);
    Colors.border = shadeColor(backgroundHex, -0.1);
    Colors.borderLight = shadeColor(backgroundHex, -0.15);
  } else {
    // Dark Mode Palette
    Colors.textPrimary = '#F5F5F5';
    Colors.textSecondary = '#B0B0B0';
    Colors.textMuted = '#6A6A6A';
    Colors.textInverse = '#0D0D0D';
    
    // Lighten to create cards and borders
    Colors.surface = shadeColor(backgroundHex, 0.05);
    Colors.card = shadeColor(backgroundHex, 0.1);
    Colors.cardElevated = shadeColor(backgroundHex, 0.15);
    Colors.border = shadeColor(backgroundHex, 0.15);
    Colors.borderLight = shadeColor(backgroundHex, 0.2);
  }
};

// Synchronous theme initialization before components evaluate StyleSheet.create
// Must run BEFORE Typography is evaluated!
try {
  const primary = getSetting('theme_primary') || '#D4A853';
  const secondary = getSetting('theme_secondary') || '#0D0D0D';
  applyTheme(primary, secondary);
} catch (e) {
  // Database tables might not exist yet on fresh install, ignore.
}

export const Typography = {
  heading1: { fontSize: 28, fontFamily: 'Poppins-Bold', color: Colors.textPrimary },
  heading2: { fontSize: 22, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary },
  heading3: { fontSize: 18, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary },
  heading4: { fontSize: 15, fontFamily: 'Poppins-Medium', color: Colors.textPrimary },
  body: { fontSize: 14, fontFamily: 'Poppins-Regular', color: Colors.textSecondary },
  bodyMedium: { fontSize: 14, fontFamily: 'Poppins-Medium', color: Colors.textPrimary },
  caption: { fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textMuted },
  captionMedium: { fontSize: 12, fontFamily: 'Poppins-Medium', color: Colors.textMuted },
  price: { fontSize: 16, fontFamily: 'Poppins-Bold', color: Colors.gold },
  priceSmall: { fontSize: 13, fontFamily: 'Poppins-SemiBold', color: Colors.gold },
  label: { fontSize: 11, fontFamily: 'Poppins-Medium', color: Colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 1 },
  text: { fontSize: 14, fontFamily: 'Poppins-Regular', color: Colors.textPrimary },
  regular: { fontSize: 14, fontFamily: 'Poppins-Regular', color: Colors.textPrimary },
  medium: { fontSize: 14, fontFamily: 'Poppins-Medium', color: Colors.textPrimary },
  semiBold: { fontSize: 14, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  goldGlow: {
    shadowColor: '#D4A853',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  button: {
    shadowColor: '#D4A853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
};

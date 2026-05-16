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

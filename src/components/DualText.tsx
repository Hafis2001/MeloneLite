import React from 'react';
import { Text, View, StyleSheet, TextStyle, StyleProp, ViewStyle } from 'react-native';
import { t } from '../utils/translations';
import { getSetting } from '../db/settingsDB';
import { useThemeVersion } from '../context/ThemeContext';

interface DualTextProps {
  text: string;
  arabicText?: string | null;
  malayalamText?: string | null;
  tamilText?: string | null;
  hindiText?: string | null;
  kannadaText?: string | null;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  reverse?: boolean; // If true, translation on top, English on bottom
  enabled?: boolean; // Optional override for checking settings
  numberOfLines?: number;
}

export const DualText: React.FC<DualTextProps> = ({ 
  text, 
  arabicText, 
  malayalamText,
  tamilText,
  hindiText,
  kannadaText,
  style, 
  containerStyle, 
  reverse = false, 
  enabled,
  numberOfLines
}) => {
  const themeVersion = useThemeVersion(); // Force re-render on language toggle

  const isArabicEnabled = enabled !== undefined ? enabled : getSetting('enable_arabic') === '1';
  const isMalayalamEnabled = enabled !== undefined ? enabled : getSetting('enable_malayalam') === '1';
  const isTamilEnabled = enabled !== undefined ? enabled : getSetting('enable_tamil') === '1';
  const isHindiEnabled = enabled !== undefined ? enabled : getSetting('enable_hindi') === '1';
  const isKannadaEnabled = enabled !== undefined ? enabled : getSetting('enable_kannada') === '1';

  if (!isArabicEnabled && !isMalayalamEnabled && !isTamilEnabled && !isHindiEnabled && !isKannadaEnabled) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }

  // Determine active language properties
  let translatedText = text;
  if (isArabicEnabled) {
    translatedText = arabicText || t(text, 'ar');
  } else if (isMalayalamEnabled) {
    translatedText = malayalamText || t(text, 'ml');
  } else if (isTamilEnabled) {
    translatedText = tamilText || t(text, 'ta');
  } else if (isHindiEnabled) {
    translatedText = hindiText || t(text, 'hi');
  } else if (isKannadaEnabled) {
    translatedText = kannadaText || t(text, 'kn');
  }

  // If translation is the same as the original text (not found), just render single text
  if (!translatedText || translatedText === text) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {reverse ? (
        <>
          <Text style={[style, styles.secondaryText]} numberOfLines={numberOfLines}>{translatedText}</Text>
          <Text style={[style, styles.englishText]} numberOfLines={numberOfLines}>{text}</Text>
        </>
      ) : (
        <>
          <Text style={[style, styles.englishText]} numberOfLines={numberOfLines}>{text}</Text>
          <Text style={[style, styles.secondaryText]} numberOfLines={numberOfLines}>{translatedText}</Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  englishText: {
    marginBottom: 0,
  },
  secondaryText: {
    marginTop: -2,
  },
});

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

const { width } = Dimensions.get('window');

interface UpdateModalProps {
  visible: boolean;
  latestVersion: string;
  currentVersion: string;
  storeUrl?: string;
  releaseNotes?: string;
  mandatory?: boolean;
  onDismiss?: () => void;
}

export function UpdateModal({
  visible,
  latestVersion,
  currentVersion,
  storeUrl,
  releaseNotes,
  mandatory = false,
  onDismiss,
}: UpdateModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Gentle bounce for the icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -8, duration: 700, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      bounceAnim.setValue(0);
    }
  }, [visible]);

  const handleUpdate = () => {
    if (storeUrl) {
      Linking.openURL(storeUrl).catch(() => {});
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={mandatory ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Decorative top gradient bar */}
          <View style={styles.topBar} />

          {/* Icon */}
          <Animated.View
            style={[styles.iconWrapper, { transform: [{ translateY: bounceAnim }] }]}
          >
            <View style={styles.iconInner}>
              <MaterialCommunityIcons name="rocket-launch" size={44} color={Colors.gold} />
            </View>
          </Animated.View>

          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.badgeOld}>
              <Text style={styles.badgeLabel}>Current</Text>
              <Text style={styles.badgeVersion}>v{currentVersion}</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={20} color={Colors.gold} />
            <View style={styles.badgeNew}>
              <Text style={styles.badgeLabelNew}>Latest</Text>
              <Text style={styles.badgeVersionNew}>v{latestVersion}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Update Available!</Text>
          <Text style={styles.subtitle}>
            A new version of MeloneLite is ready with improvements and fixes.
          </Text>

          {/* Release notes */}
          {releaseNotes && releaseNotes.trim() !== '' && (
            <View style={styles.notesBox}>
              <View style={styles.notesHeader}>
                <MaterialCommunityIcons name="note-text-outline" size={14} color={Colors.gold} />
                <Text style={styles.notesTitle}>What's New</Text>
              </View>
              <Text style={styles.notesText}>{releaseNotes}</Text>
            </View>
          )}

          {/* Update button */}
          <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate} activeOpacity={0.85}>
            <MaterialCommunityIcons name="download" size={20} color={Colors.textInverse} />
            <Text style={styles.updateBtnText}>Update Now</Text>
          </TouchableOpacity>

          {/* Later button — only shown when not mandatory */}
          {!mandatory && onDismiss && (
            <TouchableOpacity style={styles.laterBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={styles.laterBtnText}>Remind Me Later</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    paddingBottom: Spacing.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    // Shadow
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  topBar: {
    width: '100%',
    height: 5,
    backgroundColor: Colors.gold,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  iconWrapper: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  iconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.goldOverlay,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  badgeOld: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeNew: {
    backgroundColor: 'rgba(212,168,83,0.15)',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  badgeLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: 'Poppins-Regular',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeLabelNew: {
    fontSize: 10,
    color: Colors.gold,
    fontFamily: 'Poppins-Regular',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeVersion: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontFamily: 'Poppins-SemiBold',
  },
  badgeVersionNew: {
    fontSize: 15,
    color: Colors.gold,
    fontFamily: 'Poppins-Bold',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  notesBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    width: '85%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  notesTitle: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '85%',
    marginBottom: 12,
  },
  updateBtnText: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    color: Colors.textInverse,
  },
  laterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  laterBtnText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});

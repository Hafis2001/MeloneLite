import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  useWindowDimensions, Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography } from '../src/constants/theme';

/**
 * Barcode Scanner Screen
 * 
 * Usage modes (via query params):
 *   mode=scan_item  — called from item-form to capture a barcode string
 *   mode=scan_cart  — called from home page to find an item and add it to cart
 * 
 * Results are passed back via router.replace / router.back with params.
 */

export default function BarcodeScannerScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const lastScannedRef = useRef<string>('');

  const handleBarCodeScanned = useCallback(({ data }: BarcodeScanningResult) => {
    if (scanned || data === lastScannedRef.current) return;
    lastScannedRef.current = data;
    setScanned(true);
    Vibration.vibrate(80);

    if (mode === 'scan_item') {
      // Return barcode data to item-form
      router.back();
      // Use setTimeout to let the navigation settle before passing params
      setTimeout(() => {
        router.setParams({ scannedBarcode: data });
      }, 100);
    } else {
      // mode === 'scan_cart' — navigate home with the barcode
      router.replace({
        pathname: '/(tabs)',
        params: { scannedBarcode: data },
      });
    }
  }, [scanned, mode]);

  const resetScanner = () => {
    lastScannedRef.current = '';
    setScanned(false);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="camera-off" size={64} color={Colors.textMuted} />
          <Text style={styles.permissionTitle}>Checking camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <View style={styles.permissionIconBg}>
            <MaterialCommunityIcons name="camera-lock" size={48} color={Colors.gold} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSub}>
            To scan barcodes, please allow camera access.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <MaterialCommunityIcons name="camera" size={18} color={Colors.textInverse} />
            <Text style={styles.permissionBtnText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const viewfinderSize = isLandscape
    ? Math.min(height * 0.55, width * 0.35)
    : Math.min(width * 0.65, 280);

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13', 'ean8', 'upc_a', 'upc_e',
            'code128', 'code39', 'code93',
            'qr', 'pdf417', 'aztec', 'datamatrix',
            'itf14', 'codabar',
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Dark overlay with cutout */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top overlay */}
        <View style={[styles.overlaySection, { flex: 1 }]} />

        {/* Middle row */}
        <View style={{ flexDirection: 'row', height: viewfinderSize }}>
          <View style={[styles.overlaySection, { flex: 1 }]} />
          {/* Viewfinder window */}
          <View style={[styles.viewfinder, { width: viewfinderSize, height: viewfinderSize }]}>
            {/* Corner markers */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {/* Scan line animation */}
            <View style={styles.scanLine} />
          </View>
          <View style={[styles.overlaySection, { flex: 1 }]} />
        </View>

        {/* Bottom overlay */}
        <View style={[styles.overlaySection, { flex: 1 }]} />
      </View>

      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>
              {mode === 'scan_item' ? 'Scan Item Barcode' : 'Scan to Add to Cart'}
            </Text>
            <Text style={styles.headerSub}>Point camera at barcode</Text>
          </View>
          <TouchableOpacity
            style={[styles.headerBtn, torchOn && styles.headerBtnActive]}
            onPress={() => setTorchOn(v => !v)}
          >
            <MaterialCommunityIcons
              name={torchOn ? 'flashlight' : 'flashlight-off'}
              size={22}
              color={torchOn ? Colors.gold : Colors.white}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom instructions / scanned result */}
      <SafeAreaView edges={['bottom']} style={styles.bottomSafeArea}>
        <View style={styles.bottomPanel}>
          {scanned ? (
            <View style={styles.scannedResult}>
              <MaterialCommunityIcons name="check-circle" size={22} color={Colors.gold} />
              <Text style={styles.scannedText}>Barcode scanned!</Text>
              <TouchableOpacity style={styles.rescanBtn} onPress={resetScanner}>
                <MaterialCommunityIcons name="refresh" size={16} color={Colors.gold} />
                <Text style={styles.rescanText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.instructions}>
              {mode === 'scan_item'
                ? 'Align the barcode within the frame to capture it'
                : 'Scan a product barcode to instantly add it to your cart'}
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, padding: Spacing.xxxl,
  },

  // Permission screen
  permissionIconBg: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.goldOverlay,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  permissionTitle: {
    ...Typography.heading3, textAlign: 'center', marginBottom: Spacing.sm,
  },
  permissionSub: {
    ...Typography.body, textAlign: 'center', color: Colors.textMuted,
    lineHeight: 22, marginBottom: Spacing.xl,
  },
  permissionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.gold, borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  permissionBtnText: { color: Colors.textInverse, fontFamily: 'Poppins-Bold', fontSize: 15 },
  cancelBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  cancelBtnText: { color: Colors.textMuted, fontFamily: 'Poppins-Medium', fontSize: 14 },

  // Header
  headerSafeArea: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerBtnActive: { backgroundColor: Colors.goldOverlay },
  headerTitle: { color: Colors.white, fontFamily: 'Poppins-SemiBold', fontSize: 16 },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins-Regular', fontSize: 12, marginTop: 1 },

  // Overlay
  overlaySection: { backgroundColor: 'rgba(0,0,0,0.65)' },

  // Viewfinder
  viewfinder: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: Colors.gold,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 4 },
  scanLine: {
    position: 'absolute',
    left: 10, right: 10,
    top: '50%',
    height: 2,
    backgroundColor: Colors.gold,
    opacity: 0.8,
    shadowColor: Colors.gold,
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },

  // Bottom panel
  bottomSafeArea: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomPanel: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  instructions: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  scannedResult: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  scannedText: {
    color: Colors.gold,
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    flex: 1,
  },
  rescanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.goldOverlay,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  rescanText: { color: Colors.gold, fontFamily: 'Poppins-Medium', fontSize: 12 },
});

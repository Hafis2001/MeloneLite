import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addCategory, updateCategory, Category } from '../db/categoriesDB';
import { getSetting } from '../db/settingsDB';
import { Colors, Spacing, Radius, Typography, Shadows } from '../constants/theme';
import { useThemeVersion } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  editCategory: Category | null;
  availableColors: string[];
  onClose: () => void;
  onSaved: () => void;
}

export default function AddCategoryModal({ visible, editCategory, availableColors, onClose, onSaved }: Props) {
  const themeVersion = useThemeVersion();
  const styles = useMemo(() => createStyles(), [themeVersion]);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameMl, setNameMl] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [selectedColor, setSelectedColor] = useState(availableColors[0]);
  const [error, setError] = useState('');

  const enableArabic = getSetting('enable_arabic') === '1';
  const enableMalayalam = getSetting('enable_malayalam') === '1';
  const enableTamil = getSetting('enable_tamil') === '1';
  const enableHindi = getSetting('enable_hindi') === '1';

  useEffect(() => {
    if (visible) {
      setName(editCategory?.name ?? '');
      setNameAr(editCategory?.name_ar ?? '');
      setNameMl(editCategory?.name_ml ?? '');
      setNameTa(editCategory?.name_ta ?? '');
      setNameHi(editCategory?.name_hi ?? '');
      setSelectedColor(editCategory?.color ?? availableColors[0]);
      setError('');
    }
  }, [visible, editCategory]);

  useEffect(() => {
    if (!name.trim()) {
      setNameAr('');
      setNameMl('');
      setNameTa('');
      setNameHi('');
      return;
    }

    const timerId = setTimeout(async () => {
      try {
        const resAr = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(name)}&itc=ar-t-i0-und&num=1`);
        const dataAr = await resAr.json();
        if (dataAr[0] === 'SUCCESS' && Array.isArray(dataAr[1])) {
          setNameAr(dataAr[1].map((chunk: any) => chunk[1][0]).join(''));
        }

        const resMl = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(name)}&itc=ml-t-i0-und&num=1`);
        const dataMl = await resMl.json();
        if (dataMl[0] === 'SUCCESS' && Array.isArray(dataMl[1])) {
          setNameMl(dataMl[1].map((chunk: any) => chunk[1][0]).join(''));
        }

        const resTa = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(name)}&itc=ta-t-i0-und&num=1`);
        const dataTa = await resTa.json();
        if (dataTa[0] === 'SUCCESS' && Array.isArray(dataTa[1])) {
          setNameTa(dataTa[1].map((chunk: any) => chunk[1][0]).join(''));
        }

        const resHi = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(name)}&itc=hi-t-i0-und&num=1`);
        const dataHi = await resHi.json();
        if (dataHi[0] === 'SUCCESS' && Array.isArray(dataHi[1])) {
          setNameHi(dataHi[1].map((chunk: any) => chunk[1][0]).join(''));
        }
      } catch (err) {
        console.log('Category transliteration failed:', err);
      }
    }, 800);

    return () => clearTimeout(timerId);
  }, [name]);

  const handleSave = () => {
    if (!name.trim()) { setError('Category name is required'); return; }
    try {
      if (editCategory) {
        updateCategory(editCategory.id, name, nameAr || null, nameMl || null, nameTa || null, nameHi || null, selectedColor);
      } else {
        addCategory(name, nameAr || null, nameMl || null, nameTa || null, nameHi || null, selectedColor);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message?.includes('UNIQUE') ? 'Category name already exists' : (e?.message ?? 'Error saving'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.modal}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editCategory ? 'Edit Category' : 'New Category'}</Text>
                  <TouchableOpacity onPress={onClose}>
                    <MaterialCommunityIcons name="close" size={22} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Category Name *</Text>
                <View style={[styles.inputRow, error ? { borderColor: Colors.error } : {}]}>
                  <MaterialCommunityIcons name="tag-outline" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={t => { setName(t); setError(''); }}
                    placeholder="e.g. Starters, Beverages..."
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                  />
                </View>

                {/* Name Ar Input */}
                {enableArabic && (
                  <>
                    <Text style={[styles.label, { marginTop: Spacing.sm }]}>Category Name (Arabic)</Text>
                    <View style={[styles.inputRow, error ? { borderColor: Colors.error } : {}]}>
                      <MaterialCommunityIcons name="translate" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
                      <TextInput
                        style={[styles.input, { textAlign: 'right' }]}
                        value={nameAr}
                        onChangeText={t => { setNameAr(t); setError(''); }}
                        placeholder="مقبلات، مشروبات..."
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </>
                )}

                {/* Name Ml Input */}
                {enableMalayalam && (
                  <>
                    <Text style={[styles.label, { marginTop: Spacing.sm }]}>Category Name (Malayalam)</Text>
                    <View style={[styles.inputRow, error ? { borderColor: Colors.error } : {}]}>
                      <MaterialCommunityIcons name="translate" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
                      <TextInput
                        style={[styles.input, { textAlign: 'left' }]}
                        value={nameMl}
                        onChangeText={t => { setNameMl(t); setError(''); }}
                        placeholder="സ്റ്റാർട്ടറുകൾ..."
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </>
                )}

                {/* Name Ta Input */}
                {enableTamil && (
                  <>
                    <Text style={[styles.label, { marginTop: Spacing.sm }]}>Category Name (Tamil)</Text>
                    <View style={[styles.inputRow, error ? { borderColor: Colors.error } : {}]}>
                      <MaterialCommunityIcons name="translate" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
                      <TextInput
                        style={[styles.input, { textAlign: 'left' }]}
                        value={nameTa}
                        onChangeText={t => { setNameTa(t); setError(''); }}
                        placeholder="தொடக்க உணவுகள்..."
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </>
                )}

                {/* Name Hi Input */}
                {enableHindi && (
                  <>
                    <Text style={[styles.label, { marginTop: Spacing.sm }]}>Category Name (Hindi)</Text>
                    <View style={[styles.inputRow, error ? { borderColor: Colors.error } : {}]}>
                      <MaterialCommunityIcons name="translate" size={18} color={Colors.gold} style={{ marginRight: 8 }} />
                      <TextInput
                        style={[styles.input, { textAlign: 'left' }]}
                        value={nameHi}
                        onChangeText={t => { setNameHi(t); setError(''); }}
                        placeholder="शुरुआती..."
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </>
                )}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* Color Picker */}
                <Text style={[styles.label, { marginTop: Spacing.lg }]}>Color</Text>
                <View style={styles.colorGrid}>
                  {availableColors.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[styles.colorDot, { backgroundColor: color }, selectedColor === color && styles.colorDotSelected]}
                      onPress={() => setSelectedColor(color)}
                    >
                      {selectedColor === color && (
                        <MaterialCommunityIcons name="check" size={14} color={Colors.white} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Preview */}
                <View style={[styles.preview, { borderColor: selectedColor }]}>
                  <View style={[styles.previewDot, { backgroundColor: selectedColor }]} />
                  <Text style={styles.previewText}>{name || 'Category preview'}</Text>
                </View>

                {/* Buttons */}
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                    <MaterialCommunityIcons name={editCategory ? 'content-save' : 'plus'} size={18} color={Colors.textInverse} />
                    <Text style={styles.saveText}>{editCategory ? 'Save' : 'Add'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function createStyles() {
  return StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: Colors.overlayDark,
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  modal: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    padding: Spacing.xl, width: '100%', maxWidth: 400,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.card,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  modalTitle: { ...Typography.heading3 },
  label: { ...Typography.label, marginBottom: Spacing.sm },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 48,
  },
  input: { flex: 1, color: Colors.textPrimary, fontFamily: 'Poppins-Regular', fontSize: 14 },
  errorText: { color: Colors.error, fontFamily: 'Poppins-Regular', fontSize: 12, marginTop: 4 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  colorDot: {
    width: 32, height: 32, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotSelected: {
    transform: [{ scale: 1.2 }],
    shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.xl,
  },
  previewDot: { width: 14, height: 14, borderRadius: Radius.full },
  previewText: { ...Typography.bodyMedium, flex: 1, fontSize: 14 },
  btnRow: { flexDirection: 'row', gap: Spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.lg,
    backgroundColor: Colors.surface, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelText: { ...Typography.bodyMedium, color: Colors.textMuted },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: Radius.lg,
    backgroundColor: Colors.gold, ...Shadows.goldGlow,
  },
  saveText: { color: Colors.textInverse, fontFamily: 'Poppins-SemiBold', fontSize: 14 },
  });
}

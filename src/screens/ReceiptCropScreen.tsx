/**
 * Freeform receipt crop screen.
 * Shows the image full-screen with a draggable, resizable crop box (all directions, up to full image).
 * Works on both iOS and Android.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { RootStackParamList } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HANDLE_SIZE = 44;
const MIN_CROP = 50;
const CROP_BORDER_WIDTH = 2;
const DIM_COLOR = 'rgba(0,0,0,0.6)';

type ReceiptCropRouteProp = RouteProp<RootStackParamList, 'ReceiptCrop'>;
type ReceiptCropNavProp = StackNavigationProp<RootStackParamList, 'ReceiptCrop'>;

export default function ReceiptCropScreen() {
  const navigation = useNavigation<ReceiptCropNavProp>();
  const route = useRoute<ReceiptCropRouteProp>();
  const params = route.params ?? {};
  const imageUri = params.imageUri;
  const returnTo = params.returnTo ?? 'AddReceipt';
  const receiptIdToUpdate = params.receiptIdToUpdate;

  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [containerLayout, setContainerLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const imageDisplayRect = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const containerRef = useRef<View>(null);
  const lastCropRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const containerLayoutRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const clampCropRef = useRef<(c: { x: number; y: number; width: number; height: number }) => { x: number; y: number; width: number; height: number }>((c) => c);
  lastCropRef.current = crop;
  containerLayoutRef.current = containerLayout;

  // Compute the rect where the image is actually drawn (contain mode)
  const updateImageDisplayRect = useCallback(() => {
    if (!containerLayout || !imageSize) return;
    const { width: cw, height: ch } = containerLayout;
    const { width: iw, height: ih } = imageSize;
    const scale = Math.min(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const x = (cw - dw) / 2;
    const y = (ch - dh) / 2;
    imageDisplayRect.current = { x, y, width: dw, height: dh };
  }, [containerLayout, imageSize]);

  useEffect(() => {
    if (!imageUri) {
      navigation.goBack();
      return;
    }
    Image.getSize(
      imageUri,
      (w, h) => setImageSize({ width: w, height: h }),
      () => Alert.alert('Error', 'Could not load image')
    );
  }, [imageUri, navigation]);

  useEffect(() => {
    updateImageDisplayRect();
    const r = imageDisplayRect.current;
    // Only set initial crop when we have a valid display rect (avoids wrong crop from stale layout)
    if (r && r.width >= 50 && r.height >= 50 && !crop) {
      setCrop({ x: r.x, y: r.y, width: r.width, height: r.height });
    }
  }, [containerLayout, imageSize, updateImageDisplayRect]);

  const clampCrop = useCallback((c: { x: number; y: number; width: number; height: number }) => {
    const r = imageDisplayRect.current;
    if (!r) return c;
    let { x, y, width, height } = c;
    x = Math.max(r.x, Math.min(r.x + r.width - MIN_CROP, x));
    y = Math.max(r.y, Math.min(r.y + r.height - MIN_CROP, y));
    width = Math.max(MIN_CROP, Math.min(r.x + r.width - x, width));
    height = Math.max(MIN_CROP, Math.min(r.y + r.height - y, height));
    return { x, y, width, height };
  }, []);
  clampCropRef.current = clampCrop;

  const hitTest = useCallback((px: number, py: number) => {
    const current = lastCropRef.current;
    if (!current) return 'center';
    const { x, y, width, height } = current;
    const cx = x + width / 2;
    const cy = y + height / 2;
    if (px <= x + HANDLE_SIZE && py <= y + HANDLE_SIZE) return 'tl';
    if (px >= x + width - HANDLE_SIZE && py <= y + HANDLE_SIZE) return 'tr';
    if (px <= x + HANDLE_SIZE && py >= y + height - HANDLE_SIZE) return 'bl';
    if (px >= x + width - HANDLE_SIZE && py >= y + height - HANDLE_SIZE) return 'br';
    if (px <= x + HANDLE_SIZE) return 'l';
    if (px >= x + width - HANDLE_SIZE) return 'r';
    if (py <= y + HANDLE_SIZE) return 't';
    if (py >= y + height - HANDLE_SIZE) return 'b';
    return 'center';
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, g) => {
        const layout = containerLayoutRef.current ?? { x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT };
        const localX = g.pageX - layout.x;
        const localY = g.pageY - layout.y;
        const handle = hitTest(localX, localY);
        (panResponder as any).currentHandle = handle;
        (panResponder as any).startCrop = lastCropRef.current ? { ...lastCropRef.current } : null;
        (panResponder as any).startX = g.pageX;
        (panResponder as any).startY = g.pageY;
      },
      onPanResponderMove: (_, g) => {
        const start = (panResponder as any).startCrop as { x: number; y: number; width: number; height: number } | null;
        if (!start) return;
        const handle = (panResponder as any).currentHandle as string;
        const dx = g.pageX - (panResponder as any).startX;
        const dy = g.pageY - (panResponder as any).startY;
        (panResponder as any).startX = g.pageX;
        (panResponder as any).startY = g.pageY;

        let next = { ...start };
        if (handle === 'center') {
          next.x = start.x + dx;
          next.y = start.y + dy;
        } else if (handle === 'tl') {
          next.x = start.x + dx;
          next.y = start.y + dy;
          next.width = start.width - dx;
          next.height = start.height - dy;
        } else if (handle === 'tr') {
          next.y = start.y + dy;
          next.width = start.width + dx;
          next.height = start.height - dy;
        } else if (handle === 'bl') {
          next.x = start.x + dx;
          next.width = start.width - dx;
          next.height = start.height + dy;
        } else if (handle === 'br') {
          next.width = start.width + dx;
          next.height = start.height + dy;
        } else if (handle === 't') {
          next.y = start.y + dy;
          next.height = start.height - dy;
        } else if (handle === 'b') {
          next.height = start.height + dy;
        } else if (handle === 'l') {
          next.x = start.x + dx;
          next.width = start.width - dx;
        } else if (handle === 'r') {
          next.width = start.width + dx;
        }
        const clamped = clampCropRef.current(next);
        setCrop(clamped);
        (panResponder as any).startCrop = clamped;
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  const onContainerLayout = useCallback(() => {
    containerRef.current?.measureInWindow((x, y, width, height) => {
      setContainerLayout({ x, y, width, height });
    });
  }, []);

  /** Use the original image without cropping (best for OCR so the full receipt is visible). */
  const handleUseFullImage = () => {
    if (returnTo === 'AddReceipt') {
      navigation.navigate('AddReceipt', { croppedImageUri: imageUri }, { merge: true });
    } else {
      navigation.navigate('Receipts', { croppedImageUri: imageUri, receiptIdToUpdate: receiptIdToUpdate ?? undefined }, { merge: true });
    }
  };

  const handleDone = async () => {
    const r = imageDisplayRect.current;
    const cropToUse = crop ?? (r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null);
    if (!cropToUse || !r || !imageSize || !imageUri) {
      if (!cropToUse || !r) Alert.alert('Please wait', 'Crop area is still loading.');
      return;
    }
    const scaleX = imageSize.width / r.width;
    const scaleY = imageSize.height / r.height;
    let originX = Math.round((cropToUse.x - r.x) * scaleX);
    let originY = Math.round((cropToUse.y - r.y) * scaleY);
    let width = Math.round(cropToUse.width * scaleX);
    let height = Math.round(cropToUse.height * scaleY);
    // Clamp to image bounds (avoids wrong crop when display coords don't match image)
    originX = Math.max(0, Math.min(originX, imageSize.width - 1));
    originY = Math.max(0, Math.min(originY, imageSize.height - 1));
    width = Math.max(1, Math.min(width, imageSize.width - originX));
    height = Math.max(1, Math.min(height, imageSize.height - originY));
    if (width < 1 || height < 1) {
      Alert.alert('Invalid crop', 'Crop area is too small.');
      return;
    }
    setSaving(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      if (returnTo === 'AddReceipt') {
        navigation.navigate('AddReceipt', { croppedImageUri: result.uri }, { merge: true });
      } else {
        navigation.navigate('Receipts', { croppedImageUri: result.uri, receiptIdToUpdate: receiptIdToUpdate ?? undefined }, { merge: true });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to crop image.');
    } finally {
      setSaving(false);
    }
  };

  if (!imageSize || !imageUri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <MaterialIcons name="close" size={24} color="#fff" />
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crop receipt</Text>
          <TouchableOpacity
            onPress={handleDone}
            disabled={saving || !crop}
            style={styles.headerButton}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.headerButtonText, !crop && styles.headerButtonTextDisabled]}>Done</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.useFullImageRow}>
        <TouchableOpacity onPress={handleUseFullImage} style={styles.useFullImageButton}>
          <MaterialIcons name="fullscreen" size={20} color="#fff" />
          <Text style={styles.useFullImageText}>Use full image (no crop)</Text>
        </TouchableOpacity>
        <Text style={styles.useFullImageHint}>Best for OCR – keeps entire receipt visible</Text>
      </View>

      <View ref={containerRef} style={styles.imageContainer} onLayout={onContainerLayout} {...panResponder.panHandlers}>
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        {containerLayout && crop && (
          <>
            {/* Dimmed overlay (4 regions around crop) */}
            <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
              <View style={[styles.dim, { top: 0, left: 0, right: 0, height: crop.y }]} />
              <View style={[styles.dim, { top: crop.y, left: 0, width: crop.x, height: crop.height }]} />
              <View style={[styles.dim, { top: crop.y, left: crop.x + crop.width, right: 0, height: crop.height }]} />
              <View style={[styles.dim, { top: crop.y + crop.height, left: 0, right: 0, bottom: 0 }]} />
              <View
                style={[
                  styles.cropBox,
                  {
                    left: crop.x,
                    top: crop.y,
                    width: crop.width,
                    height: crop.height,
                  },
                ]}
              />
            </View>
          </>
        )}
      </View>
      <Text style={styles.hint}>Drag the box to move. Drag corners or edges to resize. Or use “Use full image” above for OCR.</Text>
    </View>
  );
}

// Fix: PanResponder grant/move need latest crop; store startCrop on grant and use it in move
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  headerSafeArea: { backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: { minWidth: 70, flexDirection: 'row', alignItems: 'center' },
  headerButtonText: { color: '#fff', fontSize: 16 },
  headerButtonTextDisabled: { opacity: 0.6 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  useFullImageRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
  },
  useFullImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    gap: 8,
  },
  useFullImageText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  useFullImageHint: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },
  imageContainer: { flex: 1, overflow: 'hidden' },
  dim: { position: 'absolute', backgroundColor: DIM_COLOR },
  cropBox: {
    position: 'absolute',
    borderWidth: CROP_BORDER_WIDTH,
    borderColor: '#fff',
  },
  hint: { color: '#999', textAlign: 'center', paddingVertical: 12, paddingHorizontal: 16, fontSize: 12 },
});

import * as ImageManipulator from 'expo-image-manipulator';
import { API_BASE_URL } from '../config/api';

const PDF_EXT = /\.pdf$/i;
const JPEG_EXT = /\.(jpe?g)$/i;

/**
 * Resolve a stored receipt imageUri for display (local file, data URL, or backend /uploads/ path).
 */
export function resolveReceiptImageUri(imageUri: string | undefined | null): string {
  if (!imageUri || imageUri.trim() === '') return '';

  if (
    imageUri.startsWith('http://') ||
    imageUri.startsWith('https://') ||
    imageUri.startsWith('data:') ||
    imageUri.startsWith('file://') ||
    imageUri.startsWith('content://') ||
    imageUri.startsWith('ph://')
  ) {
    return imageUri;
  }

  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '');

  if (imageUri.startsWith('/uploads/')) {
    return `${baseUrl}${imageUri}`;
  }
  if (imageUri.startsWith('uploads/')) {
    return `${baseUrl}/${imageUri}`;
  }

  const filename = imageUri.startsWith('/') ? imageUri.substring(1) : imageUri;
  return `${baseUrl}/uploads/${filename}`;
}

/**
 * iPhone photos (including edited B&W HEIC) must be JPEG before upload — browsers
 * cannot render HEIC on the staff portal, and mislabeled HEIC-as-JPEG corrupts the file.
 */
export async function normalizeReceiptImageUri(uri: string): Promise<string> {
  const pathOnly = uri.split('?')[0];
  if (!uri || PDF_EXT.test(pathOnly)) {
    return uri;
  }

  if (JPEG_EXT.test(pathOnly)) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch {
      // Fall through — upload path will retry normalization server-side.
    }
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    console.warn('Could not normalize receipt image to JPEG, using original:', error);
    return uri;
  }
}

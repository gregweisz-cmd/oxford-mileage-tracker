import * as ImageManipulator from 'expo-image-manipulator';

const PDF_EXT = /\.pdf$/i;
const JPEG_EXT = /\.(jpe?g)$/i;

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

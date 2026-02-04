/**
 * Receipt OCR Service
 * Extracts information from receipt images using Google Cloud Vision API via backend
 */

import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '../config/api';

export interface OcrResult {
  vendor: string;
  amount: number | null;
  date: Date | null;
  suggestedCategory?: string;
  confidence: {
    vendor: number;
    amount: number;
    date: number;
    overall: number;
  };
  rawText: string;
}

/** Thrown when OCR fails so the UI can show a message (e.g. server not configured). */
export class OcrError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly isConfigError?: boolean
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

export class ReceiptOcrService {
  // Base URL without /api for receipt OCR path: .../api/receipts/ocr
  private static getBaseUrl = (): string =>
    (API_BASE_URL ?? '').replace(/\/api\/?$/, '') || 'https://oxford-mileage-backend.onrender.com';

  /**
   * Get a file URI we can read as base64. On Android, content:// URIs may not be
   * readable by FileSystem; copy to cache first if needed.
   */
  private static async getReadableImageUri(imageUri: string): Promise<string> {
    const uri = imageUri.trim();
    if (!uri) throw new OcrError('Empty image URI', 'No image to process.');

    // If it's already a file URI, try reading directly; if that fails, try copy
    if (uri.startsWith('file://')) {
      try {
        await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        return uri;
      } catch {
        // Fall through to copy
      }
    }

    // content:// or unreadable file: copy to cache then read
    const cacheDir = FileSystem.cacheDirectory ?? '';
    const destUri = `${cacheDir}receipt-ocr-${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: uri, to: destUri });
    } catch (copyErr) {
      console.warn('📸 OCR: copyAsync failed, trying readAsStringAsync directly:', copyErr);
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        if (base64 && base64.length > 0) return uri;
      } catch {
        // ignore
      }
      throw new OcrError(
        `Could not read image: ${copyErr instanceof Error ? copyErr.message : 'unknown'}`,
        'Could not read the receipt image. Try taking the photo again.'
      );
    }
    return destUri;
  }

  /**
   * Process receipt image and extract information using backend OCR.
   * Throws OcrError when the server is not configured or the request fails (so UI can show an alert).
   */
  static async processReceipt(imageUri: string): Promise<OcrResult> {
    console.log('📸 OCR: Processing receipt image:', imageUri);

    const readableUri = await ReceiptOcrService.getReadableImageUri(imageUri);
    const base64 = await FileSystem.readAsStringAsync(readableUri, {
      encoding: 'base64' as any,
    });
    const base64WithPrefix = `data:image/jpeg;base64,${base64}`;

    console.log('📸 OCR: Sending image to backend for processing...');

    const response = await fetch(`${ReceiptOcrService.getBaseUrl()}/api/receipts/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64WithPrefix }),
    });

    let data: { success?: boolean; message?: string; vendor?: string; amount?: number | null; date?: string | null; suggestedCategory?: string; text?: string } = {};
    try {
      data = await response.json();
    } catch {
      // non-JSON response
    }
    console.log('📸 OCR: Response from backend:', data);

    if (!response.ok) {
      const msg = data?.message ?? data?.error ?? response.statusText;
      if (response.status === 503) {
        throw new OcrError(
          `OCR not configured: ${msg}`,
          'Receipt OCR is not set up on the server. Your admin can add GOOGLE_VISION_API_KEY to enable it.',
          true
        );
      }
      throw new OcrError(
        `OCR API error ${response.status}: ${msg}`,
        'Receipt OCR failed. Check your connection and try again.'
      );
    }

    if (!data.success) {
      console.log('⚠️ OCR: No text detected');
      return {
        vendor: '',
        amount: null,
        date: null,
        confidence: {
          vendor: 0,
          amount: 0,
          date: 0,
          overall: 0
        },
        rawText: (data as any).text ?? ''
      };
    }

    const hasVendor = data.vendor != null && String(data.vendor).length > 0;
    const hasAmount = data.amount != null;
    const hasDate = data.date != null;

    const vendorConfidence = hasVendor ? 0.9 : 0;
    const amountConfidence = hasAmount ? 0.9 : 0;
    const dateConfidence = hasDate ? 0.9 : 0;

    const result: OcrResult = {
      vendor: data.vendor ?? '',
      amount: data.amount ?? null,
      date: data.date ? new Date(data.date) : null,
      suggestedCategory: data.suggestedCategory,
      confidence: {
        vendor: vendorConfidence,
        amount: amountConfidence,
        date: dateConfidence,
        overall: (vendorConfidence + amountConfidence + dateConfidence) / 3
      },
      rawText: data.text ?? ''
    };

    console.log('✅ OCR: Extraction complete:', result);
    return result;
  }
}


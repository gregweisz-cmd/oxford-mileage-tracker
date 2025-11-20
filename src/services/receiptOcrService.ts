/**
 * Receipt OCR Service
 * Extracts information from receipt images using Google Cloud Vision API via backend
 */

import * as FileSystem from 'expo-file-system/legacy';

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

export class ReceiptOcrService {
  // Use local network IP for mobile device development, or localhost for web/simulator
  private static readonly API_BASE_URL = __DEV__ 
    ? 'http://192.168.86.101:3002'  // Change to your computer's local IP address
    : 'https://oxford-mileage-backend.onrender.com';

  /**
   * Process receipt image and extract information using backend OCR
   */
  static async processReceipt(imageUri: string): Promise<OcrResult> {
    try {
      console.log('📸 OCR: Processing receipt image:', imageUri);
      
      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64' as any,
      });
      const base64WithPrefix = `data:image/jpeg;base64,${base64}`;
      
      console.log('📸 OCR: Sending image to backend for processing...');
      
      // Call backend OCR endpoint
      const response = await fetch(`${this.API_BASE_URL}/api/receipts/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64WithPrefix }),
      });
      
      if (!response.ok) {
        throw new Error(`OCR API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📸 OCR: Response from backend:', data);
      
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
          rawText: ''
        };
      }
      
      // Calculate confidence based on what we extracted
      const hasVendor = data.vendor && data.vendor.length > 0;
      const hasAmount = data.amount !== null;
      const hasDate = data.date !== null;
      
      const vendorConfidence = hasVendor ? 0.9 : 0;
      const amountConfidence = hasAmount ? 0.9 : 0;
      const dateConfidence = hasDate ? 0.9 : 0;
      
      const confidenceScores = {
        vendor: vendorConfidence,
        amount: amountConfidence,
        date: dateConfidence,
        overall: (vendorConfidence + amountConfidence + dateConfidence) / 3
      };
      
      const result: OcrResult = {
        vendor: data.vendor || '',
        amount: data.amount || null,
        date: data.date ? new Date(data.date) : null,
        suggestedCategory: data.suggestedCategory || undefined,
        confidence: confidenceScores,
        rawText: data.text || ''
      };
      
      console.log('✅ OCR: Extraction complete:', result);
      return result;
    } catch (error) {
      console.error('❌ OCR: Error processing receipt:', error);
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
        rawText: ''
      };
    }
  }

}


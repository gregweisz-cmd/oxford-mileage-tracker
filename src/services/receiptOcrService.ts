/**
 * Receipt OCR Service
 * Extracts information from receipt images using Tesseract.js
 */

import { createWorker } from 'tesseract.js';

export interface OcrResult {
  vendor: string;
  amount: number | null;
  date: Date | null;
  confidence: {
    vendor: number;
    amount: number;
    date: number;
    overall: number;
  };
  rawText: string;
}

export class ReceiptOcrService {
  private static worker: any = null;

  /**
   * Initialize OCR worker
   */
  private static async initializeWorker() {
    if (!this.worker) {
      this.worker = await createWorker('eng');
      console.log('✅ OCR: Worker initialized');
    }
    return this.worker;
  }

  /**
   * Process receipt image and extract information
   */
  static async processReceipt(imageUri: string): Promise<OcrResult> {
    try {
      console.log('📸 OCR: Processing receipt image:', imageUri);
      
      const worker = await this.initializeWorker();
      
      // Perform OCR
      const { data } = await worker.recognize(imageUri);
      const rawText = data.text;
      
      console.log('📝 OCR: Raw text extracted:', rawText);

      // Extract vendor (usually first line or most prominent text)
      const vendor = this.extractVendor(rawText);
      
      // Extract amount (look for dollar amounts)
      const amountResult = this.extractAmount(rawText);
      
      // Extract date (look for date patterns)
      const dateResult = this.extractDate(rawText);

      // Calculate overall confidence
      const overallConfidence = (
        amountResult.confidence +
        dateResult.confidence +
        (vendor.length > 0 ? 0.7 : 0)
      ) / 3;

      const result: OcrResult = {
        vendor,
        amount: amountResult.amount,
        date: dateResult.date,
        confidence: {
          vendor: vendor.length > 0 ? 0.7 : 0,
          amount: amountResult.confidence,
          date: dateResult.confidence,
          overall: overallConfidence
        },
        rawText
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

  /**
   * Extract vendor name from text
   */
  private static extractVendor(text: string): string {
    // Get first few lines (vendor name is usually at top)
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) return '';

    // First non-empty line is usually the vendor
    let vendor = lines[0].trim();

    // Clean up common OCR artifacts
    vendor = vendor.replace(/[^\w\s&'-]/g, '');
    vendor = vendor.trim();

    // Limit length
    if (vendor.length > 50) {
      vendor = vendor.substring(0, 50);
    }

    return vendor;
  }

  /**
   * Extract amount from text
   */
  private static extractAmount(text: string): { amount: number | null; confidence: number } {
    // Look for dollar amounts
    const amountPatterns = [
      /\$\s*(\d+\.\d{2})/g,  // $XX.XX
      /(\d+\.\d{2})\s*USD/gi, // XX.XX USD
      /TOTAL[:\s]*\$?\s*(\d+\.\d{2})/gi, // TOTAL: $XX.XX
      /AMOUNT[:\s]*\$?\s*(\d+\.\d{2})/gi, // AMOUNT: $XX.XX
    ];

    const amounts: number[] = [];

    // Try each pattern
    for (const pattern of amountPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const amount = parseFloat(match[1]);
        if (amount > 0 && amount < 10000) { // Reasonable range
          amounts.push(amount);
        }
      }
    }

    if (amounts.length === 0) {
      return { amount: null, confidence: 0 };
    }

    // Usually the largest amount is the total
    const maxAmount = Math.max(...amounts);
    
    // Confidence is higher if we found it with "TOTAL" or "AMOUNT" label
    const hasLabel = /TOTAL|AMOUNT/i.test(text);
    const confidence = hasLabel ? 0.9 : 0.6;

    return { amount: maxAmount, confidence };
  }

  /**
   * Extract date from text
   */
  private static extractDate(text: string): { date: Date | null; confidence: number } {
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g,  // MM/DD/YYYY or M/D/YY
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/g,    // MM-DD-YYYY
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})[,\s]+(\d{4})/gi, // Month DD, YYYY
    ];

    for (const pattern of datePatterns) {
      const match = pattern.exec(text);
      if (match) {
        try {
          let date: Date;
          
          if (match[0].includes('/') || match[0].includes('-')) {
            // Numeric date
            const month = parseInt(match[1]);
            const day = parseInt(match[2]);
            let year = parseInt(match[3]);
            
            // Handle 2-digit years
            if (year < 100) {
              year += year < 50 ? 2000 : 1900;
            }

            date = new Date(year, month - 1, day);
          } else {
            // Named month date
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthIndex = monthNames.findIndex(m => match[1].toLowerCase().startsWith(m.toLowerCase()));
            const day = parseInt(match[2]);
            const year = parseInt(match[3]);
            
            date = new Date(year, monthIndex, day);
          }

          // Validate date is reasonable (within last year)
          const now = new Date();
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

          if (date >= oneYearAgo && date <= now) {
            return { date, confidence: 0.8 };
          }
        } catch (error) {
          console.log('OCR: Invalid date format, continuing search...');
        }
      }
    }

    // Default to today if no date found
    return { date: new Date(), confidence: 0.3 };
  }

  /**
   * Cleanup worker when done
   */
  static async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      console.log('🗑️ OCR: Worker terminated');
    }
  }
}


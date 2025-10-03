# Receipt OCR Feature 📸✨

## Overview

The Receipt OCR (Optical Character Recognition) feature automatically extracts vendor name, amount, and date from receipt images, making expense tracking faster and more accurate.

## How It Works

### Current Implementation (Pattern Matching)

The current implementation uses **intelligent pattern matching** to extract data from receipts:

1. **Image Capture**: User takes a photo or selects from gallery
2. **Automatic Processing**: OCR service analyzes the image
3. **Data Extraction**: Extracts:
   - **Vendor/Merchant Name** (from top of receipt)
   - **Amount** (looks for dollar values and "TOTAL" keywords)
   - **Date** (supports multiple date formats)
4. **Auto-Fill**: Pre-populates the form fields
5. **User Review**: User can review and adjust as needed

### Patterns Detected

#### Amounts
- `$12.34` or `12.34`
- `$1,234.56`
- `TOTAL: $12.34`
- `AMOUNT: $12.34`

#### Dates
- `MM/DD/YYYY` (e.g., 09/30/2025)
- `MM-DD-YYYY` (e.g., 09-30-2025)
- `Month DD, YYYY` (e.g., Sep 30, 2025)
- `DD Month YYYY` (e.g., 30 Sep 2025)

#### Vendor Names
- Extracted from first 5 lines of receipt
- Filters out numbers, dates, and amounts
- Selects the longest meaningful text

## Usage

### For Users

1. **Add Receipt Screen**
   - Tap "Take Photo" or "Select from Gallery"
   - Take/select a clear photo of your receipt
   - Wait for "Scanning..." indicator
   - Review auto-filled information
   - Adjust if needed
   - Save receipt

### Tips for Best Results

✅ **DO:**
- Take photos in good lighting
- Ensure receipt is flat and readable
- Center the receipt in the frame
- Use the built-in cropping feature

❌ **AVOID:**
- Blurry or dark images
- Folded or crumpled receipts
- Extreme angles
- Low resolution images

## Upgrading to Production OCR

For production use, we recommend integrating with a professional OCR API:

### Option 1: Google Cloud Vision API (Recommended)

**Pros:**
- Very high accuracy (95%+)
- Supports multiple languages
- Excellent with various receipt formats
- Handles handwriting

**Setup:**
1. Get API key from Google Cloud Console
2. Enable Vision API
3. Use the `processWithGoogleVision()` method

**Cost:**
- First 1,000 requests/month: FREE
- $1.50 per 1,000 requests after that

**Implementation:**
```typescript
// In AddReceiptScreen.tsx, replace:
const ocrResult = await ReceiptOcrService.processReceipt(uri);

// With:
const apiKey = 'YOUR_GOOGLE_CLOUD_API_KEY';
const ocrResult = await ReceiptOcrService.processWithGoogleVision(uri, apiKey);
```

### Option 2: AWS Textract

**Pros:**
- Very accurate
- Built-in receipt parsing
- Extracts line items
- AWS ecosystem integration

**Cost:**
- $1.50 per 1,000 pages

### Option 3: Azure Computer Vision

**Pros:**
- Good accuracy
- Microsoft ecosystem
- Read API for text extraction

**Cost:**
- First 5,000 transactions/month: FREE
- $1.00 per 1,000 transactions after

## Technical Details

### Files

- `src/services/receiptOcrService.ts` - Main OCR service
- `src/screens/AddReceiptScreen.tsx` - UI integration

### Key Functions

#### `processReceipt(imageUri)`
Main entry point for OCR processing.

#### `parseReceiptText(text)`
Parses extracted text to find vendor, amount, and date.

#### `processWithGoogleVision(imageUri, apiKey)`
Premium OCR using Google Cloud Vision API.

### Confidence Scoring

The OCR service calculates a confidence score (0-1) based on:
- **+0.4** if vendor name found
- **+0.3** if amount found
- **+0.3** if date found

Results are only shown if confidence > 0.3.

## Future Enhancements

### Planned Features

1. **Line Item Extraction** 📋
   - Extract individual items from receipt
   - Itemized expense tracking

2. **Receipt Categories AI** 🤖
   - Auto-suggest category based on vendor
   - Learn from user's past categorizations

3. **Multi-Receipt Batch Processing** 📚
   - Scan multiple receipts at once
   - Bulk import

4. **Receipt Verification** ✅
   - Cross-reference with business rules
   - Flag suspicious amounts

5. **Offline OCR** 📴
   - Process receipts without internet
   - Using on-device ML models

## Troubleshooting

### OCR Not Working

**Problem**: No data extracted from receipt

**Solutions**:
1. Check image quality - retake photo if blurry
2. Ensure receipt text is readable
3. Try cropping to only the receipt
4. Enter data manually if needed

### Wrong Data Extracted

**Problem**: OCR extracts incorrect information

**Solutions**:
1. Always review auto-filled data
2. Manually correct any errors
3. Report common errors for pattern improvement

### Performance Issues

**Problem**: OCR processing is slow

**Solutions**:
1. Use lower resolution images (0.8 quality is optimal)
2. Crop unnecessary parts before scanning
3. Consider upgrading to cloud OCR for faster processing

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Try manual entry as fallback
3. Report persistent issues for investigation

---

**Built with** ❤️ **for Oxford House expense tracking**


# Checking if receipt PDF/image reaches the backend

When you upload a receipt (image or PDF) in the Staff Portal, you can confirm it hits the backend by watching the **terminal where the backend is running** (`npm start`).

## 1. When you upload or change a receipt image

**If the file is sent as base64 in the receipt (PUT /api/receipts):**

- You should see a line like:
  - `📥 PUT /receipts/<id>: imageUri type=PDF (data URL), length=...`  
    or  
  - `📥 PUT /receipts/<id>: imageUri type=image (data URL), length=...`  
    or  
  - `📥 PUT /receipts/<id>: imageUri type=path, length=...`

**If the app uses the upload-image endpoint first (POST /api/receipts/upload-image):**

- You should see:
  - `📸 POST /receipts/upload-image: receiptId=..., type=PDF, base64 length=...`  
    or  
  - `📸 POST /receipts/upload-image: receiptId=..., type=image, base64 length=...`
- Then: `📸 Saving file to: ...` and `✅ File saved successfully: <filename>`

**If you see no such lines** when you upload or change a receipt, the request is not reaching the backend (check network tab in browser dev tools, or CORS/URL).

## 2. When you download the report (export PDF)

During export you should see:

- For each receipt in the report:
  - `📄 Receipt 1 (id=...): imageUri type=PDF data URL` (or `image data URL` or `path`), and `length=...`
  - Or: `📄 Receipt 1 (id=...): no imageUri` if the receipt has no image.
- Then:
  - `📄 Receipt media: X image(s) to render, Y PDF(s) to embed`
- If there are PDFs to embed:
  - `📎 Embedding PDF receipt 1/Y (base64)...` (or `file`)
  - `✅ Embedded PDF receipt 1: N page(s), ... bytes`  
  - Or an error: `⚠️ Could not embed PDF receipt ...`

**If you see `no imageUri`** for a receipt when exporting, the saved report data doesn’t have an image for that receipt (e.g. report was saved before the image was added, or the image wasn’t persisted).

**If you see `Receipt media: 0 image(s), 0 PDF(s)`** but the receipt has an imageUri in the UI, the export is using a different snapshot of the report (e.g. from `expense_reports.reportData`) that doesn’t include the latest receipt image.

## 3. Quick checklist

1. Upload or change a receipt in the Staff Portal.
2. In the backend terminal, confirm you see either:
   - `PUT /receipts/... imageUri type=...` or
   - `POST /receipts/upload-image ... type=PDF/image ...`
3. Save the report (so the current month’s report is updated).
4. Download the report PDF.
5. In the terminal, confirm:
   - `📄 Receipt N: imageUri type=...` (not `no imageUri`),
   - `Receipt media: ... image(s), ... PDF(s)` with at least one,
   - and for PDFs: `✅ Embedded PDF receipt ...`.

If step 2 never appears, the upload isn’t reaching the backend. If step 2 appears but step 5 shows `no imageUri` or `0 PDF(s)`, the report snapshot doesn’t include the receipt image (e.g. save report again after uploading).

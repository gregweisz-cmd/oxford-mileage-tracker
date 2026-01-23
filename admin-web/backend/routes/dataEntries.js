/**
 * Data Entries Routes
 * Extracted from server.js for better organization
 * Includes: mileage entries, receipts, time tracking, daily descriptions
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const multer = require('multer');
const vision = require('@google-cloud/vision');
const dbService = require('../services/dbService');
const dateHelpers = require('../utils/dateHelpers');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { debugLog, debugWarn, debugError } = require('../debug');
const { checkAndNotify50PlusHours } = require('../services/notificationService');
const websocketService = require('../services/websocketService');

// Set up uploads directory and multer
const uploadsDir = path.join(__dirname, '..', 'uploads');
const upload = multer({ dest: uploadsDir });

// ===== MILEAGE ENTRIES ROUTES =====

/**
 * Debug endpoint - Get all mileage entries without date filtering (for troubleshooting)
 */
router.get('/api/mileage-entries/debug', (req, res) => {
  const { employeeId } = req.query;
  const db = dbService.getDb();
  
  let query = `
    SELECT me.id, me.date, me.startLocation, me.endLocation, me.miles, me.createdAt, me.updatedAt
    FROM mileage_entries me 
  `;
  const params = [];

  if (employeeId) {
    query += ' WHERE me.employeeId = ?';
    params.push(employeeId);
  }

  query += ' ORDER BY me.date DESC LIMIT 50';

  db.all(query, params, (err, rows) => {
    if (err) {
      debugError('❌ Debug query error:', err);
      return res.status(500).json({ error: err.message });
    }
    debugLog(`🔍 Debug query found ${rows.length} entries`);
    res.json({ count: rows.length, entries: rows });
  });
});

/**
 * Get all mileage entries
 */
router.get('/api/mileage-entries', (req, res) => {
  const { employeeId, month, year } = req.query;
  const db = dbService.getDb();
  
  let query = `
    SELECT me.*, COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName, e.costCenters 
    FROM mileage_entries me 
    LEFT JOIN employees e ON me.employeeId = e.id 
  `;
  const params = [];
  const conditions = [];

  if (employeeId) {
    conditions.push('me.employeeId = ?');
    params.push(employeeId);
  }

  if (month && year) {
    // Handle dates stored as YYYY-MM-DD or ISO format (YYYY-MM-DDTHH:MM:SS...)
    // Extract year and month from first 7 characters (YYYY-MM) of the date string
    // This works for both "2024-11-26" and "2024-11-26T14:00:00.000Z" formats
    const monthPadded = month.toString().padStart(2, '0');
    // Use LIKE pattern to match YYYY-MM part at the start of the date string
    conditions.push(`me.date LIKE ?`);
    params.push(`${year}-${monthPadded}-%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY me.date DESC';

  // Debug logging
  debugLog('🔍 GET /api/mileage-entries - Query:', query);
  debugLog('🔍 GET /api/mileage-entries - Params:', params);
  debugLog('🔍 GET /api/mileage-entries - Request query:', req.query);

  db.all(query, params, (err, rows) => {
    if (err) {
      debugError('❌ Database error in GET /api/mileage-entries:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    debugLog(`✅ GET /api/mileage-entries - Found ${rows.length} entries`);
    if (rows.length > 0 && rows.length <= 3) {
      debugLog('🔍 Sample entries:', rows.map(r => ({ id: r.id, date: r.date, startLocation: r.startLocation })));
    }
    res.json(rows);
  });
});

/**
 * Create new mileage entry
 */
router.post('/api/mileage-entries', (req, res) => {
  debugLog('📝 POST /api/mileage-entries - Request body:', req.body);
  const db = dbService.getDb();
  
  const { 
    id,
    employeeId,
    oxfordHouseId,
    date,
    odometerReading,
    miles,
    startLocation,
    endLocation,
    startLocationName,
    startLocationAddress,
    startLocationLat,
    startLocationLng,
    endLocationName,
    endLocationAddress,
    endLocationLat,
    endLocationLng,
    purpose,
    notes,
    hoursWorked,
    isGpsTracked,
    costCenter
  } = req.body;
  // Use provided ID or generate a new one
  // IMPORTANT: Always use the provided ID if available to prevent duplicates
  const entryId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
  const now = new Date().toISOString();

  // Normalize date to YYYY-MM-DD format to avoid timezone issues with month/year filtering
  const normalizedDate = dateHelpers.normalizeDateString(date);
  if (!normalizedDate) {
    debugError('❌ Invalid date provided:', date);
    return res.status(400).json({ error: 'Invalid date format. Date is required.' });
  }

  // Use miles as odometerReading if odometerReading is not provided
  const finalOdometerReading = odometerReading || miles || 0;

  // Normalize manual entry locations into name/address fields if missing
  const normalizedStartLocationName = startLocationName || startLocation || '';
  const normalizedStartLocationAddress = startLocationAddress || startLocation || '';
  const normalizedEndLocationName = endLocationName || endLocation || '';
  const normalizedEndLocationAddress = endLocationAddress || endLocation || '';

  // Check if entry with this ID already exists
  db.get('SELECT id FROM mileage_entries WHERE id = ?', [entryId], (checkErr, existingRow) => {
    if (checkErr) {
      debugError('❌ Error checking for existing mileage entry:', checkErr);
      return res.status(500).json({ error: checkErr.message });
    }

    const isUpdate = !!existingRow;
    const action = isUpdate ? 'updated' : 'created';

    // Use INSERT OR REPLACE to handle both create and update cases
    // This ensures entries with the same ID are updated, not duplicated
    db.run(
      'INSERT OR REPLACE INTO mileage_entries (id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, startLocationName, startLocationAddress, startLocationLat, startLocationLng, endLocationName, endLocationAddress, endLocationLat, endLocationLng, purpose, miles, notes, hoursWorked, isGpsTracked, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM mileage_entries WHERE id = ?), ?), ?)',
      [
        entryId,
        employeeId,
        oxfordHouseId || '',
        normalizedDate,
        finalOdometerReading,
        startLocation || '',
        endLocation || '',
        normalizedStartLocationName,
        normalizedStartLocationAddress,
        startLocationLat || 0,
        startLocationLng || 0,
        normalizedEndLocationName,
        normalizedEndLocationAddress,
        endLocationLat || 0,
        endLocationLng || 0,
        purpose,
        miles,
        notes || '',
        hoursWorked || 0,
        isGpsTracked ? 1 : 0,
        costCenter || '',
        entryId,
        now,
        now
      ],
      function(err) {
        if (err) {
          debugError('Database error:', err.message);
          res.status(500).json({ error: err.message });
          return;
        }
        debugLog(`✅ Mileage entry ${action} successfully:`, entryId);
        
        // Broadcast WebSocket update
        websocketService.broadcastDataChange('mileage_entry', isUpdate ? 'update' : 'create', { id: entryId, employeeId, date: normalizedDate }, employeeId);
        
        res.json({ id: entryId, message: `Mileage entry ${action} successfully`, isUpdate });
      }
    );
  });
});

/**
 * Update mileage entry
 */
router.put('/api/mileage-entries/:id', (req, res) => {
  const { id } = req.params;
  const {
    employeeId,
    oxfordHouseId,
    date,
    odometerReading,
    miles,
    startLocation,
    endLocation,
    startLocationName,
    startLocationAddress,
    startLocationLat,
    startLocationLng,
    endLocationName,
    endLocationAddress,
    endLocationLat,
    endLocationLng,
    purpose,
    notes,
    hoursWorked,
    isGpsTracked,
    costCenter
  } = req.body;
  const now = new Date().toISOString();
  const db = dbService.getDb();
  
  // Normalize date to YYYY-MM-DD format to avoid timezone issues with month/year filtering
  const normalizedDate = dateHelpers.normalizeDateString(date);
  if (date && !normalizedDate) {
    debugError('❌ Invalid date provided:', date);
    return res.status(400).json({ error: 'Invalid date format.' });
  }
  
  // Use miles as odometerReading if odometerReading is not provided
  const finalOdometerReading = odometerReading || miles || 0;

  // Normalize manual entry locations into name/address fields if missing
  const normalizedStartLocationName = startLocationName || startLocation || '';
  const normalizedStartLocationAddress = startLocationAddress || startLocation || '';
  const normalizedEndLocationName = endLocationName || endLocation || '';
  const normalizedEndLocationAddress = endLocationAddress || endLocation || '';

  db.run(
    'UPDATE mileage_entries SET employeeId = ?, oxfordHouseId = ?, date = ?, odometerReading = ?, startLocation = ?, endLocation = ?, startLocationName = ?, startLocationAddress = ?, startLocationLat = ?, startLocationLng = ?, endLocationName = ?, endLocationAddress = ?, endLocationLat = ?, endLocationLng = ?, purpose = ?, miles = ?, notes = ?, hoursWorked = ?, isGpsTracked = ?, costCenter = ?, updatedAt = ? WHERE id = ?',
    [
      employeeId,
      oxfordHouseId || '',
      normalizedDate || date,
      finalOdometerReading,
      startLocation || '',
      endLocation || '',
      normalizedStartLocationName,
      normalizedStartLocationAddress,
      startLocationLat || 0,
      startLocationLng || 0,
      normalizedEndLocationName,
      normalizedEndLocationAddress,
      endLocationLat || 0,
      endLocationLng || 0,
      purpose,
      miles,
      notes || '',
      hoursWorked || 0,
      isGpsTracked ? 1 : 0,
      costCenter || '',
      now,
      id
    ],
    function(err) {
      if (err) {
        debugError('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      // Broadcast WebSocket update
      websocketService.broadcastDataChange('mileage_entry', 'update', { id, employeeId, date: normalizedDate || date }, employeeId);
      
      res.json({ message: 'Mileage entry updated successfully' });
    }
  );
});

/**
 * Delete mileage entry
 */
router.delete('/api/mileage-entries/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  
  // Get mileage entry info before deleting for WebSocket broadcast
  db.get('SELECT employeeId FROM mileage_entries WHERE id = ?', [id], (getErr, entry) => {
    if (getErr) {
      res.status(500).json({ error: getErr.message });
      return;
    }
    
    db.run('DELETE FROM mileage_entries WHERE id = ?', [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Broadcast WebSocket update
      if (entry && entry.employeeId) {
        websocketService.broadcastDataChange('mileage_entry', 'delete', { id }, entry.employeeId);
      }
      
      res.json({ message: 'Mileage entry deleted successfully' });
    });
  });
});

// ===== RECEIPTS ROUTES =====

/**
 * Get all receipts
 */
router.get('/api/receipts', (req, res) => {
  const { employeeId, month, year } = req.query;
  const db = dbService.getDb();
  let query = `
    SELECT r.*, e.name as employeeName, e.costCenters 
    FROM receipts r 
    LEFT JOIN employees e ON r.employeeId = e.id 
  `;
  const params = [];
  const conditions = [];

  if (employeeId) {
    conditions.push('r.employeeId = ?');
    params.push(employeeId);
  }

  if (month && year) {
    conditions.push('strftime("%m", r.date) = ? AND strftime("%Y", r.date) = ?');
    params.push(month.toString().padStart(2, '0'), year.toString());
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY r.date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

/**
 * Create new receipt
 */
router.post('/api/receipts', (req, res) => {
  // Validate that "Other" category receipts have descriptions
  if (req.body.category === 'Other' && (!req.body.description || !req.body.description.trim())) {
    return res.status(400).json({ 
      error: 'Description is required for Other Expenses so Finance knows what the money was spent on' 
    });
  }
  const { id, employeeId, date, amount, vendor, description, category, imageUri } = req.body;
  const receiptId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
  const now = new Date().toISOString();
  const db = dbService.getDb();

  // Normalize date to YYYY-MM-DD format to avoid timezone issues with month/year filtering
  const dateHelpers = require('../utils/dateHelpers');
  const normalizedDate = dateHelpers.normalizeDateString(date);
  if (!normalizedDate) {
    debugError('❌ Invalid date provided:', date);
    return res.status(400).json({ error: 'Invalid date format. Date is required.' });
  }

  const fileType = req.body.fileType || (imageUri && imageUri.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
  
  // Check if receipt with this ID already exists
  db.get('SELECT id FROM receipts WHERE id = ?', [receiptId], (checkErr, existingRow) => {
    if (checkErr) {
      debugError('❌ Error checking for existing receipt:', checkErr);
      return res.status(500).json({ error: checkErr.message });
    }

    const isUpdate = !!existingRow;
    const action = isUpdate ? 'updated' : 'created';
  
    db.run(
      'INSERT OR REPLACE INTO receipts (id, employeeId, date, amount, vendor, description, category, imageUri, fileType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM receipts WHERE id = ?), ?), ?)',
      [receiptId, employeeId, normalizedDate, amount, vendor || '', description || '', category || '', imageUri || '', fileType, receiptId, now, now],
      function(err) {
        if (err) {
          debugError('Database error:', err.message);
          res.status(500).json({ error: err.message });
          return;
        }
        debugLog(`✅ Receipt ${action} successfully:`, receiptId);
        
        // Broadcast WebSocket update
        websocketService.broadcastDataChange('receipt', isUpdate ? 'update' : 'create', { id: receiptId, employeeId, date: normalizedDate, amount, category }, employeeId);
        
        res.json({ id: receiptId, message: `Receipt ${action} successfully`, isUpdate });
      }
    );
  });
});

/**
 * Update receipt
 */
router.put('/api/receipts/:id', (req, res) => {
  // Validate that "Other" category receipts have descriptions
  if (req.body.category === 'Other' && (!req.body.description || !req.body.description.trim())) {
    return res.status(400).json({ 
      error: 'Description is required for Other Expenses so Finance knows what the money was spent on' 
    });
  }

  const { id } = req.params;
  const { employeeId, date, amount, vendor, description, category, imageUri, fileType } = req.body;
  const now = new Date().toISOString();
  const db = dbService.getDb();

  // Normalize date to YYYY-MM-DD format to avoid timezone issues with month/year filtering
  const normalizedDate = dateHelpers.normalizeDateString(date);
  if (!normalizedDate) {
    debugError('❌ Invalid date provided:', date);
    return res.status(400).json({ error: 'Invalid date format. Date is required.' });
  }

  // Determine fileType if not provided
  const finalFileType = fileType || (imageUri && imageUri.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');

  db.run(
    'UPDATE receipts SET employeeId = ?, date = ?, amount = ?, vendor = ?, description = ?, category = ?, imageUri = ?, fileType = ?, updatedAt = ? WHERE id = ?',
    [employeeId, normalizedDate, amount, vendor || '', description || '', category || '', imageUri || '', finalFileType, now, id],
    function(err) {
      if (err) {
        debugError('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      // Broadcast WebSocket update
      websocketService.broadcastDataChange('receipt', 'update', { id, employeeId, date: normalizedDate, amount, category }, employeeId);
      
      res.json({ message: 'Receipt updated successfully' });
    }
  );
});

/**
 * Upload receipt image - accepts both multipart/form-data and JSON with base64 (protected with rate limiting)
 */
router.post('/api/receipts/upload-image', uploadLimiter, (req, res, next) => {
  // Set a longer timeout for image uploads (60 seconds)
  req.setTimeout(60000);
  res.setTimeout(60000);
  
  // Check if this is JSON (base64) or multipart
  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
    // Handle base64 image in JSON body
    next();
  } else {
    // Handle multipart/form-data file upload
    upload.single('image')(req, res, (err) => {
      if (err) {
        debugError(`❌ Multer error:`, err);
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      }
      next();
    });
  }
}, (req, res) => {
  // Handle base64 image in JSON body
  if (req.body && (req.body.image || req.body.imageData || req.body.base64)) {
    try {
      debugLog('📸 Processing base64 image upload...');
      const base64Data = req.body.image || req.body.imageData || req.body.base64;
      const receiptId = req.body.receiptId || 'unknown';
      
      if (!base64Data || base64Data.length === 0) {
        debugError('❌ Empty base64 data received');
        return res.status(400).json({ error: 'No image data provided' });
      }
      
      // Remove data URL prefix if present (data:image/jpeg;base64,...)
      const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      
      debugLog(`📸 Decoding base64 image (${base64String.length} chars)...`);
      // Save base64 image to file
      const imageBuffer = Buffer.from(base64String, 'base64');
      debugLog(`📸 Image decoded, size: ${imageBuffer.length} bytes`);
      
      // Determine file extension from content type or request
      let fileExtension = req.body.extension || '.jpg';
      // Check if it's a PDF by looking at the base64 data prefix or content
      if (base64Data.includes('data:application/pdf') || req.body.extension === '.pdf') {
        fileExtension = '.pdf';
      } else if (base64Data.includes('data:image/png')) {
        fileExtension = '.png';
      } else if (base64Data.includes('data:image/jpeg') || base64Data.includes('data:image/jpg')) {
        fileExtension = '.jpg';
      }
      
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
      const imagePath = path.join(uploadsDir, uniqueFilename);
      
      debugLog(`📸 Saving file to: ${imagePath}`);
      fs.writeFileSync(imagePath, imageBuffer);
      debugLog(`✅ File saved successfully: ${uniqueFilename}`);
      
      res.json({ 
        imageUri: uniqueFilename,
        imagePath: uniqueFilename,
        filename: uniqueFilename,
        size: imageBuffer.length,
        message: 'Image uploaded successfully' 
      });
      return;
    } catch (error) {
      debugError('❌ Error saving base64 image:', error);
      res.status(500).json({ error: 'Failed to save image: ' + error.message });
      return;
    }
  }
  
  // Handle multipart file upload
  if (!req.file && !req.files) {
    debugError('❌ No file provided in request');
    debugError(`   Request body:`, req.body);
    res.status(400).json({ error: 'No image file provided. Send either multipart/form-data with "image" field or JSON with "image", "imageData", or "base64" field.' });
    return;
  }

  try {
    // Get the uploaded file info (handle both single and multiple files)
    const uploadedFile = req.file || (req.files && req.files.image) || (req.files && Object.values(req.files)[0]);
    
    if (!uploadedFile) {
      debugError('❌ Could not extract file from request');
      res.status(400).json({ error: 'Could not extract file from request' });
      return;
    }
    
    const originalName = uploadedFile.originalname || uploadedFile.name || 'receipt.jpg';
    let fileExtension = path.extname(originalName) || '.jpg';
    // Ensure PDF extension is preserved
    if (uploadedFile.mimetype === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) {
      fileExtension = '.pdf';
    }
    
    // Create a unique filename if not already set
    const uniqueFilename = uploadedFile.filename || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
    
    // The file is already saved by multer in the uploads/ directory
    const imagePath = uniqueFilename; // Relative path to uploads directory
    
    res.json({ 
      imageUri: imagePath,
      imagePath: imagePath,
      filename: uniqueFilename,
      size: uploadedFile.size,
      message: 'Image uploaded successfully' 
    });
  } catch (error) {
    debugError('❌ Error uploading receipt image:', error);
    res.status(500).json({ error: 'Failed to upload image: ' + error.message });
  }
});

/**
 * OCR endpoint - Extract text from receipt image using Google Cloud Vision
 */
router.post('/api/receipts/ocr', async (req, res) => {
  try {
    // Check if we have an image (base64 or file path)
    if (!req.body.image && !req.body.imagePath) {
      return res.status(400).json({ error: 'No image provided. Send either "image" (base64) or "imagePath" (relative path in uploads/ directory)' });
    }
    
    let imageContent;
    
    // Handle base64 image
    if (req.body.image) {
      const base64Data = req.body.image.includes(',') ? req.body.image.split(',')[1] : req.body.image;
      imageContent = Buffer.from(base64Data, 'base64');
      debugLog('📸 OCR processing base64 image');
    } 
    // Handle file path
    else if (req.body.imagePath) {
      const imagePath = path.join(uploadsDir, req.body.imagePath);
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: 'Image file not found' });
      }
      imageContent = fs.readFileSync(imagePath);
      debugLog('📸 OCR processing file:', req.body.imagePath);
    }
    
    let detections;
    
    // Use API key with REST API if available, otherwise use service account with client library
    if (process.env.GOOGLE_VISION_API_KEY) {
      // Use API key authentication via REST API
      debugLog('📸 OCR: Using API key authentication via REST API');
      const base64Image = imageContent.toString('base64');
      const apiKey = process.env.GOOGLE_VISION_API_KEY;
      
      const requestBody = JSON.stringify({
        requests: [{
          image: {
            content: base64Image
          },
          features: [{
            type: 'TEXT_DETECTION',
            maxResults: 1
          }]
        }]
      });
      
      const options = {
        hostname: 'vision.googleapis.com',
        path: `/v1/images:annotate?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };
      
      // Make REST API call
      const apiResult = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
            }
          });
        });
        req.on('error', reject);
        req.write(requestBody);
        req.end();
      });
      
      if (apiResult.responses && apiResult.responses[0] && apiResult.responses[0].textAnnotations) {
        detections = apiResult.responses[0].textAnnotations;
      } else {
        detections = [];
      }
    } else {
      // Use service account credentials with client library
      debugLog('📸 OCR: Using service account authentication');
      const client = new vision.ImageAnnotatorClient();
      const [result] = await client.textDetection({ image: { content: imageContent } });
      detections = result.textAnnotations;
    }
    
    if (!detections || detections.length === 0) {
      debugLog('⚠️ OCR: No text detected in image');
      return res.json({
        success: false,
        text: '',
        lines: [],
        vendor: '',
        amount: null,
        date: null,
        message: 'No text detected in image'
      });
    }
    
    // Full text is in the first detection
    const fullText = detections[0].description || '';
    
    // Parse individual lines
    const lines = fullText.split('\n').filter(line => line.trim().length > 0);
    
    // Extract vendor - improved detection
    // Skip common header lines and find the actual vendor name
    const skipPatterns = [
      /^(RECEIPT|INVOICE|TAX|SUBTOTAL|TOTAL|BALANCE|THANK|VISIT|STORE|LOCATION|DATE|TIME|PHONE|FAX|WEB|WWW|HTTP)/i,
      /^\d+\/\d+\/\d+/, // Skip dates at start
      /^\d{1,2}:\d{2}/, // Skip times
      /^#\d+$/, // Skip receipt numbers at start
      /^STORE\s*#/i,
      /^TRANS\s*#/i
    ];
    
    let vendor = '';
    // Look for vendor in first few lines, skipping headers
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      const shouldSkip = skipPatterns.some(pattern => pattern.test(line));
      
      if (!shouldSkip && line.length > 2 && line.length < 50) {
        // Check if line looks like a vendor name (not all numbers, not all caps with special chars)
        if (!/^[\d\s\-\.]+$/.test(line) && !/^[A-Z\s\-\.]{20,}$/.test(line)) {
          vendor = line;
          break;
        }
      }
    }
    
    // Fallback to first line if no vendor found
    if (!vendor && lines.length > 0) {
      vendor = lines[0].trim();
    }
    
    // Clean up vendor name (remove extra whitespace, common suffixes)
    vendor = vendor.replace(/\s+/g, ' ').trim();
    vendor = vendor.replace(/\s*(INC|LLC|LTD|CORP|CORPORATION|CO|COMPANY)\s*$/i, '');
    
    // Extract amount - improved patterns and logic
    let amount = null;
    const amountPatterns = [
      // Total patterns (highest priority)
      /\b(?:TOTAL|AMOUNT\s+DUE|BALANCE\s+DUE|AMOUNT|PAY|CHARGE|DUE)[:\s]*\$?\s*(\d{1,3}(?:,\d{3})*\.\d{2})\b/gi,
      /\b(?:TOTAL|AMOUNT\s+DUE|BALANCE\s+DUE|AMOUNT|PAY|CHARGE|DUE)[:\s]*\$?\s*(\d+\.\d{2})\b/gi,
      // Subtotal patterns (lower priority)
      /\b(?:SUBTOTAL|SUB\s+TOTAL)[:\s]*\$?\s*(\d{1,3}(?:,\d{3})*\.\d{2})\b/gi,
      /\b(?:SUBTOTAL|SUB\s+TOTAL)[:\s]*\$?\s*(\d+\.\d{2})\b/gi,
      // Generic dollar amounts (last priority)
      /\$\s*(\d{1,3}(?:,\d{3})*\.\d{2})\b/g,
      /\$\s*(\d+\.\d{2})\b/g,
      // Without dollar sign but with decimal
      /\b(\d{1,3}(?:,\d{3})*\.\d{2})\s*(?:USD|DOLLARS?)?\b/gi
    ];
    
    const amounts = [];
    for (const pattern of amountPatterns) {
      let match;
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      while ((match = pattern.exec(fullText)) !== null) {
        const amountStr = match[1].replace(/,/g, '');
        const parsedAmount = parseFloat(amountStr);
        if (parsedAmount > 0 && parsedAmount < 50000) {
          amounts.push({
            amount: parsedAmount,
            priority: pattern.source.includes('TOTAL') || pattern.source.includes('AMOUNT') || pattern.source.includes('DUE') ? 1 : 
                     pattern.source.includes('SUBTOTAL') ? 2 : 3,
            match: match[0]
          });
        }
      }
    }
    
    // Sort by priority, then by amount (descending), and take the highest priority largest amount
    if (amounts.length > 0) {
      amounts.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.amount - a.amount; // Larger amounts first
      });
      amount = amounts[0].amount;
    }
    
    // Extract date - improved patterns and validation
    let date = null;
    const datePatterns = [
      // Date labels (higher priority)
      /\b(?:DATE|DATED?|TRANS\s*DATE|PURCHASE\s*DATE)[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/gi,
      /\b(?:DATE|DATED?|TRANS\s*DATE|PURCHASE\s*DATE)[:\s]+(\d{1,2})-(\d{1,2})-(\d{2,4})\b/gi,
      // Standard formats
      /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g,
      /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/g,
      // Month name formats
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})[,\s]+(\d{4})\b/gi,
      /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/gi
    ];
    
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    for (const pattern of datePatterns) {
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(fullText);
      if (match) {
        try {
          let month, day, year;
          
          if (match[0].includes('/') || match[0].includes('-')) {
            // Numeric format: MM/DD/YYYY or MM-DD-YYYY
            month = parseInt(match[1]);
            day = parseInt(match[2]);
            year = parseInt(match[3]);
            
            // Handle 2-digit years
            if (year < 100) {
              year += year < 50 ? 2000 : 1900;
            }
            
            // Validate month (1-12) and day (1-31)
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
              date = new Date(year, month - 1, day);
              // Validate date is valid (catches invalid dates like Feb 30)
              if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
                date = date.toISOString();
                break;
              }
            }
          } else {
            // Month name format
            let monthIndex = -1;
            
            if (match[1] && monthNames.some(m => match[1].toLowerCase().startsWith(m))) {
              // Format: "Jan 15, 2024"
              monthIndex = monthNames.findIndex(m => match[1].toLowerCase().startsWith(m));
              day = parseInt(match[2]);
              year = parseInt(match[3]);
            } else if (match[2] && monthNames.some(m => match[2].toLowerCase().startsWith(m))) {
              // Format: "15 Jan 2024"
              day = parseInt(match[1]);
              monthIndex = monthNames.findIndex(m => match[2].toLowerCase().startsWith(m));
              year = parseInt(match[3]);
            }
            
            if (monthIndex >= 0 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
              date = new Date(year, monthIndex, day);
              if (date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day) {
                date = date.toISOString();
                break;
              }
            }
          }
        } catch (error) {
          // Continue to next pattern
        }
      }
    }
    
    // If no date found, try to extract from common receipt positions (near top)
    if (!date && lines.length > 0) {
      const topLines = lines.slice(0, 5).join(' ');
      for (const pattern of [
        /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/,
        /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/
      ]) {
        const match = pattern.exec(topLines);
        if (match) {
          try {
            const month = parseInt(match[1]);
            const day = parseInt(match[2]);
            let year = parseInt(match[3]);
            if (year < 100) year += year < 50 ? 2000 : 1900;
            
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
              const testDate = new Date(year, month - 1, day);
              if (testDate.getFullYear() === year && testDate.getMonth() === month - 1 && testDate.getDate() === day) {
                date = testDate.toISOString();
                break;
              }
            }
          } catch (error) {
            // Continue
          }
        }
      }
    }
    
    // Suggest category based on vendor name
    const suggestCategory = (vendorName) => {
      if (!vendorName) return '';
      
      const vendorLower = vendorName.toLowerCase();
      
      // Gas/Transportation
      if (vendorLower.match(/\b(gas|fuel|exxon|shell|bp|chevron|mobil|texaco|citgo|speedway|wawa|7-11|711|quiktrip|qt|kum\s*&?\s*go)\b/)) {
        return 'Gas';
      }
      
      // Meals/Food
      if (vendorLower.match(/\b(restaurant|cafe|diner|mcdonald|burger|wendy|taco|pizza|subway|kfc|chick-fil-a|chickfila|starbucks|dunkin|papa|domino|pizza\s*hut)\b/)) {
        return 'Meals';
      }
      
      // Office Supplies
      if (vendorLower.match(/\b(office\s*max|officemax|office\s*depot|officedepot|staples|walmart|target|walgreens|cvs|dollar\s*general|family\s*dollar)\b/)) {
        return 'Office Supplies';
      }
      
      // Hotels
      if (vendorLower.match(/\b(hotel|motel|hilton|marriott|hyatt|holiday\s*inn|best\s*western|ramada|days\s*inn|super\s*8|motel\s*6)\b/)) {
        return 'Lodging';
      }
      
      // Grocery
      if (vendorLower.match(/\b(kroger|publix|safeway|whole\s*foods|trader\s*joes|aldi|food\s*lion|giant|wegmans|shoprite)\b/)) {
        return 'Meals';
      }
      
      // Transportation/Travel
      if (vendorLower.match(/\b(airline|airport|delta|united|american|southwest|uber|lyft|taxi|cab|rental|hertz|enterprise|avis|budget)\b/)) {
        return 'Transportation';
      }
      
      return '';
    };
    
    const suggestedCategory = suggestCategory(vendor);
    
    res.json({
      success: true,
      text: fullText,
      lines,
      vendor,
      amount,
      date,
      suggestedCategory,
      message: 'Text extracted successfully'
    });
    
  } catch (error) {
    debugError('❌ OCR error:', error);
    res.status(500).json({ 
      error: 'OCR processing failed: ' + error.message,
      message: 'Make sure Google Cloud Vision API is properly configured with API key'
    });
  }
});

/**
 * Delete receipt
 */
router.delete('/api/receipts/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  
  // Get receipt info before deleting for WebSocket broadcast
  db.get('SELECT employeeId FROM receipts WHERE id = ?', [id], (getErr, receipt) => {
    if (getErr) {
      res.status(500).json({ error: getErr.message });
      return;
    }
    
    db.run('DELETE FROM receipts WHERE id = ?', [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Broadcast WebSocket update
      if (receipt && receipt.employeeId) {
        websocketService.broadcastDataChange('receipt', 'delete', { id }, receipt.employeeId);
      }
      
      res.json({ message: 'Receipt deleted successfully' });
    });
  });
});

// ===== TIME TRACKING ROUTES =====

/**
 * Get all time tracking entries
 */
router.get('/api/time-tracking', (req, res) => {
  const { employeeId, month, year } = req.query;
  const db = dbService.getDb();
  let query = `
    SELECT tt.*, e.name as employeeName, e.costCenters 
    FROM time_tracking tt 
    LEFT JOIN employees e ON tt.employeeId = e.id 
  `;
  const params = [];
  const conditions = [];

  if (employeeId) {
    conditions.push('tt.employeeId = ?');
    params.push(employeeId);
  }

  if (month && year) {
    conditions.push('strftime("%m", tt.date) = ? AND strftime("%Y", tt.date) = ?');
    params.push(month.toString().padStart(2, '0'), year.toString());
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY tt.date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

/**
 * Create new time tracking entry
 */
router.post('/api/time-tracking', async (req, res) => {
  debugLog('📥 POST /api/time-tracking - Request body:', req.body);
  const db = dbService.getDb();
  
  const { id, employeeId, date, category, hours, description, costCenter } = req.body;
  const normalizedDate = dateHelpers.normalizeDateString(date);
  if (!normalizedDate) {
    debugError('❌ Invalid date provided:', date);
    return res.status(400).json({ error: 'Invalid date format. Date is required.' });
  }
  
  // Use provided ID or generate a new one
  // IMPORTANT: Always use the provided ID if available to prevent duplicates
  const trackingId = id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
  const now = new Date().toISOString();
  
  // Check if entry with this ID already exists
  db.get('SELECT id FROM time_tracking WHERE id = ?', [trackingId], (checkErr, existingRow) => {
    if (checkErr) {
      debugError('❌ Error checking for existing time tracking entry:', checkErr);
      return res.status(500).json({ error: checkErr.message });
    }

    const isUpdate = !!existingRow;
    const action = isUpdate ? 'updated' : 'created';
  
    db.run(
      'INSERT OR REPLACE INTO time_tracking (id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM time_tracking WHERE id = ?), ?), ?)',
      [trackingId, employeeId, normalizedDate, category || '', hours, description || '', costCenter || '', trackingId, now, now],
    async function(err) {
      if (err) {
        debugError('❌ Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Check for 50+ hours alert after saving
      try {
        await checkAndNotify50PlusHours(employeeId, normalizedDate);
      } catch (alertError) {
        debugError('❌ Error checking 50+ hours alert:', alertError);
        // Don't fail the request if alert check fails
      }
      
      debugLog(`✅ Time tracking entry ${action} successfully:`, trackingId);
      res.json({ id: trackingId, message: `Time tracking entry ${action} successfully`, isUpdate });
    }
    );
  });
});

/**
 * Update time tracking entry
 */
router.put('/api/time-tracking/:id', async (req, res) => {
  const { id } = req.params;
  const { employeeId, date, category, hours, description, costCenter } = req.body;
  const now = new Date().toISOString();
  const db = dbService.getDb();
  const normalizedDate = dateHelpers.normalizeDateString(date);
  if (!normalizedDate) {
    debugError('❌ Invalid date provided:', date);
    return res.status(400).json({ error: 'Invalid date format. Date is required.' });
  }

  db.run(
    'UPDATE time_tracking SET employeeId = ?, date = ?, category = ?, hours = ?, description = ?, costCenter = ?, updatedAt = ? WHERE id = ?',
    [employeeId, normalizedDate, category || '', hours, description || '', costCenter || '', now, id],
    async function(err) {
      if (err) {
        debugError('Database error:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Check for 50+ hours alert after updating
      try {
        await checkAndNotify50PlusHours(employeeId, normalizedDate);
      } catch (alertError) {
        debugError('❌ Error checking 50+ hours alert:', alertError);
        // Don't fail the request if alert check fails
      }
      
      res.json({ message: 'Time tracking entry updated successfully' });
    }
  );
});

/**
 * Delete all time tracking entries (admin/maintenance endpoint)
 * Optional query params: employeeId, month, year
 * NOTE: This must come BEFORE the /:id route to avoid route conflicts
 */
router.delete('/api/time-tracking', (req, res) => {
  const { employeeId, month, year } = req.query;
  const db = dbService.getDb();
  
  // If no query params, require confirmation or specific params to prevent accidental deletion
  if (!employeeId && !month && !year) {
    return res.status(400).json({ 
      error: 'Missing required parameters. Provide employeeId, or month+year, or all three to delete specific entries.' 
    });
  }
  
  let query = 'DELETE FROM time_tracking';
  const params = [];
  const conditions = [];
  
  if (employeeId) {
    conditions.push('employeeId = ?');
    params.push(employeeId);
  }
  
  if (month && year) {
    conditions.push('strftime("%m", date) = ? AND strftime("%Y", date) = ?');
    params.push(month.toString().padStart(2, '0'), year.toString());
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  debugLog(`🗑️ Deleting time tracking entries with query: ${query}, params:`, params);
  
  db.run(query, params, function(err) {
    if (err) {
      debugError('❌ Error deleting time tracking entries:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    debugLog(`✅ Deleted ${this.changes} time tracking entries`);
    res.json({ 
      message: `Successfully deleted ${this.changes} time tracking entries`,
      deletedCount: this.changes
    });
  });
});

/**
 * Delete time tracking entry by ID
 */
router.delete('/api/time-tracking/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  db.run('DELETE FROM time_tracking WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Time tracking entry deleted successfully' });
  });
});

// ===== DAILY DESCRIPTIONS ROUTES =====

/**
 * Get daily descriptions
 */
router.get('/api/daily-descriptions', (req, res) => {
  const { employeeId, month, year } = req.query;
  const db = dbService.getDb();
  let query = `
    SELECT dd.*, e.name as employeeName
    FROM daily_descriptions dd
    LEFT JOIN employees e ON dd.employeeId = e.id
  `;
  const params = [];
  const conditions = [];

  if (employeeId) {
    conditions.push('dd.employeeId = ?');
    params.push(employeeId);
  }

  if (month && year) {
    conditions.push('strftime("%m", dd.date) = ? AND strftime("%Y", dd.date) = ?');
    params.push(month.toString().padStart(2, '0'), year.toString());
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY dd.date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

/**
 * Create or update daily description
 */
router.post('/api/daily-descriptions', (req, res) => {
  const { id, employeeId, date, description, costCenter, stayedOvernight, dayOff, dayOffType } = req.body;
  const db = dbService.getDb();
  
  // Normalize date to YYYY-MM-DD format
  const normalizedDate = dateHelpers.normalizeDateString(date);
  if (!normalizedDate) {
    return res.status(400).json({ error: `Invalid date format: ${date}` });
  }
  
  // Use provided ID or generate one based on normalized date
  // IMPORTANT: Always use the provided ID if available to prevent duplicates
  const descriptionId = id || `desc-${employeeId}-${normalizedDate}`;
  const now = new Date().toISOString();
  const stayedOvernightValue = stayedOvernight ? 1 : 0;
  const dayOffValue = dayOff ? 1 : 0;

  // Check if description with this ID already exists
  db.get('SELECT id FROM daily_descriptions WHERE id = ?', [descriptionId], (checkErr, existingRow) => {
    if (checkErr) {
      debugError('❌ Error checking for existing daily description:', checkErr);
      return res.status(500).json({ error: checkErr.message });
    }

    const isUpdate = !!existingRow;
    const action = isUpdate ? 'updated' : 'created';
  
    // Use INSERT OR REPLACE to handle both create and update cases
    db.run(
      'INSERT OR REPLACE INTO daily_descriptions (id, employeeId, date, description, costCenter, stayedOvernight, dayOff, dayOffType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM daily_descriptions WHERE id = ?), ?), ?)',
      [descriptionId, employeeId, normalizedDate, description, costCenter || '', stayedOvernightValue, dayOffValue, dayOffType || null, descriptionId, now, now],
      function(err) {
        if (err) {
          debugError('❌ Database error:', err.message);
          res.status(500).json({ error: err.message });
          return;
        }
        debugLog(`✅ Daily description ${action} successfully:`, descriptionId);
        res.json({ id: descriptionId, message: `Daily description ${action} successfully`, isUpdate });
      }
    );
  });
});

/**
 * Delete daily description
 */
router.delete('/api/daily-descriptions/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  db.run('DELETE FROM daily_descriptions WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Daily description deleted successfully' });
  });
});

module.exports = router;


/**
 * Utility Routes
 * Extracted from server.js for better organization
 * Includes: Saved addresses, Oxford Houses, stats, health checks
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { debugLog, debugWarn, debugError } = require('../debug');

// ===== SAVED ADDRESSES =====

router.get('/api/saved-addresses', (req, res) => {
  const { employeeId } = req.query;
  
  if (!employeeId) {
    res.status(400).json({ error: 'employeeId is required' });
    return;
  }

  // For now, return empty array since we don't have a saved_addresses table yet
  // This can be implemented later when the table is created
  res.json([]);
});

// ===== OXFORD HOUSES =====

// Cache for Oxford Houses data
let oxfordHousesCache = null;
let oxfordHousesCacheTime = null;
const OXFORD_HOUSES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Fetch Oxford Houses from live website
async function fetchOxfordHouses() {
  try {
    debugLog('🏠 Fetching Oxford Houses from oxfordvacancies.com...');
    
    const response = await fetch('https://oxfordvacancies.com/oxfordReport.aspx?report=house-name-address-all-houses');
    const html = await response.text();
    
    // Parse the HTML table
    const houses = [];
    const tableRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    
    let match;
    let isFirstRow = true;
    
    while ((match = tableRegex.exec(html)) !== null) {
      if (isFirstRow) {
        isFirstRow = false;
        continue; // Skip header row
      }
      
      const cells = [];
      const rowHtml = match[1];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        // Remove HTML tags and decode entities
        const cellText = cellMatch[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();
        cells.push(cellText);
      }
      
      if (cells.length >= 5) {
        houses.push({
          name: `OH ${cells[0]}`, // Add "OH" prefix
          address: cells[1],
          city: cells[2],
          state: cells[3],
          zip: cells[4],
          fullAddress: `${cells[1]}, ${cells[2]}, ${cells[3]} ${cells[4]}`
        });
      }
    }
    
    debugLog(`✅ Fetched ${houses.length} Oxford Houses`);
    return houses;
  } catch (error) {
    debugError('❌ Error fetching Oxford Houses:', error);
    return [];
  }
}

// Get all Oxford Houses (with caching)
router.get('/api/oxford-houses', async (req, res) => {
  try {
    // Check if cache is valid
    if (oxfordHousesCache && oxfordHousesCacheTime && (Date.now() - oxfordHousesCacheTime < OXFORD_HOUSES_CACHE_TTL)) {
      debugLog('📦 Serving Oxford Houses from cache');
      res.json(oxfordHousesCache);
      return;
    }
    
    // Fetch fresh data
    const houses = await fetchOxfordHouses();
    
    // Update cache
    oxfordHousesCache = houses;
    oxfordHousesCacheTime = Date.now();
    
    res.json(houses);
  } catch (error) {
    debugError('❌ Error in oxford-houses endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch Oxford Houses' });
  }
});

// Force refresh Oxford Houses cache
router.post('/api/oxford-houses/refresh', async (req, res) => {
  try {
    debugLog('🔄 Force refreshing Oxford Houses data...');
    const houses = await fetchOxfordHouses();
    
    // Update cache
    oxfordHousesCache = houses;
    oxfordHousesCacheTime = Date.now();
    
    res.json({ message: 'Oxford Houses refreshed successfully', count: houses.length });
  } catch (error) {
    debugError('❌ Error refreshing Oxford Houses:', error);
    res.status(500).json({ error: 'Failed to refresh Oxford Houses' });
  }
});

// ===== STATISTICS =====

// Get database statistics
router.get('/api/stats', (req, res) => {
  const db = dbService.getDb();
  const queries = {
    totalEmployees: 'SELECT COUNT(*) as count FROM employees',
    totalMileageEntries: 'SELECT COUNT(*) as count FROM mileage_entries',
    totalReceipts: 'SELECT COUNT(*) as count FROM receipts',
    totalMiles: 'SELECT SUM(miles) as total FROM mileage_entries',
    totalReceiptAmount: 'SELECT SUM(amount) as total FROM receipts',
    totalExpenseReports: 'SELECT COUNT(*) as count FROM expense_reports',
    draftReports: 'SELECT COUNT(*) as count FROM expense_reports WHERE status = "draft"',
    submittedReports: 'SELECT COUNT(*) as count FROM expense_reports WHERE status = "submitted"',
    approvedReports: 'SELECT COUNT(*) as count FROM expense_reports WHERE status = "approved"'
  };

  const stats = {};
  let completed = 0;

  Object.keys(queries).forEach(key => {
    db.get(queries[key], (err, row) => {
      if (!err && row) {
        stats[key] = row.count !== undefined ? row.count : row.total || 0;
      } else {
        stats[key] = 0;
      }
      
      completed++;
      if (completed === Object.keys(queries).length) {
        res.json(stats);
      }
    });
  });
});

// ===== HEALTH CHECK =====

router.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Oxford House Mileage Tracker Backend API', 
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;


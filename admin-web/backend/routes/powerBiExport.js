/**
 * Power BI Export Routes
 * Provides optimized endpoints for Power BI data connections
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { debugLog, debugError } = require('../debug');

/**
 * Get all data for Power BI in a single request
 * Returns all tables with relationships pre-joined
 */
router.get('/api/power-bi/export', async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const db = dbService.getDb();
    
    debugLog('📊 Power BI Export: Starting data export...');
    
    // Build date filter if provided
    let dateFilter = '';
    const params = [];
    if (startDate && endDate) {
      dateFilter = 'WHERE date >= ? AND date <= ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      dateFilter = 'WHERE date >= ?';
      params.push(startDate);
    } else if (endDate) {
      dateFilter = 'WHERE date <= ?';
      params.push(endDate);
    }
    
    // Build employee filter
    let employeeFilter = '';
    if (employeeId) {
      employeeFilter = dateFilter ? ' AND employeeId = ?' : ' WHERE employeeId = ?';
      params.push(employeeId);
    }
    
    const combinedFilter = dateFilter + employeeFilter;
    
    // Fetch all data in parallel
    const [
      employees,
      mileageEntries,
      receipts,
      timeTracking,
      dailyDescriptions
    ] = await Promise.all([
      // Employees
      new Promise((resolve, reject) => {
        db.all('SELECT * FROM employees ORDER BY name', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      
      // Mileage Entries
      new Promise((resolve, reject) => {
        const query = `
          SELECT me.*, 
                 COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName,
                 e.costCenters
          FROM mileage_entries me
          LEFT JOIN employees e ON me.employeeId = e.id
          ${combinedFilter ? combinedFilter.replace('date', 'me.date') : ''}
          ORDER BY me.date DESC
        `;
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      
      // Receipts
      new Promise((resolve, reject) => {
        const query = `
          SELECT r.*,
                 COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName
          FROM receipts r
          LEFT JOIN employees e ON r.employeeId = e.id
          ${combinedFilter ? combinedFilter.replace('date', 'r.date') : ''}
          ORDER BY r.date DESC
        `;
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      
      // Time Tracking
      new Promise((resolve, reject) => {
        const query = `
          SELECT tt.*,
                 COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName
          FROM time_tracking tt
          LEFT JOIN employees e ON tt.employeeId = e.id
          ${combinedFilter ? combinedFilter.replace('date', 'tt.date') : ''}
          ORDER BY tt.date DESC
        `;
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      
      // Daily Descriptions
      new Promise((resolve, reject) => {
        const query = `
          SELECT dd.*,
                 COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName
          FROM daily_descriptions dd
          LEFT JOIN employees e ON dd.employeeId = e.id
          ${combinedFilter ? combinedFilter.replace('date', 'dd.date') : ''}
          ORDER BY dd.date DESC
        `;
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      })
    ]);
    
    debugLog(`📊 Power BI Export: Exported ${employees.length} employees, ${mileageEntries.length} mileage entries, ${receipts.length} receipts, ${timeTracking.length} time entries, ${dailyDescriptions.length} descriptions`);
    
    res.json({
      employees,
      mileageEntries,
      receipts,
      timeTracking,
      dailyDescriptions,
      exportDate: new Date().toISOString(),
      recordCounts: {
        employees: employees.length,
        mileageEntries: mileageEntries.length,
        receipts: receipts.length,
        timeTracking: timeTracking.length,
        dailyDescriptions: dailyDescriptions.length
      }
    });
    
  } catch (error) {
    debugError('❌ Power BI Export Error:', error);
    res.status(500).json({ 
      error: 'Failed to export data',
      message: error.message 
    });
  }
});

/**
 * Get summary statistics for Power BI dashboards
 */
router.get('/api/power-bi/summary', async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const db = dbService.getDb();
    
    // Build filters
    let whereClause = '';
    const params = [];
    
    if (employeeId) {
      whereClause = 'WHERE employeeId = ?';
      params.push(employeeId);
    }
    
    if (startDate) {
      whereClause += whereClause ? ' AND date >= ?' : 'WHERE date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += whereClause ? ' AND date <= ?' : 'WHERE date <= ?';
      params.push(endDate);
    }
    
    // Get summary statistics
    const [
      totalMiles,
      totalReceipts,
      totalHours,
      employeeStats
    ] = await Promise.all([
      // Total miles
      new Promise((resolve, reject) => {
        const query = `SELECT SUM(miles) as total FROM mileage_entries ${whereClause.replace('employeeId', 'employeeId').replace('date', 'date')}`;
        db.get(query, params, (err, row) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        });
      }),
      
      // Total receipts
      new Promise((resolve, reject) => {
        const query = `SELECT SUM(amount) as total FROM receipts ${whereClause.replace('employeeId', 'employeeId').replace('date', 'date')}`;
        db.get(query, params, (err, row) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        });
      }),
      
      // Total hours
      new Promise((resolve, reject) => {
        const query = `SELECT SUM(hours) as total FROM time_tracking ${whereClause.replace('employeeId', 'employeeId').replace('date', 'date')}`;
        db.get(query, params, (err, row) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        });
      }),
      
      // Employee statistics
      new Promise((resolve, reject) => {
        const query = `
          SELECT 
            e.id,
            COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName,
            COUNT(DISTINCT me.id) as mileageEntryCount,
            COALESCE(SUM(me.miles), 0) as totalMiles,
            COUNT(DISTINCT r.id) as receiptCount,
            COALESCE(SUM(r.amount), 0) as totalReceipts,
            COUNT(DISTINCT tt.id) as timeEntryCount,
            COALESCE(SUM(tt.hours), 0) as totalHours
          FROM employees e
          LEFT JOIN mileage_entries me ON e.id = me.employeeId ${whereClause.includes('date') ? `AND me.date >= ? AND me.date <= ?` : ''}
          LEFT JOIN receipts r ON e.id = r.employeeId ${whereClause.includes('date') ? `AND r.date >= ? AND r.date <= ?` : ''}
          LEFT JOIN time_tracking tt ON e.id = tt.employeeId ${whereClause.includes('date') ? `AND tt.date >= ? AND tt.date <= ?` : ''}
          ${whereClause.includes('employeeId') ? 'WHERE e.id = ?' : ''}
          GROUP BY e.id, e.name, e.preferredName
          ORDER BY e.name
        `;
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      })
    ]);
    
    res.json({
      summary: {
        totalMiles: totalMiles || 0,
        totalReceipts: totalReceipts || 0,
        totalHours: totalHours || 0
      },
      employeeStats,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    debugError('❌ Power BI Summary Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate summary',
      message: error.message 
    });
  }
});

module.exports = router;

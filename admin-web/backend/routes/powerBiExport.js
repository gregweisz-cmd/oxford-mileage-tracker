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
    
    // Build filters for each table (they have different column names)
    const buildFilter = (dateColumn = 'date') => {
      const conditions = [];
      const filterParams = [];
      
      if (employeeId) {
        conditions.push('employeeId = ?');
        filterParams.push(employeeId);
      }
      
      if (startDate) {
        conditions.push(`${dateColumn} >= ?`);
        filterParams.push(startDate);
      }
      
      if (endDate) {
        conditions.push(`${dateColumn} <= ?`);
        filterParams.push(endDate);
      }
      
      return {
        whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
        params: filterParams
      };
    };
    
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
        const filter = buildFilter('me.date');
        const query = `
          SELECT me.*, 
                 COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName,
                 e.costCenters
          FROM mileage_entries me
          LEFT JOIN employees e ON me.employeeId = e.id
          ${filter.whereClause}
          ORDER BY me.date DESC
        `;
        db.all(query, filter.params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      
      // Receipts
      new Promise((resolve, reject) => {
        const filter = buildFilter('r.date');
        const query = `
          SELECT r.*,
                 COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName
          FROM receipts r
          LEFT JOIN employees e ON r.employeeId = e.id
          ${filter.whereClause}
          ORDER BY r.date DESC
        `;
        db.all(query, filter.params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      
      // Time Tracking
      new Promise((resolve, reject) => {
        const filter = buildFilter('tt.date');
        const query = `
          SELECT tt.*,
                 COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName
          FROM time_tracking tt
          LEFT JOIN employees e ON tt.employeeId = e.id
          ${filter.whereClause}
          ORDER BY tt.date DESC
        `;
        db.all(query, filter.params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      
      // Daily Descriptions
      new Promise((resolve, reject) => {
        const filter = buildFilter('dd.date');
        const query = `
          SELECT dd.*,
                 COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName
          FROM daily_descriptions dd
          LEFT JOIN employees e ON dd.employeeId = e.id
          ${filter.whereClause}
          ORDER BY dd.date DESC
        `;
        db.all(query, filter.params, (err, rows) => {
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
    
    // Build date filters for summary queries
    const buildDateFilter = (dateColumn) => {
      const conditions = [];
      const filterParams = [];
      
      if (employeeId) {
        conditions.push('employeeId = ?');
        filterParams.push(employeeId);
      }
      
      if (startDate) {
        conditions.push(`${dateColumn} >= ?`);
        filterParams.push(startDate);
      }
      
      if (endDate) {
        conditions.push(`${dateColumn} <= ?`);
        filterParams.push(endDate);
      }
      
      return {
        whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
        params: filterParams
      };
    };
    
    // Get summary statistics
    const [
      totalMiles,
      totalReceipts,
      totalHours,
      employeeStats
    ] = await Promise.all([
      // Total miles
      new Promise((resolve, reject) => {
        const filter = buildDateFilter('date');
        const query = `SELECT SUM(miles) as total FROM mileage_entries ${filter.whereClause}`;
        db.get(query, filter.params, (err, row) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        });
      }),
      
      // Total receipts
      new Promise((resolve, reject) => {
        const filter = buildDateFilter('date');
        const query = `SELECT SUM(amount) as total FROM receipts ${filter.whereClause}`;
        db.get(query, filter.params, (err, row) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        });
      }),
      
      // Total hours
      new Promise((resolve, reject) => {
        const filter = buildDateFilter('date');
        const query = `SELECT SUM(hours) as total FROM time_tracking ${filter.whereClause}`;
        db.get(query, filter.params, (err, row) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        });
      }),
      
      // Employee statistics
      new Promise((resolve, reject) => {
        const meFilter = buildDateFilter('me.date');
        const rFilter = buildDateFilter('r.date');
        const ttFilter = buildDateFilter('tt.date');
        
        // Build employee filter
        let employeeWhere = '';
        const employeeParams = [];
        if (employeeId) {
          employeeWhere = 'WHERE e.id = ?';
          employeeParams.push(employeeId);
        }
        
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
          LEFT JOIN mileage_entries me ON e.id = me.employeeId ${meFilter.whereClause.replace('WHERE', 'AND').replace('employeeId', 'me.employeeId')}
          LEFT JOIN receipts r ON e.id = r.employeeId ${rFilter.whereClause.replace('WHERE', 'AND').replace('employeeId', 'r.employeeId')}
          LEFT JOIN time_tracking tt ON e.id = tt.employeeId ${ttFilter.whereClause.replace('WHERE', 'AND').replace('employeeId', 'tt.employeeId')}
          ${employeeWhere}
          GROUP BY e.id, e.name, e.preferredName
          ORDER BY e.name
        `;
        
        // Combine params (remove employeeId duplicates)
        const allParams = [...employeeParams];
        if (meFilter.params.length > 0) allParams.push(...meFilter.params.filter(p => p !== employeeId));
        if (rFilter.params.length > 0) allParams.push(...rFilter.params.filter(p => p !== employeeId));
        if (ttFilter.params.length > 0) allParams.push(...ttFilter.params.filter(p => p !== employeeId));
        
        db.all(query, allParams, (err, rows) => {
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

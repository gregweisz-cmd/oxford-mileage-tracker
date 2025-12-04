/**
 * Employee Routes
 * Extracted from server.js for better organization
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const helpers = require('../utils/helpers');
const { debugLog, debugWarn, debugError } = require('../debug');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { validateRequired, validateEmail } = require('../middleware/validation');
const { passwordResetLimiter } = require('../middleware/rateLimiter');

/**
 * Get all employees with optional filters
 * GET /api/employees
 * 
 * @query {string} supervisorId - Filter by supervisor ID (or 'null'/'unassigned' for no supervisor)
 * @query {string} position - Filter by position (partial match, case-insensitive)
 * @query {boolean} includeArchived - Include archived employees (default: false)
 * @query {string} archived - Legacy parameter for archived (use includeArchived instead)
 * @query {string} search - Search in name, preferredName, or email (case-insensitive)
 * 
 * @returns {Array} Array of employee objects
 * 
 * @example
 * GET /api/employees?supervisorId=supervisor-123&includeArchived=false
 * GET /api/employees?search=john&position=manager
 */
router.get('/api/employees', (req, res) => {
  const { supervisorId, position, includeArchived, search, archived } = req.query;
  const db = dbService.getDb();
  
  // Handle legacy 'archived' query param (for backward compatibility)
  const shouldIncludeArchived = includeArchived === 'true' || archived === 'true';
  
  let query = `SELECT * FROM employees`;
  const conditions = [];
  const params = [];

  if (supervisorId) {
    if (supervisorId === 'null' || supervisorId === 'unassigned') {
      conditions.push('(supervisorId IS NULL OR supervisorId = "")');
    } else {
      conditions.push('supervisorId = ?');
      params.push(supervisorId);
    }
  }

  if (position) {
    conditions.push('LOWER(position) LIKE ?');
    params.push(`%${position.toString().toLowerCase()}%`);
  }

  if (!shouldIncludeArchived) {
    conditions.push('(archived IS NULL OR archived = 0)');
  }

  if (search) {
    const searchTerm = `%${search.toString().toLowerCase()}%`;
    conditions.push('(LOWER(name) LIKE ? OR LOWER(preferredName) LIKE ? OR LOWER(email) LIKE ?)');
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY name';

  db.all(query, params, (err, rows) => {
    if (err) {
      debugError('❌ Error fetching employees:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse JSON fields for each employee
    const parsedRows = rows.map(row => {
      try {
        // Handle corrupted "[object Object]" entries
        let costCenters = [];
        let selectedCostCenters = [];
        
        if (row.costCenters) {
          if (row.costCenters === '[object Object]' || row.costCenters === '[object Object]') {
            debugLog('🔧 Fixing corrupted costCenters for employee:', row.id);
            costCenters = ['Program Services']; // Default fallback
          } else {
            try {
              costCenters = JSON.parse(row.costCenters);
            } catch (parseErr) {
              debugLog('⚠️ Failed to parse costCenters for', row.id, ':', row.costCenters);
              costCenters = ['Program Services']; // Default fallback
            }
          }
        }
        
        if (row.selectedCostCenters) {
          if (row.selectedCostCenters === '[object Object]' || row.selectedCostCenters === '[object Object]') {
            debugLog('🔧 Fixing corrupted selectedCostCenters for employee:', row.id);
            selectedCostCenters = ['Program Services']; // Default fallback
          } else {
            try {
              selectedCostCenters = JSON.parse(row.selectedCostCenters);
            } catch (parseErr) {
              debugLog('⚠️ Failed to parse selectedCostCenters for', row.id, ':', row.selectedCostCenters);
              selectedCostCenters = ['Program Services']; // Default fallback
            }
          }
        }
        
        return {
          ...row,
          costCenters,
          selectedCostCenters
        };
      } catch (parseErr) {
        debugError('❌ Error parsing employee data for', row.id, ':', parseErr);
        return {
          ...row,
          costCenters: ['Program Services'],
          selectedCostCenters: ['Program Services']
        };
      }
    });
    
    res.json(parsedRows);
  });
});

/**
 * Get archived employees
 */
router.get('/api/employees/archived', (req, res) => {
  const db = dbService.getDb();
  db.all('SELECT * FROM employees WHERE archived = 1 ORDER BY name', (err, rows) => {
    if (err) {
      debugError('❌ Error fetching archived employees:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse JSON fields for each employee
    const parsedRows = rows.map(row => {
      try {
        let costCenters = [];
        let selectedCostCenters = [];
        
        if (row.costCenters) {
          if (row.costCenters === '[object Object]') {
            costCenters = ['Program Services'];
          } else {
            try {
              costCenters = JSON.parse(row.costCenters);
            } catch (parseErr) {
              costCenters = ['Program Services'];
            }
          }
        }
        
        if (row.selectedCostCenters) {
          if (row.selectedCostCenters === '[object Object]') {
            selectedCostCenters = ['Program Services'];
          } else {
            try {
              selectedCostCenters = JSON.parse(row.selectedCostCenters);
            } catch (parseErr) {
              selectedCostCenters = ['Program Services'];
            }
          }
        }
        
        return {
          ...row,
          costCenters,
          selectedCostCenters
        };
      } catch (parseErr) {
        return {
          ...row,
          costCenters: ['Program Services'],
          selectedCostCenters: ['Program Services']
        };
      }
    });
    
    res.json(parsedRows);
  });
});

/**
 * Get employee by ID
 */
router.get('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  db.get('SELECT * FROM employees WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    
    // Fix corrupted costCenters data
    if (row.costCenters === '[object Object]') {
      debugLog('🔧 Fixing corrupted costCenters for employee:', id);
      row.costCenters = '["AL-SOR", "G&A", "Fundraising"]';
      
      // Update the database with the correct value
      db.run('UPDATE employees SET costCenters = ? WHERE id = ?', [row.costCenters, id], (updateErr) => {
        if (updateErr) {
          debugError('Failed to update costCenters:', updateErr);
        } else {
          debugLog('✅ Fixed costCenters in database for employee:', id);
        }
      });
    }
    
    res.json(row);
  });
});

/**
 * Bulk update employees
 */
router.put('/api/employees/bulk-update', (req, res) => {
  const { employeeIds, updates } = req.body;
  const db = dbService.getDb();
  
  if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
    return res.status(400).json({ error: 'Employee IDs array is required' });
  }
  
  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Updates object is required' });
  }
  
  // Build dynamic update query
  const updateFields = [];
  const values = [];
  
  Object.keys(updates).forEach(key => {
    // Include both defined values and null (null is valid for clearing fields)
    if (updates[key] !== undefined) {
      updateFields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  });
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  
  values.push(new Date().toISOString()); // updatedAt
  values.push(...employeeIds); // for the IN clause
  
  const placeholders = employeeIds.map(() => '?').join(',');
  const query = `UPDATE employees SET ${updateFields.join(', ')}, updatedAt = ? WHERE id IN (${placeholders})`;
  
  db.run(query, values, function(err) {
    if (err) {
      debugError('Error bulk updating employees:', err);
      res.status(500).json({ error: 'Failed to update employees' });
    } else {
      res.json({ 
        success: true, 
        updatedCount: this.changes,
        message: `Successfully updated ${this.changes} employees`
      });
    }
  });
});

/**
 * Bulk delete employees
 */
router.delete('/api/employees/bulk-delete', (req, res) => {
  const { employeeIds } = req.body;
  const db = dbService.getDb();
  
  if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
    return res.status(400).json({ error: 'Employee IDs array is required' });
  }
  
  const placeholders = employeeIds.map(() => '?').join(',');
  const query = `DELETE FROM employees WHERE id IN (${placeholders})`;
  
  db.run(query, employeeIds, function(err) {
    if (err) {
      debugError('Error bulk deleting employees:', err);
      res.status(500).json({ error: 'Failed to delete employees' });
    } else {
      res.json({ 
        success: true, 
        deletedCount: this.changes,
        message: `Successfully deleted ${this.changes} employees`
      });
    }
  });
});

/**
 * Bulk create employees
 */
router.post('/api/employees/bulk-create', async (req, res) => {
  const { employees } = req.body;
  const db = dbService.getDb();
  
  if (!employees || !Array.isArray(employees) || employees.length === 0) {
    return res.status(400).json({ error: 'Employees array is required' });
  }
  
  const results = {
    success: true,
    totalProcessed: employees.length,
    successful: 0,
    failed: 0,
    errors: [],
    createdEmployees: []
  };
  
  // Process employees sequentially to avoid race conditions
  const processEmployee = async (index) => {
    if (index >= employees.length) {
      // All processed
      results.success = results.failed === 0;
      return res.json(results);
    }
    
    const employee = employees[index];
    // Generate ID based on employee name
    const id = helpers.generateEmployeeId(employee.name);
    const now = new Date().toISOString();
    
    // Generate password if not provided
    const plainPassword = employee.password || helpers.generateDefaultPassword(employee.name);
    
    // Hash the password before storing
    let hashedPassword;
    try {
      hashedPassword = await helpers.hashPassword(plainPassword);
    } catch (hashError) {
      results.failed++;
      results.errors.push(`Failed to hash password for ${employee.name}: ${hashError.message}`);
      // Process next employee
      return processEmployee(index + 1);
    }
    
    // Validate and set role (defaults to 'employee' if not provided or invalid)
    const allowedRoles = ['employee', 'supervisor', 'admin', 'finance'];
    const userRole = allowedRoles.includes(employee.role) ? employee.role : 'employee';
    
    db.run(
      'INSERT INTO employees (id, name, preferredName, email, password, oxfordHouseId, position, role, phoneNumber, baseAddress, baseAddress2, costCenters, selectedCostCenters, defaultCostCenter, supervisorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        employee.name,
        employee.preferredName || '',
        employee.email,
        hashedPassword,
        employee.oxfordHouseId || '',
        employee.position,
        userRole, // Include role field
        employee.phoneNumber || '',
        employee.baseAddress || '',
        employee.baseAddress2 || '',
        typeof employee.costCenters === 'string' ? employee.costCenters : JSON.stringify(employee.costCenters || []),
        typeof employee.selectedCostCenters === 'string' ? employee.selectedCostCenters : JSON.stringify(employee.selectedCostCenters || employee.costCenters || []),
        employee.defaultCostCenter || (Array.isArray(employee.costCenters) ? employee.costCenters[0] : '') || '',
        employee.supervisorId || null,
        now,
        now
      ],
      function(err) {
        if (err) {
          results.failed++;
          results.errors.push(`Failed to create ${employee.name}: ${err.message}`);
        } else {
          results.successful++;
          results.createdEmployees.push({ id, ...employee });
        }
        // Process next employee
        processEmployee(index + 1);
      }
    );
  };
  
  await processEmployee(0);
});

/**
 * Create new employee
 * POST /api/employees
 * 
 * @body {string} name - Employee full name (required)
 * @body {string} email - Employee email address (required)
 * @body {string} position - Employee position/title (required)
 * @body {string} oxfordHouseId - Oxford House ID (optional)
 * @body {string} phoneNumber - Phone number (optional)
 * @body {string} baseAddress - Base address (optional)
 * @body {string} preferredName - Preferred name/nickname (optional)
 * @body {string} password - Password (optional, auto-generated if not provided)
 * @body {string[]} costCenters - Array of cost centers (optional)
 * @body {string} supervisorId - Supervisor employee ID (optional)
 * 
 * @returns {Object} Created employee with ID and temporary password (if auto-generated)
 * 
 * @example
 * POST /api/employees
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "position": "Manager"
 * }
 */
router.post('/api/employees', 
  validateRequired(['name', 'email', 'position']),
  validateEmail('email'),
  asyncHandler(async (req, res) => {
    const { name, email, oxfordHouseId, position, role, phoneNumber, baseAddress, baseAddress2, costCenters, selectedCostCenters, defaultCostCenter, supervisorId, preferredName, password } = req.body;
    const db = dbService.getDb();
  
  // Generate ID based on employee name
  const id = helpers.generateEmployeeId(name);
  const now = new Date().toISOString();
  
  // Generate password if not provided
  const plainPassword = password || helpers.generateDefaultPassword(name);
  
  // Hash the password before storing
  let hashedPassword;
  try {
    hashedPassword = await helpers.hashPassword(plainPassword);
  } catch (hashError) {
    debugError('❌ Error hashing password:', hashError);
    return res.status(500).json({ error: 'Failed to hash password' });
  }
  
  // Validate and set role (defaults to 'employee' if not provided or invalid)
  const allowedRoles = ['employee', 'supervisor', 'admin', 'finance'];
  const userRole = allowedRoles.includes(role) ? role : 'employee';
  
  // Use Promise wrapper for callback-based database operations
  await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO employees (id, name, preferredName, email, password, oxfordHouseId, position, role, phoneNumber, baseAddress, baseAddress2, costCenters, selectedCostCenters, defaultCostCenter, supervisorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id, 
        name, 
        preferredName || '', 
        email, 
        hashedPassword,
        oxfordHouseId || '', 
        position, 
        userRole, // Include role field
        phoneNumber || '', 
        baseAddress || '', 
        baseAddress2 || '', 
        typeof costCenters === 'string' ? costCenters : JSON.stringify(costCenters || []),
        typeof selectedCostCenters === 'string' ? selectedCostCenters : JSON.stringify(selectedCostCenters || costCenters || []),
        defaultCostCenter || '',
        supervisorId || null, 
        now, 
        now
      ],
      function(err) {
        if (err) {
          debugError('Database error:', err.message);
          reject(createError(err.message, 500));
        } else {
          resolve();
        }
      }
    );
  });

  res.json({ id, message: 'Employee created successfully', temporaryPassword: !password ? plainPassword : undefined });
  })
);

/**
 * Update employee
 * PUT /api/employees/:id
 * 
 * @param {string} id - Employee ID (URL parameter)
 * @body {Object} updateData - Fields to update (all fields optional)
 * @body {string} name - Employee name
 * @body {string} email - Employee email
 * @body {string} position - Employee position
 * @body {string} preferredName - Preferred name
 * @body {string} phoneNumber - Phone number
 * @body {string} baseAddress - Base address
 * @body {string[]} costCenters - Cost centers array
 * @body {string} supervisorId - Supervisor ID
 * 
 * @returns {Object} Updated employee object
 * 
 * @example
 * PUT /api/employees/employee-123
 * {
 *   "name": "John Doe Updated",
 *   "position": "Senior Manager"
 * }
 */
router.put('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const now = new Date().toISOString();
  const db = dbService.getDb();

  // Check if database connection exists
  if (!db) {
    debugError('❌ Database connection not initialized');
    res.status(500).json({ error: 'Database connection not initialized' });
    return;
  }

  // First, get the current employee data to merge with updates
  db.get('SELECT * FROM employees WHERE id = ?', [id], async (getErr, currentEmployee) => {
    if (getErr) {
      debugError('❌ Error fetching employee:', getErr);
      res.status(500).json({ error: 'Failed to fetch employee data', details: getErr.message });
      return;
    }

    if (!currentEmployee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Merge current data with updates (only update fields that are provided)
    // Ensure required fields are never null/undefined
    const name = updateData.name !== undefined ? (updateData.name || currentEmployee.name || '') : (currentEmployee.name || '');
    const preferredName = updateData.preferredName !== undefined ? (updateData.preferredName || '') : (currentEmployee.preferredName || '');
    const email = updateData.email !== undefined ? (updateData.email || currentEmployee.email || '') : (currentEmployee.email || '');
    const oxfordHouseId = updateData.oxfordHouseId !== undefined ? (updateData.oxfordHouseId || '') : (currentEmployee.oxfordHouseId || '');
    const position = updateData.position !== undefined ? (updateData.position || currentEmployee.position || '') : (currentEmployee.position || '');
    // Validate and set role (defaults to existing role or 'employee' if not provided or invalid)
    const allowedRoles = ['employee', 'supervisor', 'admin', 'finance'];
    const currentRole = currentEmployee.role || 'employee';
    const role = updateData.role !== undefined 
      ? (allowedRoles.includes(updateData.role) ? updateData.role : currentRole)
      : currentRole;
    const phoneNumber = updateData.phoneNumber !== undefined ? (updateData.phoneNumber || '') : (currentEmployee.phoneNumber || '');
    const baseAddress = updateData.baseAddress !== undefined ? (updateData.baseAddress || '') : (currentEmployee.baseAddress || '');
    const baseAddress2 = updateData.baseAddress2 !== undefined ? (updateData.baseAddress2 || '') : (currentEmployee.baseAddress2 || '');
    const costCenters = updateData.costCenters !== undefined 
      ? (typeof updateData.costCenters === 'string' ? updateData.costCenters : JSON.stringify(updateData.costCenters || []))
      : (currentEmployee.costCenters || '[]');
    const selectedCostCenters = updateData.selectedCostCenters !== undefined
      ? (typeof updateData.selectedCostCenters === 'string' ? updateData.selectedCostCenters : JSON.stringify(updateData.selectedCostCenters || []))
      : (currentEmployee.selectedCostCenters || '[]');
    const defaultCostCenter = updateData.defaultCostCenter !== undefined ? (updateData.defaultCostCenter || '') : (currentEmployee.defaultCostCenter || '');
    const signature = updateData.signature !== undefined ? (updateData.signature || null) : (currentEmployee.signature || null);
    const supervisorId = updateData.supervisorId !== undefined ? (updateData.supervisorId || null) : (currentEmployee.supervisorId || null);
    const typicalWorkStartHour = updateData.typicalWorkStartHour !== undefined ? (updateData.typicalWorkStartHour !== null && updateData.typicalWorkStartHour !== undefined ? updateData.typicalWorkStartHour : null) : (currentEmployee.typicalWorkStartHour !== null && currentEmployee.typicalWorkStartHour !== undefined ? currentEmployee.typicalWorkStartHour : null);
    const typicalWorkEndHour = updateData.typicalWorkEndHour !== undefined ? (updateData.typicalWorkEndHour !== null && updateData.typicalWorkEndHour !== undefined ? updateData.typicalWorkEndHour : null) : (currentEmployee.typicalWorkEndHour !== null && currentEmployee.typicalWorkEndHour !== undefined ? currentEmployee.typicalWorkEndHour : null);
    const hasCompletedOnboarding = updateData.hasCompletedOnboarding !== undefined ? (updateData.hasCompletedOnboarding === true || updateData.hasCompletedOnboarding === 1 ? 1 : 0) : (currentEmployee.hasCompletedOnboarding === 1 ? 1 : 0);
    const hasCompletedSetupWizard = updateData.hasCompletedSetupWizard !== undefined ? (updateData.hasCompletedSetupWizard === true || updateData.hasCompletedSetupWizard === 1 ? 1 : 0) : (currentEmployee.hasCompletedSetupWizard === 1 ? 1 : 0);

    // Handle password update: only hash if password is provided and is plain text (not already hashed)
    let password = currentEmployee.password || '';
    if (updateData.password !== undefined && updateData.password !== null && updateData.password.trim() !== '') {
      // Check if password is already hashed (bcrypt hashes start with $2b$)
      if (!updateData.password.startsWith('$2b$')) {
        // This is a plain text password - hash it
        try {
          password = await helpers.hashPassword(updateData.password);
          debugLog(`✅ Password updated for employee: ${id}`);
        } catch (hashError) {
          debugError('❌ Error hashing password:', hashError);
          res.status(500).json({ error: 'Failed to hash password' });
          return;
        }
      } else {
        // Password is already hashed (shouldn't happen from frontend, but handle it)
        password = updateData.password;
      }
    }

    // Validate required fields before update
    if (!name || name.trim() === '') {
      debugError('❌ Validation error: name is required');
      res.status(400).json({ error: 'Name is required and cannot be empty' });
      return;
    }
    if (!email || email.trim() === '') {
      debugError('❌ Validation error: email is required');
      res.status(400).json({ error: 'Email is required and cannot be empty' });
      return;
    }
    if (!position || position.trim() === '') {
      debugError('❌ Validation error: position is required');
      res.status(400).json({ error: 'Position is required and cannot be empty' });
      return;
    }

    db.run(
      'UPDATE employees SET name = ?, preferredName = ?, email = ?, password = ?, oxfordHouseId = ?, position = ?, role = ?, phoneNumber = ?, baseAddress = ?, baseAddress2 = ?, costCenters = ?, selectedCostCenters = ?, defaultCostCenter = ?, signature = ?, supervisorId = ?, typicalWorkStartHour = ?, typicalWorkEndHour = ?, hasCompletedOnboarding = ?, hasCompletedSetupWizard = ?, updatedAt = ? WHERE id = ?',
      [name, preferredName, email, password, oxfordHouseId, position, role, phoneNumber, baseAddress, baseAddress2, costCenters, selectedCostCenters, defaultCostCenter, signature, supervisorId, typicalWorkStartHour, typicalWorkEndHour, hasCompletedOnboarding, hasCompletedSetupWizard, now, id],
      function(err) {
        if (err) {
          debugError('❌ Database error updating employee:', err.message);
          debugError('❌ Full error:', err);
          res.status(500).json({ error: err.message, details: err.toString() });
          return;
        }
        if (this.changes === 0) {
          debugWarn('⚠️ No rows updated - employee might not exist');
        }
        res.json({ message: 'Employee updated successfully', changes: this.changes });
      }
    );
  });
});

/**
 * Archive employee (soft delete)
 */
router.post('/api/employees/:id/archive', (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();
  const db = dbService.getDb();
  
  debugLog(`📦 Archiving employee: ${id}`);
  
  db.run(
    'UPDATE employees SET archived = 1, updatedAt = ? WHERE id = ?',
    [now, id],
    function(err) {
      if (err) {
        debugError('❌ Error archiving employee:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        debugWarn('⚠️ No employee found to archive:', id);
        res.status(404).json({ error: 'Employee not found' });
        return;
      }
      debugLog(`✅ Employee archived successfully: ${id} (${this.changes} row(s) updated)`);
      
      // Verify the archive was successful
      db.get('SELECT name, archived FROM employees WHERE id = ?', [id], (verifyErr, row) => {
        if (!verifyErr && row) {
          debugLog(`✅ Verification: Employee "${row.name}" archived status is now: ${row.archived}`);
        }
      });
      
      res.json({ message: 'Employee archived successfully' });
    }
  );
});

/**
 * Restore archived employee
 */
router.post('/api/employees/:id/restore', (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();
  const db = dbService.getDb();
  
  db.run(
    'UPDATE employees SET archived = 0, updatedAt = ? WHERE id = ?',
    [now, id],
    function(err) {
      if (err) {
        debugError('❌ Error restoring employee:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }
      debugLog('✅ Employee restored successfully:', id);
      res.json({ message: 'Employee restored successfully' });
    }
  );
});

/**
 * Permanently delete archived employee (hard delete)
 */
router.delete('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  
  // First check if employee is archived
  db.get('SELECT archived FROM employees WHERE id = ?', [id], (err, row) => {
    if (err) {
      debugError('❌ Error checking employee archive status:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    
    // Only allow deletion of archived employees
    if (!row.archived) {
      res.status(400).json({ 
        error: 'Employee must be archived before permanent deletion. Please archive the employee first.' 
      });
      return;
    }
    
    // Perform the deletion
    db.run('DELETE FROM employees WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) {
        debugError('❌ Error deleting employee:', deleteErr);
        res.status(500).json({ error: deleteErr.message });
        return;
      }
      debugLog('✅ Employee permanently deleted:', id);
      res.json({ message: 'Employee permanently deleted successfully' });
    });
  });
});

/**
 * Get current employees (for mobile app authentication)
 */
router.get('/api/current-employees', (req, res) => {
  const db = dbService.getDb();
  db.all('SELECT id, name, email, oxfordHouseId, position, phoneNumber, baseAddress, costCenters FROM employees ORDER BY name', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse JSON fields for each employee
    const parsedRows = rows.map(row => {
      try {
        let costCenters = [];
        let selectedCostCenters = [];
        
        if (row.costCenters) {
          if (row.costCenters === '[object Object]') {
            costCenters = ['Program Services'];
          } else {
            try {
              costCenters = JSON.parse(row.costCenters);
            } catch (parseErr) {
              costCenters = ['Program Services'];
            }
          }
        }
        
        // Use costCenters as selectedCostCenters if selectedCostCenters doesn't exist
        selectedCostCenters = [...costCenters];
        
        return {
          ...row,
          costCenters,
          selectedCostCenters,
          defaultCostCenter: costCenters[0] || 'Program Services'
        };
      } catch (parseErr) {
        return {
          ...row,
          costCenters: ['Program Services'],
          selectedCostCenters: ['Program Services'],
          defaultCostCenter: 'Program Services'
        };
      }
    });
    
    res.json(parsedRows);
  });
});

/**
 * Update employee password (protected with rate limiting)
 */
router.put('/api/employees/:id/password', passwordResetLimiter, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const db = dbService.getDb();
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  // Hash the password before storing
  let hashedPassword;
  try {
    hashedPassword = await helpers.hashPassword(password);
  } catch (hashError) {
    debugError('❌ Error hashing password:', hashError);
    return res.status(500).json({ error: 'Failed to hash password' });
  }
  
  const now = new Date().toISOString();
  
  db.run(
    'UPDATE employees SET password = ?, updatedAt = ? WHERE id = ?',
    [hashedPassword, now, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }
      res.json({ message: 'Password updated successfully' });
    }
  );
});

/**
 * Get supervisor team
 */
router.get('/api/supervisors/:supervisorId/team', (req, res) => {
  const { supervisorId } = req.params;
  const db = dbService.getDb();

  db.all(
    `SELECT id, name, preferredName, email, position, costCenters, selectedCostCenters, archived, createdAt as joinDate
     FROM employees
     WHERE supervisorId = ? AND (archived IS NULL OR archived = 0)
     ORDER BY name`,
    [supervisorId],
    (err, rows) => {
      if (err) {
        debugError('❌ Error fetching supervisor team:', err);
        res.status(500).json({ error: err.message });
        return;
      }

      const parsedRows = rows.map(row => ({
        ...row,
        costCenters: helpers.parseJsonSafe(row.costCenters, []),
        selectedCostCenters: helpers.parseJsonSafe(row.selectedCostCenters, []),
      }));

      res.json(parsedRows);
    }
  );
});

/**
 * Get all supervisors
 */
router.get('/api/supervisors', (req, res) => {
  const db = dbService.getDb();
  db.all(
    `SELECT id, name, preferredName, email, position
     FROM employees
     WHERE (archived IS NULL OR archived = 0) AND LOWER(position) LIKE '%supervisor%'
     ORDER BY name`,
    (err, rows) => {
      if (err) {
        debugError('❌ Error fetching supervisors:', err);
        res.status(500).json({ error: err.message });
        return;
      }

      res.json(rows);
    }
  );
});

module.exports = router;


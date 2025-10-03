import { getDatabaseConnection } from '../utils/databaseConnection';

/**
 * External Data Sources Service
 * 
 * This service manages integrations with external systems like HR and accounting platforms
 * to automatically sync employee data, vendor information, and maintain integration preferences.
 */

export interface IntegrationMapping {
  id: string;
  systemType: 'HR' | 'ACCOUNTING' | 'PAYROLL' | 'GOOGLE_SHEETS' | 'GOOGLE_AUTH' | 'OTHER';
  systemName: string;
  apiEndpoint?: string;
  apiKey?: string;
  authType: 'API_KEY' | 'OAUTH' | 'BASIC_AUTH' | 'GOOGLE_AUTH' | 'FILE_IMPORT' | 'CUSTOM';
  authConfig: Record<string, any>;
  fieldMappings: FieldMapping[];
  syncSettings: SyncSettings;
  isActive: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FieldMapping {
  localField: string;
  externalField: string;
  transformation?: string; // Optional data transformation rule
  isRequired: boolean;
  defaultValue?: any;
}

export interface SyncSettings {
  autoSyncEnabled: boolean;
  syncFrequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL';
  syncDirection: 'IMPORT' | 'EXPORT' | 'BIDIRECTIONAL';
  conflictResolution: 'LOCAL_WINS' | 'EXTERNAL_WINS' | 'NEWEST_WINS' | 'MANUAL';
  syncFilters?: Record<string, any>;
  batchSize: number;
  retryAttempts: number;
}

export interface EmployeeSyncData {
  externalId: string;
  name: string;
  email: string;
  position: string;
  phoneNumber?: string;
  baseAddress: string;
  costCenters: string[];
  isActive: boolean;
  lastModified: Date;
}

export interface VendorSyncData {
  externalId: string;
  name: string;
  address?: string;
  category: string;
  isActive: boolean;
  lastModified: Date;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: string[];
  lastSyncAt: Date;
}

export interface IntegrationPreferences {
  employeeId: string;
  preferredSyncTimes: string[]; // Array of preferred sync times
  notificationSettings: {
    syncSuccess: boolean;
    syncFailure: boolean;
    dataConflicts: boolean;
    newEmployees: boolean;
    newVendors: boolean;
  };
  autoApprovalSettings: {
    enableAutoApproval: boolean;
    maxAmountThreshold: number;
    allowedCategories: string[];
    requireManagerApproval: boolean;
  };
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  headerRow: number;
  dataStartRow: number;
  columnMappings: Record<string, string>; // Maps sheet columns to employee fields
}

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

export interface EmployeeSheetData {
  rowNumber: number;
  name: string;
  email: string;
  position?: string;
  phoneNumber?: string;
  baseAddress?: string;
  costCenters?: string;
  isActive?: boolean;
  [key: string]: any; // Allow for additional fields
}

export class ExternalDataSourcesService {
  private static readonly DEFAULT_BATCH_SIZE = 50;
  private static readonly DEFAULT_RETRY_ATTEMPTS = 3;

  /**
   * Create a new integration mapping
   */
  static async createIntegrationMapping(mapping: Omit<IntegrationMapping, 'id' | 'createdAt' | 'updatedAt'>): Promise<IntegrationMapping> {
    try {
      const db = await getDatabaseConnection();
      const id = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      await db.runAsync(`
        INSERT INTO integration_mappings (
          id, systemType, systemName, apiEndpoint, apiKey, authType, 
          authConfig, fieldMappings, syncSettings, isActive, lastSyncAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, mapping.systemType, mapping.systemName, mapping.apiEndpoint,
        mapping.apiKey || null, mapping.authType, JSON.stringify(mapping.authConfig),
        JSON.stringify(mapping.fieldMappings), JSON.stringify(mapping.syncSettings),
        mapping.isActive ? 1 : 0, mapping.lastSyncAt?.toISOString() || null,
        now, now
      ]);

      return {
        id,
        ...mapping,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      };
    } catch (error) {
      console.error('Error creating integration mapping:', error);
      throw error;
    }
  }

  /**
   * Get all integration mappings
   */
  static async getIntegrationMappings(): Promise<IntegrationMapping[]> {
    try {
      const db = await getDatabaseConnection();
      const result = await db.getAllAsync(`
        SELECT * FROM integration_mappings 
        ORDER BY systemName, createdAt DESC
      `);

      return result.map(row => ({
        ...row,
        authConfig: JSON.parse(row.authConfig),
        fieldMappings: JSON.parse(row.fieldMappings),
        syncSettings: JSON.parse(row.syncSettings),
        lastSyncAt: row.lastSyncAt ? new Date(row.lastSyncAt) : undefined,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      }));
    } catch (error) {
      console.error('Error getting integration mappings:', error);
      return [];
    }
  }

  /**
   * Update an integration mapping
   */
  static async updateIntegrationMapping(id: string, updates: Partial<IntegrationMapping>): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      const now = new Date().toISOString();
      
      const fields = [];
      const values = [];

      if (updates.systemName !== undefined) {
        fields.push('systemName = ?');
        values.push(updates.systemName);
      }
      if (updates.apiEndpoint !== undefined) {
        fields.push('apiEndpoint = ?');
        values.push(updates.apiEndpoint);
      }
      if (updates.apiKey !== undefined) {
        fields.push('apiKey = ?');
        values.push(updates.apiKey);
      }
      if (updates.authType !== undefined) {
        fields.push('authType = ?');
        values.push(updates.authType);
      }
      if (updates.authConfig !== undefined) {
        fields.push('authConfig = ?');
        values.push(JSON.stringify(updates.authConfig));
      }
      if (updates.fieldMappings !== undefined) {
        fields.push('fieldMappings = ?');
        values.push(JSON.stringify(updates.fieldMappings));
      }
      if (updates.syncSettings !== undefined) {
        fields.push('syncSettings = ?');
        values.push(JSON.stringify(updates.syncSettings));
      }
      if (updates.isActive !== undefined) {
        fields.push('isActive = ?');
        values.push(updates.isActive ? 1 : 0);
      }
      if (updates.lastSyncAt !== undefined) {
        fields.push('lastSyncAt = ?');
        values.push(updates.lastSyncAt.toISOString());
      }

      fields.push('updatedAt = ?');
      values.push(now);
      values.push(id);

      await db.runAsync(
        `UPDATE integration_mappings SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    } catch (error) {
      console.error('Error updating integration mapping:', error);
      throw error;
    }
  }

  /**
   * Delete an integration mapping
   */
  static async deleteIntegrationMapping(id: string): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      await db.runAsync('DELETE FROM integration_mappings WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting integration mapping:', error);
      throw error;
    }
  }

  /**
   * Sync employee data from external HR system
   */
  static async syncEmployeesFromHR(integrationId: string): Promise<SyncResult> {
    try {
      const mapping = await this.getIntegrationMappingById(integrationId);
      if (!mapping || mapping.systemType !== 'HR') {
        throw new Error('Invalid HR integration mapping');
      }

      const externalData = await this.fetchExternalEmployeeData(mapping);
      const result: SyncResult = {
        success: true,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [],
        lastSyncAt: new Date()
      };

      for (const employeeData of externalData) {
        try {
          result.recordsProcessed++;
          
          // Check if employee already exists
          const existingEmployee = await this.findEmployeeByExternalId(integrationId, employeeData.externalId);
          
          if (existingEmployee) {
            // Update existing employee
            await this.updateEmployeeFromSync(existingEmployee.id, employeeData, mapping);
            result.recordsUpdated++;
          } else {
            // Create new employee
            await this.createEmployeeFromSync(employeeData, mapping);
            result.recordsCreated++;
          }
        } catch (error) {
          result.errors.push(`Error processing employee ${employeeData.externalId}: ${error.message}`);
          result.recordsSkipped++;
        }
      }

      // Update last sync time
      await this.updateIntegrationMapping(integrationId, { lastSyncAt: new Date() });

      return result;
    } catch (error) {
      console.error('Error syncing employees from HR:', error);
      throw error;
    }
  }

  /**
   * Sync vendor data from external accounting system
   */
  static async syncVendorsFromAccounting(integrationId: string): Promise<SyncResult> {
    try {
      const mapping = await this.getIntegrationMappingById(integrationId);
      if (!mapping || mapping.systemType !== 'ACCOUNTING') {
        throw new Error('Invalid accounting integration mapping');
      }

      const externalData = await this.fetchExternalVendorData(mapping);
      const result: SyncResult = {
        success: true,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [],
        lastSyncAt: new Date()
      };

      for (const vendorData of externalData) {
        try {
          result.recordsProcessed++;
          
          // Check if vendor already exists
          const existingVendor = await this.findVendorByExternalId(integrationId, vendorData.externalId);
          
          if (existingVendor) {
            // Update existing vendor
            await this.updateVendorFromSync(existingVendor.id, vendorData, mapping);
            result.recordsUpdated++;
          } else {
            // Create new vendor
            await this.createVendorFromSync(vendorData, mapping);
            result.recordsCreated++;
          }
        } catch (error) {
          result.errors.push(`Error processing vendor ${vendorData.externalId}: ${error.message}`);
          result.recordsSkipped++;
        }
      }

      // Update last sync time
      await this.updateIntegrationMapping(integrationId, { lastSyncAt: new Date() });

      return result;
    } catch (error) {
      console.error('Error syncing vendors from accounting:', error);
      throw error;
    }
  }

  /**
   * Get integration preferences for an employee
   */
  static async getIntegrationPreferences(employeeId: string): Promise<IntegrationPreferences | null> {
    try {
      const db = await getDatabaseConnection();
      const result = await db.getFirstAsync(`
        SELECT * FROM integration_preferences WHERE employeeId = ?
      `, [employeeId]);

      if (!result) return null;

      return {
        employeeId: result.employeeId,
        preferredSyncTimes: JSON.parse(result.preferredSyncTimes),
        notificationSettings: JSON.parse(result.notificationSettings),
        autoApprovalSettings: JSON.parse(result.autoApprovalSettings)
      };
    } catch (error) {
      console.error('Error getting integration preferences:', error);
      return null;
    }
  }

  /**
   * Update integration preferences for an employee
   */
  static async updateIntegrationPreferences(employeeId: string, preferences: IntegrationPreferences): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      const now = new Date().toISOString();

      await db.runAsync(`
        INSERT OR REPLACE INTO integration_preferences (
          employeeId, preferredSyncTimes, notificationSettings, autoApprovalSettings, updatedAt
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        employeeId,
        JSON.stringify(preferences.preferredSyncTimes),
        JSON.stringify(preferences.notificationSettings),
        JSON.stringify(preferences.autoApprovalSettings),
        now
      ]);
    } catch (error) {
      console.error('Error updating integration preferences:', error);
      throw error;
    }
  }

  /**
   * Import employee data from Google Sheets
   */
  static async importEmployeesFromGoogleSheets(
    integrationId: string,
    spreadsheetId: string,
    sheetName: string = 'Sheet1'
  ): Promise<SyncResult> {
    try {
      console.log(`📊 Importing employees from Google Sheets: ${spreadsheetId}`);
      
      // Get integration mapping
      const mapping = await this.getIntegrationMappingById(integrationId);
      if (!mapping) {
        throw new Error('Integration mapping not found');
      }

      // Fetch data from Google Sheets
      const sheetData = await this.fetchGoogleSheetsData(spreadsheetId, sheetName);
      
      const result: SyncResult = {
        success: true,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [],
        lastSyncAt: new Date()
      };

      // Process each row of data
      for (const [index, rowData] of sheetData.entries()) {
        try {
          result.recordsProcessed++;
          
          // Map sheet data to employee format
          const employeeData = this.mapSheetDataToEmployee(rowData, mapping.fieldMappings, index + 2); // +2 for 1-based indexing and header row
          
          // Validate required fields
          if (!employeeData.name || !employeeData.email) {
            result.errors.push(`Row ${index + 2}: Missing required fields (name or email)`);
            result.recordsSkipped++;
            continue;
          }

          // Check if employee already exists
          const existingEmployee = await this.findEmployeeByEmail(employeeData.email);
          
          if (existingEmployee) {
            // Update existing employee
            await this.updateEmployeeFromSheetData(existingEmployee.id, employeeData);
            result.recordsUpdated++;
          } else {
            // Create new employee
            await this.createEmployeeFromSheetData(employeeData);
            result.recordsCreated++;
          }
        } catch (error) {
          result.errors.push(`Row ${index + 2}: ${error.message}`);
          result.recordsSkipped++;
        }
      }

      // Update last sync time
      await this.updateIntegrationMapping(integrationId, { lastSyncAt: new Date() });

      console.log(`✅ Google Sheets import completed: ${result.recordsCreated} created, ${result.recordsUpdated} updated, ${result.recordsSkipped} skipped`);
      return result;
    } catch (error) {
      console.error('Error importing employees from Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Import employee data from CSV file
   */
  static async importEmployeesFromCSV(
    integrationId: string,
    csvData: string,
    filename: string = 'employees.csv'
  ): Promise<SyncResult> {
    try {
      console.log(`📊 Importing employees from CSV: ${filename}`);
      
      // Get integration mapping
      const mapping = await this.getIntegrationMappingById(integrationId);
      if (!mapping) {
        throw new Error('Integration mapping not found');
      }

      // Parse CSV data
      const sheetData = this.parseCSVData(csvData);
      
      const result: SyncResult = {
        success: true,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [],
        lastSyncAt: new Date()
      };

      // Process each row of data
      for (const [index, rowData] of sheetData.entries()) {
        try {
          result.recordsProcessed++;
          
          // Map sheet data to employee format
          const employeeData = this.mapSheetDataToEmployee(rowData, mapping.fieldMappings, index + 2);
          
          // Validate required fields
          if (!employeeData.name || !employeeData.email) {
            result.errors.push(`Row ${index + 2}: Missing required fields (name or email)`);
            result.recordsSkipped++;
            continue;
          }

          // Check if employee already exists
          const existingEmployee = await this.findEmployeeByEmail(employeeData.email);
          
          if (existingEmployee) {
            // Update existing employee
            await this.updateEmployeeFromSheetData(existingEmployee.id, employeeData);
            result.recordsUpdated++;
          } else {
            // Create new employee
            await this.createEmployeeFromSheetData(employeeData);
            result.recordsCreated++;
          }
        } catch (error) {
          result.errors.push(`Row ${index + 2}: ${error.message}`);
          result.recordsSkipped++;
        }
      }

      // Update last sync time
      await this.updateIntegrationMapping(integrationId, { lastSyncAt: new Date() });

      console.log(`✅ CSV import completed: ${result.recordsCreated} created, ${result.recordsUpdated} updated, ${result.recordsSkipped} skipped`);
      return result;
    } catch (error) {
      console.error('Error importing employees from CSV:', error);
      throw error;
    }
  }

  /**
   * Setup Google Auth integration
   */
  static async setupGoogleAuthIntegration(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    scopes: string[] = ['https://www.googleapis.com/auth/spreadsheets.readonly']
  ): Promise<IntegrationMapping> {
    try {
      console.log('🔐 Setting up Google Auth integration');

      const googleAuthConfig: GoogleAuthConfig = {
        clientId,
        clientSecret,
        redirectUri,
        scopes,
      };

      const fieldMappings: FieldMapping[] = [
        { localField: 'name', externalField: 'FULL_NAME', isRequired: true },
        { localField: 'email', externalField: 'WORK_EMAIL', isRequired: true },
        { localField: 'position', externalField: 'EMPLOYEE_TITLE', isRequired: false },
        { localField: 'phoneNumber', externalField: 'PHONE', isRequired: false, transformation: 'PHONE_FORMAT' },
        { localField: 'costCenters', externalField: 'COST_CENTER', isRequired: false },
        { localField: 'externalId', externalField: 'EMPLOYEE_ID', isRequired: false },
      ];

      const syncSettings: SyncSettings = {
        autoSyncEnabled: false,
        syncFrequency: 'MANUAL',
        syncDirection: 'IMPORT',
        conflictResolution: 'NEWEST_WINS',
        batchSize: this.DEFAULT_BATCH_SIZE,
        retryAttempts: this.DEFAULT_RETRY_ATTEMPTS,
      };

      const mapping: Omit<IntegrationMapping, 'id' | 'createdAt' | 'updatedAt'> = {
        systemType: 'GOOGLE_AUTH',
        systemName: 'Google Sheets (Auth)',
        authType: 'GOOGLE_AUTH',
        authConfig: googleAuthConfig,
        fieldMappings,
        syncSettings,
        isActive: true,
      };

      return await this.createIntegrationMapping(mapping);
    } catch (error) {
      console.error('Error setting up Google Auth integration:', error);
      throw error;
    }
  }

  /**
   * Complete Google Auth OAuth flow
   */
  static async completeGoogleAuthFlow(
    integrationId: string,
    authCode: string
  ): Promise<void> {
    try {
      console.log('🔐 Completing Google Auth OAuth flow');

      const mapping = await this.getIntegrationMappingById(integrationId);
      if (!mapping || mapping.authType !== 'GOOGLE_AUTH') {
        throw new Error('Invalid Google Auth integration');
      }

      // Exchange authorization code for tokens
      const tokens = await this.exchangeAuthCodeForTokens(mapping.authConfig as GoogleAuthConfig, authCode);

      // Update integration with tokens
      const updatedAuthConfig = {
        ...mapping.authConfig,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      };

      await this.updateIntegrationMapping(integrationId, {
        authConfig: updatedAuthConfig,
      });

      console.log('✅ Google Auth OAuth flow completed successfully');
    } catch (error) {
      console.error('Error completing Google Auth flow:', error);
      throw error;
    }
  }

  /**
   * Setup HR integration with Oxford House Google Sheets
   */
  static async setupOxfordHouseHRIntegration(): Promise<IntegrationMapping> {
    try {
      console.log('🏢 Setting up Oxford House HR integration');

      const fieldMappings: FieldMapping[] = [
        { localField: 'name', externalField: 'FULL_NAME', isRequired: true },
        { localField: 'email', externalField: 'WORK_EMAIL', isRequired: true },
        { localField: 'position', externalField: 'EMPLOYEE_TITLE', isRequired: false },
        { localField: 'phoneNumber', externalField: 'PHONE', isRequired: false, transformation: 'PHONE_FORMAT' },
        { localField: 'costCenters', externalField: 'COST_CENTER', isRequired: false },
        { localField: 'externalId', externalField: 'EMPLOYEE_ID', isRequired: false },
      ];

      const syncSettings: SyncSettings = {
        autoSyncEnabled: false,
        syncFrequency: 'MANUAL',
        syncDirection: 'IMPORT',
        conflictResolution: 'NEWEST_WINS',
        batchSize: this.DEFAULT_BATCH_SIZE,
        retryAttempts: this.DEFAULT_RETRY_ATTEMPTS,
      };

      const mapping: Omit<IntegrationMapping, 'id' | 'createdAt' | 'updatedAt'> = {
        systemType: 'GOOGLE_SHEETS',
        systemName: 'Oxford House HR System',
        authType: 'FILE_IMPORT',
        authConfig: {
          spreadsheetId: '1WByevxN6vlHQtWuDm8s3wxY72pYn-cn7aqeaCjQSxlk',
          sheetName: 'Current Employees',
          headerRow: 1,
          dataStartRow: 2,
        },
        fieldMappings,
        syncSettings,
        isActive: true,
      };

      return await this.createIntegrationMapping(mapping);
    } catch (error) {
      console.error('Error setting up Oxford House HR integration:', error);
      throw error;
    }
  }

  /**
   * Import all employees from Oxford House HR sheet
   */
  static async importOxfordHouseEmployees(): Promise<SyncResult> {
    try {
      console.log('📊 Importing Oxford House employees from HR sheet');

      // First, set up the integration if it doesn't exist
      let integrations = await this.getIntegrationMappings();
      let hrIntegration = integrations.find(i => i.systemName === 'Oxford House HR System');

      if (!hrIntegration) {
        hrIntegration = await this.setupOxfordHouseHRIntegration();
      }

      // Import employees using the integration
      return await this.importEmployeesFromGoogleSheets(
        hrIntegration.id,
        '1WByevxN6vlHQtWuDm8s3wxY72pYn-cn7aqeaCjQSxlk',
        'Current Employees'
      );
    } catch (error) {
      console.error('Error importing Oxford House employees:', error);
      throw error;
    }
  }

  /**
   * Initialize database tables for external data sources
   */
  static async initializeTables(): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      
      // Create integration_mappings table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS integration_mappings (
          id TEXT PRIMARY KEY,
          systemType TEXT NOT NULL,
          systemName TEXT NOT NULL,
          apiEndpoint TEXT NOT NULL,
          apiKey TEXT,
          authType TEXT NOT NULL,
          authConfig TEXT NOT NULL,
          fieldMappings TEXT NOT NULL,
          syncSettings TEXT NOT NULL,
          isActive INTEGER NOT NULL DEFAULT 1,
          lastSyncAt TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Create integration_preferences table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS integration_preferences (
          employeeId TEXT PRIMARY KEY,
          preferredSyncTimes TEXT NOT NULL,
          notificationSettings TEXT NOT NULL,
          autoApprovalSettings TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (employeeId) REFERENCES employees (id) ON DELETE CASCADE
        );
      `);

      // Create external_sync_logs table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS external_sync_logs (
          id TEXT PRIMARY KEY,
          integrationId TEXT NOT NULL,
          syncType TEXT NOT NULL,
          result TEXT NOT NULL,
          recordsProcessed INTEGER NOT NULL,
          recordsCreated INTEGER NOT NULL,
          recordsUpdated INTEGER NOT NULL,
          recordsSkipped INTEGER NOT NULL,
          errors TEXT,
          syncStartedAt TEXT NOT NULL,
          syncCompletedAt TEXT NOT NULL,
          FOREIGN KEY (integrationId) REFERENCES integration_mappings (id) ON DELETE CASCADE
        );
      `);

      console.log('🔗 External Data Sources tables initialized');
    } catch (error) {
      console.error('Error initializing external data sources tables:', error);
    }
  }

  // Private helper methods
  private static async getIntegrationMappingById(id: string): Promise<IntegrationMapping | null> {
    try {
      const db = await getDatabaseConnection();
      const result = await db.getFirstAsync(`
        SELECT * FROM integration_mappings WHERE id = ?
      `, [id]);

      if (!result) return null;

      return {
        ...result,
        authConfig: JSON.parse(result.authConfig),
        fieldMappings: JSON.parse(result.fieldMappings),
        syncSettings: JSON.parse(result.syncSettings),
        lastSyncAt: result.lastSyncAt ? new Date(result.lastSyncAt) : undefined,
        createdAt: new Date(result.createdAt),
        updatedAt: new Date(result.updatedAt)
      };
    } catch (error) {
      console.error('Error getting integration mapping by ID:', error);
      return null;
    }
  }

  private static async fetchExternalEmployeeData(mapping: IntegrationMapping): Promise<EmployeeSyncData[]> {
    // This would integrate with actual HR system APIs
    // For now, returning mock data
    console.log(`🔄 Fetching employee data from ${mapping.systemName}...`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return [
      {
        externalId: 'HR001',
        name: 'John Smith',
        email: 'john.smith@company.com',
        position: 'Field Manager',
        phoneNumber: '555-0123',
        baseAddress: '123 Main St, Charlotte, NC 28215',
        costCenters: ['CC001', 'CC002'],
        isActive: true,
        lastModified: new Date()
      }
    ];
  }

  private static async fetchExternalVendorData(mapping: IntegrationMapping): Promise<VendorSyncData[]> {
    // This would integrate with actual accounting system APIs
    console.log(`🔄 Fetching vendor data from ${mapping.systemName}...`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return [
      {
        externalId: 'VEN001',
        name: 'Shell Gas Station',
        address: '456 Gas St, Charlotte, NC 28216',
        category: 'EES',
        isActive: true,
        lastModified: new Date()
      }
    ];
  }

  private static async findEmployeeByExternalId(integrationId: string, externalId: string): Promise<any> {
    // This would check if employee already exists based on external ID
    return null; // For now, always return null (create new)
  }

  private static async findVendorByExternalId(integrationId: string, externalId: string): Promise<any> {
    // This would check if vendor already exists based on external ID
    return null; // For now, always return null (create new)
  }

  private static async createEmployeeFromSync(employeeData: EmployeeSyncData, mapping: IntegrationMapping): Promise<void> {
    // Create new employee from sync data
    console.log(`➕ Creating new employee: ${employeeData.name}`);
  }

  private static async updateEmployeeFromSync(employeeId: string, employeeData: EmployeeSyncData, mapping: IntegrationMapping): Promise<void> {
    // Update existing employee from sync data
    console.log(`🔄 Updating employee: ${employeeData.name}`);
  }

  private static async createVendorFromSync(vendorData: VendorSyncData, mapping: IntegrationMapping): Promise<void> {
    // Create new vendor from sync data
    console.log(`➕ Creating new vendor: ${vendorData.name}`);
  }

  private static async updateVendorFromSync(vendorId: string, vendorData: VendorSyncData, mapping: IntegrationMapping): Promise<void> {
    // Update existing vendor from sync data
    console.log(`🔄 Updating vendor: ${vendorData.name}`);
  }

  // Google Sheets and CSV helper methods
  private static async fetchGoogleSheetsData(spreadsheetId: string, sheetName: string): Promise<any[]> {
    // This would use Google Sheets API to fetch data
    // For now, returning mock data structure
    console.log(`📊 Fetching data from Google Sheets: ${spreadsheetId}/${sheetName}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock data structure based on actual HR sheet - replace with actual Google Sheets API call
    return [
      {
        'EMPLOYEE_ID': '5cfaed3392dabb58c03d5779',
        'FULL_NAME': 'Goose Weisz',
        'COST_CENTER': 'Program Services',
        'WORK_EMAIL': 'greg.weisz@oxfordhouse.org',
        'PHONE': '17045647053',
        'EMPLOYEE_TITLE': 'Senior Data Analyst'
      },
      {
        'EMPLOYEE_ID': '5d60325822954e074a4cf6e1',
        'FULL_NAME': 'AJ Dunaway',
        'COST_CENTER': 'IL / MN / WI',
        'WORK_EMAIL': 'aj.dunaway@oxfordhouse.org',
        'PHONE': '17735909830',
        'EMPLOYEE_TITLE': 'Regional Manager'
      },
      {
        'EMPLOYEE_ID': '653fc7377ffe2633dcb88761',
        'FULL_NAME': 'Aaron Torrance',
        'COST_CENTER': 'WA.KING',
        'WORK_EMAIL': 'aaron.torrance@oxfordhouse.org',
        'PHONE': '14253875050',
        'EMPLOYEE_TITLE': 'Outreach Worker'
      }
    ];
  }

  private static parseCSVData(csvData: string): any[] {
    const lines = csvData.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = { rowNumber: index + 2 };
      
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      
      return row;
    }).filter(row => row[headers[0]]); // Filter out empty rows
  }

  private static mapSheetDataToEmployee(
    rowData: any, 
    fieldMappings: FieldMapping[], 
    rowNumber: number
  ): EmployeeSheetData {
    const employeeData: EmployeeSheetData = {
      rowNumber,
      name: '',
      email: '',
    };

    fieldMappings.forEach(mapping => {
      const value = rowData[mapping.externalField];
      if (value !== undefined && value !== '') {
        // Apply transformation if specified
        if (mapping.transformation) {
          employeeData[mapping.localField] = this.applyTransformation(value, mapping.transformation);
        } else {
          employeeData[mapping.localField] = value;
        }
      } else if (mapping.isRequired) {
        throw new Error(`Required field ${mapping.localField} is missing`);
      } else if (mapping.defaultValue !== undefined) {
        employeeData[mapping.localField] = mapping.defaultValue;
      }
    });

    // Parse cost centers if they're in a comma-separated format
    if (employeeData.costCenters && typeof employeeData.costCenters === 'string') {
      employeeData.costCenters = employeeData.costCenters.split(',').map(cc => cc.trim());
    }

    return employeeData;
  }

  private static applyTransformation(value: any, transformation: string): any {
    // Apply data transformation rules
    switch (transformation) {
      case 'UPPERCASE':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'LOWERCASE':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'TRIM':
        return typeof value === 'string' ? value.trim() : value;
      case 'PHONE_FORMAT':
        return this.formatPhoneNumber(value);
      default:
        return value;
    }
  }

  private static formatPhoneNumber(phone: string): string {
    // Basic phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  private static async findEmployeeByEmail(email: string): Promise<any> {
    try {
      const db = await getDatabaseConnection();
      return await db.getFirstAsync(`
        SELECT * FROM employees WHERE email = ?
      `, [email]);
    } catch (error) {
      console.error('Error finding employee by email:', error);
      return null;
    }
  }

  private static async createEmployeeFromSheetData(employeeData: EmployeeSheetData): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      const id = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      await db.runAsync(`
        INSERT INTO employees (
          id, name, email, password, oxfordHouseId, position, phoneNumber, 
          baseAddress, costCenters, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        employeeData.name,
        employeeData.email,
        '', // Empty password - will need to be set separately
        'default_house', // Default house - can be updated later
        employeeData.position || '',
        employeeData.phoneNumber || '',
        employeeData.baseAddress || '',
        JSON.stringify(employeeData.costCenters || []),
        now,
        now
      ]);

      console.log(`✅ Created new employee: ${employeeData.name} (${employeeData.email})`);
    } catch (error) {
      console.error('Error creating employee from sheet data:', error);
      throw error;
    }
  }

  private static async updateEmployeeFromSheetData(employeeId: string, employeeData: EmployeeSheetData): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      const now = new Date().toISOString();

      await db.runAsync(`
        UPDATE employees SET
          name = ?, position = ?, phoneNumber = ?, baseAddress = ?, 
          costCenters = ?, updatedAt = ?
        WHERE id = ?
      `, [
        employeeData.name,
        employeeData.position || '',
        employeeData.phoneNumber || '',
        employeeData.baseAddress || '',
        JSON.stringify(employeeData.costCenters || []),
        now,
        employeeId
      ]);

      console.log(`✅ Updated employee: ${employeeData.name} (${employeeData.email})`);
    } catch (error) {
      console.error('Error updating employee from sheet data:', error);
      throw error;
    }
  }

  private static async exchangeAuthCodeForTokens(
    authConfig: GoogleAuthConfig, 
    authCode: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    // This would make the actual OAuth token exchange API call
    // For now, returning mock tokens
    console.log('🔄 Exchanging authorization code for tokens...');
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_in: 3600 // 1 hour
    };
  }
}

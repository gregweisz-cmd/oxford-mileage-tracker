import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Employee, MileageEntry, Receipt, DailyOdometerReading, SavedAddress, TimeTracking, DailyDescription } from '../types';
import { DatabaseService } from './database';
import { debugLog, debugError, debugWarn } from '../config/debug';
// API Configuration
// Use central config so mobile uses the same base URL (local IP) as the app
import { API_BASE_URL } from '../config/api';

export interface ApiSyncConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface SyncResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
}

export interface SyncStatus {
  isConnected: boolean;
  lastSyncTime: Date | null;
  totalEmployees: number;
  totalMileageEntries: number;
  totalReceipts: number;
  totalTimeTracking: number;
  pendingChanges: number;
}

export class ApiSyncService {
  private static config: ApiSyncConfig = {
    baseUrl: API_BASE_URL,
    timeout: 10000, // 10 seconds
    retryAttempts: 3
  };
  private static employeeIdCache = new Map<string, string>();

  private static lastSyncTime: Date | null = null;
  private static pendingChanges: number = 0;

  /**
   * Fetch a backend employee by email (case-insensitive).
   */
  private static async fetchEmployeeByEmail(email: string): Promise<Employee | null> {
    try {
      if (!email) return null;
      const response = await fetch(`${this.config.baseUrl}/employees?search=${encodeURIComponent(email)}`);
      if (!response.ok) return null;
      const employees = await response.json();
      const match = (employees || []).find((emp: any) =>
        String(emp.email || '').toLowerCase() === email.toLowerCase()
      );
      if (!match) return null;
      return {
        id: match.id,
        name: match.name,
        preferredName: match.preferredName || '',
        email: match.email,
        password: match.password || '',
        oxfordHouseId: match.oxfordHouseId,
        position: match.position,
        phoneNumber: match.phoneNumber,
        baseAddress: match.baseAddress,
        baseAddress2: match.baseAddress2 || '',
        costCenters: Array.isArray(match.costCenters) ? match.costCenters : (match.costCenters ? JSON.parse(match.costCenters) : []),
        selectedCostCenters: Array.isArray(match.selectedCostCenters) ? match.selectedCostCenters : (match.selectedCostCenters ? JSON.parse(match.selectedCostCenters) : []),
        defaultCostCenter: match.defaultCostCenter || '',
        createdAt: new Date(match.createdAt),
        updatedAt: new Date(match.updatedAt)
      };
    } catch (error) {
      debugWarn('⚠️ ApiSync: Failed to fetch employee by email:', error);
      return null;
    }
  }

  /**
   * Resolve backend employee ID for a local employee ID using email matching.
   */
  private static async resolveBackendEmployeeId(localEmployeeId?: string): Promise<string | null> {
    if (!localEmployeeId) return null;
    if (this.employeeIdCache.has(localEmployeeId)) {
      return this.employeeIdCache.get(localEmployeeId) || null;
    }
    const localEmployee = await DatabaseService.getEmployeeById(localEmployeeId);
    if (!localEmployee?.email) {
      this.employeeIdCache.set(localEmployeeId, localEmployeeId);
      return localEmployeeId;
    }
    const backendEmployee = await this.fetchEmployeeByEmail(localEmployee.email);
    const backendId = backendEmployee?.id || localEmployeeId;
    this.employeeIdCache.set(localEmployeeId, backendId);
    return backendId;
  }

  /**
   * Map backend employee IDs to local employee ID for local persistence.
   */
  private static mapEmployeeIdForLocal<T extends { employeeId?: string }>(
    items: T[],
    localEmployeeId?: string,
    backendEmployeeId?: string | null
  ): T[] {
    if (!localEmployeeId || !backendEmployeeId || localEmployeeId === backendEmployeeId) {
      return items;
    }
    return items.map((item) =>
      item.employeeId === backendEmployeeId
        ? { ...item, employeeId: localEmployeeId }
        : item
    );
  }

  /**
   * Parse date safely - treats YYYY-MM-DD as local date
   */
  private static parseDateSafe(dateStr: string | Date): Date {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    
    // Check if it's YYYY-MM-DD format (date-only, no time)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date at noon local time to avoid timezone issues
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    
    // For datetime strings, parse normally
    return new Date(dateStr);
  }

  /**
   * Initialize the API sync service (non-blocking)
   */
  static async initialize(): Promise<void> {
    try {
      debugLog('🔄 ApiSync: Initializing API sync service...');
      
      // Load last sync time from storage (quick, non-blocking)
      this.lastSyncTime = await this.getLastSyncTime();
      
      // Skip connection test on startup to avoid blocking app load
      // Connection will be tested when sync is actually needed
      debugLog('🔄 ApiSync: Initialization completed immediately (connection test skipped on startup)');
    } catch (error) {
      console.error('❌ ApiSync: Initialization failed:', error);
      // Don't throw - allow app to continue even if initialization fails
    }
  }

  /**
   * Test connection to the backend API with timeout
   */
  static async testConnection(): Promise<boolean> {
    try {
      debugLog('🔄 ApiSync: Testing connection to cloud backend...');
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 3000); // 3 second timeout - don't wait too long
      
      try {
        // Try /api/health first, fallback to root if that doesn't exist
        const healthUrl = `${this.config.baseUrl}/health`;
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          debugLog('✅ ApiSync: Successfully connected to cloud backend');
          return true;
        } else {
          debugLog('⚠️ ApiSync: Cloud backend responded with status:', response.status);
          return false;
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // If timeout or abort, try root endpoint as fallback
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
          debugLog('⏱️ ApiSync: Health check timed out, trying root endpoint...');
          
          const rootController = new AbortController();
          const rootTimeoutId = setTimeout(() => {
            rootController.abort();
          }, 3000); // Shorter timeout for fallback
          
          try {
            // Try root endpoint as fallback
            const rootUrl = this.config.baseUrl.replace('/api', '') || this.config.baseUrl;
            const rootResponse = await fetch(rootUrl, {
              method: 'GET',
              signal: rootController.signal
            });
            
            clearTimeout(rootTimeoutId);
            
            if (rootResponse.ok || rootResponse.status < 500) {
              debugLog('✅ ApiSync: Backend is reachable (via root endpoint)');
              return true;
            }
          } catch (rootError) {
            clearTimeout(rootTimeoutId);
            debugLog('⚠️ ApiSync: Backend connection test failed (timeout)');
            return false;
          }
        }
        
        throw fetchError;
      }
    } catch (error) {
      // Connection failed - this is expected if backend is offline
      debugLog('⚠️ ApiSync: Backend not reachable (will work offline)');
      return false;
    }
  }

  /**
   * Sync all data from mobile to backend
   */
  static async syncToBackend(data: {
    employees?: Employee[];
    mileageEntries?: MileageEntry[];
    receipts?: Receipt[];
    timeTracking?: TimeTracking[];
    dailyDescriptions?: DailyDescription[];
  }): Promise<SyncResult> {
    try {
      debugLog('📤 ApiSync: Syncing data to backend...');
      
      const results: SyncResult[] = [];
      
      // Sync employees
      if (data.employees && data.employees.length > 0) {
        const employeeResult = await this.syncEmployees(data.employees);
        results.push(employeeResult);
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Sync mileage entries
      if (data.mileageEntries && data.mileageEntries.length > 0) {
        const mileageResult = await this.syncMileageEntries(data.mileageEntries);
        results.push(mileageResult);
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Sync receipts
      if (data.receipts && data.receipts.length > 0) {
        const receiptResult = await this.syncReceipts(data.receipts);
        results.push(receiptResult);
        // Add longer delay after receipts (they have images which take more time)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Sync time tracking
      if (data.timeTracking && data.timeTracking.length > 0) {
        const timeResult = await this.syncTimeTracking(data.timeTracking);
        results.push(timeResult);
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Sync daily descriptions
      if (data.dailyDescriptions && data.dailyDescriptions.length > 0) {
        const descriptionResult = await this.syncDailyDescriptions(data.dailyDescriptions);
        results.push(descriptionResult);
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Check if all syncs were successful
      const allSuccessful = results.every(result => result.success);
      
      // Collect error messages from failed syncs
      const failedSyncs = results.filter(result => !result.success);
      const errorMessages: string[] = [];
      
      // Collect errors from top-level result objects
      failedSyncs.forEach(result => {
        if (result.error && typeof result.error === 'string' && result.error.trim()) {
          errorMessages.push(result.error);
        }
      });
      
      // Also collect errors from individual items in data arrays
      results.forEach(result => {
        if (result.data && Array.isArray(result.data)) {
          result.data.forEach((item: any) => {
            if (!item.success && item.error && typeof item.error === 'string' && item.error.trim()) {
              errorMessages.push(item.error);
            }
          });
        }
      });
      
      // Remove duplicates
      const uniqueErrors = [...new Set(errorMessages)];
      
      if (allSuccessful) {
        this.lastSyncTime = new Date();
        this.pendingChanges = 0;
        await this.saveLastSyncTime(this.lastSyncTime);
      }
      
      debugLog('📤 ApiSync: Backend sync completed:', {
        successful: allSuccessful,
        results: results.length,
        failed: failedSyncs.length,
        errors: uniqueErrors
      });
      
      return {
        success: allSuccessful,
        data: results,
        error: uniqueErrors.length > 0 
          ? uniqueErrors.join('; ') 
          : (allSuccessful ? undefined : 'One or more sync operations failed. Please check your connection and try again.'),
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ ApiSync: Error syncing to backend:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync data from backend to mobile
   */
  static async syncFromBackend(employeeId?: string): Promise<SyncResult> {
    try {
      debugLog('📥 ApiSync: Syncing data from backend...');
      
      // Process any pending sync operations (including deletions) before syncing from backend
      // This ensures local deletions are sent to backend before we fetch data
      try {
        const { SyncIntegrationService } = await import('./syncIntegrationService');
        await SyncIntegrationService.processSyncQueue();
      } catch (queueError) {
        debugWarn('⚠️ ApiSync: Error processing sync queue before backend sync:', queueError);
        // Continue with backend sync even if queue processing fails
      }
      
      const syncData: any = {};
      const backendEmployeeId = employeeId
        ? await this.resolveBackendEmployeeId(employeeId)
        : null;
      const effectiveEmployeeId = backendEmployeeId || employeeId;
      
      // Fetch employees
      const employees = await this.fetchEmployees();
      syncData.employees = employees;
      
      // Fetch mileage entries
      const mileageEntries = await this.fetchMileageEntries(effectiveEmployeeId);
      const mappedMileageEntries = this.mapEmployeeIdForLocal(
        mileageEntries,
        employeeId,
        backendEmployeeId
      );
      syncData.mileageEntries = mappedMileageEntries;
      
      // Fetch receipts
      const receipts = await this.fetchReceipts(effectiveEmployeeId);
      const mappedReceipts = this.mapEmployeeIdForLocal(
        receipts,
        employeeId,
        backendEmployeeId
      );
      syncData.receipts = mappedReceipts;
      
      // Fetch time tracking
      const timeTracking = await this.fetchTimeTracking(effectiveEmployeeId);
      const mappedTimeTracking = this.mapEmployeeIdForLocal(
        timeTracking,
        employeeId,
        backendEmployeeId
      );
      syncData.timeTracking = mappedTimeTracking;
      
      // Fetch daily descriptions (non-blocking - continue even if it fails)
      let mappedDailyDescriptions: DailyDescription[] = [];
      try {
        const dailyDescriptions = await this.fetchDailyDescriptions(effectiveEmployeeId);
        mappedDailyDescriptions = this.mapEmployeeIdForLocal(
          dailyDescriptions,
          employeeId,
          backendEmployeeId
        );
        syncData.dailyDescriptions = mappedDailyDescriptions;
      } catch (error) {
        // Log error but continue sync - daily descriptions are optional
        console.error(`⚠️ ApiSync: Failed to fetch daily descriptions (continuing sync):`, error);
        debugWarn(`⚠️ ApiSync: Daily descriptions fetch failed, but continuing with other data. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        syncData.dailyDescriptions = [];
      }
      
      // Note: Per Diem rules are fetched on-demand in AddReceiptScreen
      // to avoid unnecessary API calls during general sync
      
      // Sync all data to local database
      if (mappedMileageEntries.length > 0) {
        await this.syncMileageEntriesToLocal(mappedMileageEntries);
      }
      if (mappedReceipts.length > 0) {
        await this.syncReceiptsToLocal(mappedReceipts);
      }
      if (mappedTimeTracking.length > 0) {
        await this.syncTimeTrackingToLocal(mappedTimeTracking);
      }
      if (mappedDailyDescriptions.length > 0) {
        await this.syncDailyDescriptionsToLocal(mappedDailyDescriptions);
      }
      
      // Per Diem rules sync removed - now loaded on-demand in AddReceiptScreen
      
      this.lastSyncTime = new Date();
      await this.saveLastSyncTime(this.lastSyncTime);
      
      debugLog('📥 ApiSync: Backend sync completed:', {
        employees: employees.length,
        mileageEntries: mappedMileageEntries.length,
        receipts: mappedReceipts.length,
        timeTracking: mappedTimeTracking.length,
        dailyDescriptions: mappedDailyDescriptions.length
      });
      
      return {
        success: true,
        data: syncData,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ ApiSync: Error syncing from backend:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync employees to backend
   */
  private static async syncEmployees(employees: Employee[]): Promise<SyncResult> {
    try {
      const results = [];
      
      for (const employee of employees) {
        try {
          // Check if employee exists
          const existingEmployee = await this.fetchEmployee(employee.id);
          
          if (existingEmployee) {
            // Update existing employee
            const response = await fetch(`${this.config.baseUrl}/employees/${employee.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: employee.name,
                email: employee.email,
                oxfordHouseId: employee.oxfordHouseId,
                position: employee.position,
                phoneNumber: employee.phoneNumber,
                baseAddress: employee.baseAddress,
                baseAddress2: employee.baseAddress2,
                costCenters: employee.costCenters
              })
            });
            
            if (!response.ok) {
              throw new Error(`Failed to update employee: ${response.statusText}`);
            }
          } else {
            // Create new employee
            const response = await fetch(`${this.config.baseUrl}/employees`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: employee.name,
                email: employee.email,
                oxfordHouseId: employee.oxfordHouseId,
                position: employee.position,
                phoneNumber: employee.phoneNumber,
                baseAddress: employee.baseAddress,
                baseAddress2: employee.baseAddress2,
                costCenters: employee.costCenters
              })
            });
            
            if (!response.ok) {
              throw new Error(`Failed to create employee: ${response.statusText}`);
            }
          }
          
          results.push({ success: true, id: employee.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing employee ${employee.id}:`, error);
          results.push({ success: false, id: employee.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      const allSuccessful = results.every(result => result.success);
      
      // Collect error messages from failed individual syncs
      const failedResults = results.filter((r: any) => !r.success && r.error);
      const errorMessages = failedResults.map((r: any) => r.error).filter(Boolean);
      
      return {
        success: allSuccessful,
        data: results,
        error: errorMessages.length > 0 
          ? errorMessages.join('; ') 
          : (allSuccessful ? undefined : 'One or more employee sync operations failed'),
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync mileage entries to backend
   */
  private static async syncMileageEntries(entries: MileageEntry[]): Promise<SyncResult> {
    try {
      const results = [];
      
      for (const entry of entries) {
        try {
          // Add small delay between entries to avoid rate limiting
          if (results.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          const backendEmployeeId = await this.resolveBackendEmployeeId(entry.employeeId);
          const employeeIdToSend = backendEmployeeId || entry.employeeId;
          
          // Validate and prepare mileage entry data
          // Preserve date as local date without timezone conversion
          let dateToSend: string;
          if (entry.date instanceof Date) {
            // Extract YYYY-MM-DD in local timezone
            const year = entry.date.getFullYear();
            const month = String(entry.date.getMonth() + 1).padStart(2, '0');
            const day = String(entry.date.getDate()).padStart(2, '0');
            dateToSend = `${year}-${month}-${day}T12:00:00.000Z`; // Noon UTC prevents date shifts
          } else {
            // Already a string, likely YYYY-MM-DD format
            const dateStr = entry.date as string;
            dateToSend = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00.000Z`;
          }
          
          const mileageData = {
            id: entry.id, // CRITICAL: Always include ID to prevent duplicates - backend uses INSERT OR REPLACE
            employeeId: employeeIdToSend,
            oxfordHouseId: entry.oxfordHouseId,
            date: dateToSend,
            odometerReading: entry.odometerReading,
            startLocation: entry.startLocation || '',
            endLocation: entry.endLocation || '',
            startLocationName: entry.startLocationDetails?.name || entry.startLocation || '',
            startLocationAddress: entry.startLocationDetails?.address || entry.startLocationDetails?.name || entry.startLocation || '',
            startLocationLat: entry.startLocationDetails?.latitude || 0,
            startLocationLng: entry.startLocationDetails?.longitude || 0,
            endLocationName: entry.endLocationDetails?.name || entry.endLocation || '',
            endLocationAddress: entry.endLocationDetails?.address || entry.endLocationDetails?.name || entry.endLocation || '',
            endLocationLat: entry.endLocationDetails?.latitude || 0,
            endLocationLng: entry.endLocationDetails?.longitude || 0,
            purpose: entry.purpose || '',
            miles: entry.miles,
            notes: entry.notes || '',
            hoursWorked: entry.hoursWorked,
            isGpsTracked: entry.isGpsTracked || false,
            costCenter: entry.costCenter || '' // Include costCenter to ensure it's synced
          };
          
          // Debug: Log address information to verify it's being sent
          debugLog(`📤 ApiSync: Syncing mileage entry ${entry.id} with addresses:`, {
            startLocationName: mileageData.startLocationName,
            startLocationAddress: mileageData.startLocationAddress,
            endLocationName: mileageData.endLocationName,
            endLocationAddress: mileageData.endLocationAddress
          });
          
          const response = await fetch(`${this.config.baseUrl}/mileage-entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mileageData)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ ApiSync: Failed to sync mileage entry ${entry.id}:`, response.status, errorText);
            throw new Error(`Failed to sync mileage entry: ${response.statusText}`);
          }
          
          debugLog(`✅ ApiSync: Successfully synced mileage entry ${entry.id} with addresses`);
          
          results.push({ success: true, id: entry.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing mileage entry ${entry.id}:`, error);
          results.push({ success: false, id: entry.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      const allSuccessful = results.every(result => result.success);
      
      // Collect error messages from failed individual syncs
      const failedResults = results.filter((r: any) => !r.success && r.error);
      const errorMessages = failedResults.map((r: any) => r.error).filter(Boolean);
      
      return {
        success: allSuccessful,
        data: results,
        error: errorMessages.length > 0 
          ? errorMessages.join('; ') 
          : (allSuccessful ? undefined : 'One or more mileage entry sync operations failed'),
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Upload receipt image to backend
   */
  private static async uploadReceiptImage(imageUri: string): Promise<{ success: boolean; uri?: string; error?: string }> {
    try {
      debugLog(`📤 ApiSync: Uploading image from ${imageUri}`);
      
      // Validate and sanitize the image URI
      if (!imageUri || typeof imageUri !== 'string') {
        return { success: false, error: 'Invalid image URI: URI is empty or not a string' };
      }
      
      // Check if URI is malformed (contains invalid characters)
      if (imageUri.includes('=') && !imageUri.includes('?')) {
        debugWarn(`⚠️ ApiSync: Suspicious URI format detected: ${imageUri}`);
        // Try to decode or fix the URI
        const decodedUri = decodeURIComponent(imageUri);
        if (decodedUri !== imageUri) {
          debugLog(`📤 ApiSync: Decoded URI: ${decodedUri}`);
          imageUri = decodedUri;
        }
      }
      
      // Verify the file exists (on React Native, we can't directly check file existence,
      // but we can validate the URI format)
      if (!imageUri.startsWith('file://') && !imageUri.startsWith('content://') && !imageUri.startsWith('ph://')) {
        debugWarn(`⚠️ ApiSync: URI doesn't match expected format: ${imageUri}`);
        // Continue anyway - some platforms might use different URI schemes
      }
      
      debugLog(`📤 ApiSync: Upload URL will be: ${this.config.baseUrl}/receipts/upload-image`);
      
      // Check if file exists before attempting to upload (only for file:// URIs)
      let fileExists = true;
      if (imageUri.startsWith('file://')) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(imageUri);
          if (!fileInfo.exists) {
            fileExists = false;
            debugWarn(`⚠️ ApiSync: Image file does not exist: ${imageUri}`);
            // Create notification for missing image
            await this.createMissingImageNotification(imageUri);
            return { 
              success: false, 
              error: `Image file not found. The file may have been deleted or moved. Please re-add the receipt image.` 
            };
          }
          debugLog(`✅ ApiSync: Image file exists, size: ${fileInfo.size} bytes`);
        } catch (fileCheckError) {
          // If file check fails, try to read the file to verify it exists
          try {
            // Use string 'base64' instead of EncodingType.Base64 for newer Expo versions
            await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' as any });
            debugLog(`✅ ApiSync: File is readable`);
          } catch (readError) {
            fileExists = false;
            const errorMsg = readError instanceof Error ? readError.message : String(readError);
            if (errorMsg.includes("couldn't be opened") || errorMsg.includes("no such file") || errorMsg.includes("code=260") || errorMsg.includes("NSCocoaErrorDomain")) {
              debugWarn(`⚠️ ApiSync: File cannot be read (likely doesn't exist): ${imageUri}`);
              // Create notification for missing image
              await this.createMissingImageNotification(imageUri);
              return { 
                success: false, 
                error: `Image file not found. The file may have been deleted or moved. Please re-add the receipt image.` 
              };
            }
            // Re-throw if it's a different error
            throw readError;
          }
        }
      }
      
      // Create FormData for file upload
      let formData: FormData;
      try {
        formData = new FormData();
        
        // Extract file extension from URI if possible, otherwise default to jpg
        let fileExtension = '.jpg';
        let mimeType = 'image/jpeg';
        const uriMatch = imageUri.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i);
        if (uriMatch) {
          fileExtension = uriMatch[0].toLowerCase();
          // Set MIME type based on extension
          if (fileExtension === '.pdf') {
            mimeType = 'application/pdf';
          } else if (fileExtension === '.png') {
            mimeType = 'image/png';
          } else if (fileExtension === '.gif') {
            mimeType = 'image/gif';
          } else if (fileExtension === '.webp') {
            mimeType = 'image/webp';
          }
        }
        
        // Add the file to FormData (image or PDF)
        const fileName = `receipt_${Date.now()}${fileExtension}`;
        
        // Try to append the file - this may throw if file doesn't exist
        try {
          formData.append('image', {
            uri: imageUri,
            type: mimeType,
            name: fileName,
          } as any);
          debugLog(`📤 ApiSync: FormData created successfully`);
        } catch (appendError) {
          // If append fails, the file likely doesn't exist
          const errorMsg = appendError instanceof Error ? appendError.message : String(appendError);
          if (errorMsg.includes("couldn't be opened") || errorMsg.includes("no such file") || errorMsg.includes("code=260") || errorMsg.includes("NSCocoaErrorDomain")) {
            debugWarn(`⚠️ ApiSync: Cannot append file to FormData (file doesn't exist): ${imageUri}`);
            // Create notification for missing file
            await this.createMissingImageNotification(imageUri);
            return { 
              success: false, 
              error: `Receipt file not found. The file may have been deleted or moved. Please re-add the receipt.` 
            };
          }
          throw appendError;
        }
      } catch (formDataError) {
        // Catch any other errors when creating FormData
        const errorMsg = formDataError instanceof Error ? formDataError.message : String(formDataError);
        if (errorMsg.includes("couldn't be opened") || errorMsg.includes("no such file") || errorMsg.includes("code=260") || errorMsg.includes("NSCocoaErrorDomain")) {
          debugWarn(`⚠️ ApiSync: File not found or cannot be opened: ${imageUri}`);
          // Create notification for missing file
          await this.createMissingImageNotification(imageUri);
          return { 
            success: false, 
            error: `Receipt file not found. The file may have been deleted or moved. Please re-add the receipt.` 
          };
        }
        // Re-throw other FormData errors
        throw formDataError;
      }
      
      debugLog(`📤 ApiSync: FormData created, preparing request with timeout...`);
      
      // Add a timeout so we don't hang forever
      const controller = new AbortController();
      const timeoutMs = 60000; // 60s - increased to match backend timeout
      const timeoutId = setTimeout(() => {
        // Timeout is expected for large images or slow connections - use debugLog instead of debugWarn
        debugLog(`⏱️ ApiSync: Upload timed out after ${timeoutMs}ms (continuing with local image)`);
        controller.abort();
      }, timeoutMs);
      
      try {
        // Upload to backend - wrap in try-catch to catch file access errors during fetch
        let response: Response;
        try {
          response = await fetch(`${this.config.baseUrl}/receipts/upload-image`, {
            method: 'POST',
            // Do not set Content-Type manually; let fetch add the multipart boundary
            body: formData,
            signal: controller.signal,
          });
        } catch (fetchInitError) {
          // Catch errors that occur when React Native tries to process the FormData body
          const errorMsg = fetchInitError instanceof Error ? fetchInitError.message : String(fetchInitError);
          if (errorMsg.includes("couldn't be opened") || errorMsg.includes("no such file") || errorMsg.includes("code=260") || errorMsg.includes("NSCocoaErrorDomain") || errorMsg.includes("Error processing request body")) {
            clearTimeout(timeoutId);
            debugWarn(`⚠️ ApiSync: File access error during fetch initialization: ${imageUri}`);
            return { 
              success: false, 
              error: `Receipt file not found. The file may have been deleted or moved. Please re-add the receipt.` 
            };
          }
          throw fetchInitError;
        }
        
        clearTimeout(timeoutId);
        debugLog(`📤 ApiSync: Response received, status:`, response?.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ ApiSync: Image upload failed:`, response.status, errorText);
          return { success: false, error: `Upload failed: ${response.status} ${response.statusText}` };
        }
        
        const result = await response.json();
        debugLog(`✅ ApiSync: Image upload successful:`, result);
        
        // Backend may return imageUri, imagePath, or filename. Normalize to /uploads/<filename> when possible
        const filename = result?.imageUri || result?.imagePath || result?.filename || '';
        const normalizedUri = filename
          ? (filename.startsWith('/uploads/') ? filename : `/uploads/${filename}`)
          : undefined;
        
        return { success: true, uri: normalizedUri };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Check if this is a file access error (happens when React Native tries to process FormData)
        const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        if (errorMsg.includes("couldn't be opened") || errorMsg.includes("no such file") || errorMsg.includes("code=260") || errorMsg.includes("NSCocoaErrorDomain") || errorMsg.includes("Error processing request body")) {
          debugWarn(`⚠️ ApiSync: File access error during fetch (file doesn't exist): ${imageUri}`);
          return { 
            success: false, 
            error: `Receipt file not found. The file may have been deleted or moved. Please re-add the receipt.` 
          };
        }
        
        // For timeout errors, use debugLog since they're expected and non-blocking
        // For other errors, use debugWarn
        let errorMessage = 'Unknown upload error';
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError' || errorMsg.includes('Aborted')) {
            errorMessage = `Upload timed out after ${timeoutMs / 1000} seconds. The image may be too large or the connection is slow. Please try again.`;
            debugLog(`⏱️ ApiSync: Upload timeout (expected for large images/slow connections): ${errorMessage}`);
          } else {
            errorMessage = errorMsg;
            debugWarn(`⚠️ ApiSync: Upload request error:`, fetchError);
          }
        } else {
          debugWarn(`⚠️ ApiSync: Upload request error:`, fetchError);
        }
        return { success: false, error: errorMessage };
      }
      
    } catch (error) {
      console.error(`❌ ApiSync: Error uploading image:`, error);
      
      // Provide more specific error messages for common issues
      let errorMessage = 'Unknown upload error';
      if (error instanceof Error) {
        const errorMsg = error.message;
        if (errorMsg.includes("couldn't be opened") || errorMsg.includes("no such file") || errorMsg.includes("code=260") || errorMsg.includes("Error processing request body")) {
          errorMessage = `Image file not found. The file may have been deleted or moved. Please re-add the receipt image.`;
        } else if (errorMsg.includes("NSCocoaErrorDomain")) {
          errorMessage = `File system error: The image file cannot be accessed. Please check the file path.`;
        } else {
          errorMessage = errorMsg;
        }
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  /**
   * Helper to create missing image notification (needs receipt context)
   */
  private static async createMissingImageNotification(imageUri: string): Promise<void> {
    // This will be called from syncReceipts with proper receipt context
    // For now, just log - the actual notification is created in syncReceipts
    debugWarn(`⚠️ ApiSync: Missing image notification will be created in syncReceipts`);
  }

  /**
   * Sync receipts to backend
   */
  private static async syncReceipts(receipts: Receipt[]): Promise<SyncResult> {
    try {
      const results = [];
      
      for (const receipt of receipts) {
        try {
          // Add small delay between receipts to avoid rate limiting
          if (results.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          const backendEmployeeId = await this.resolveBackendEmployeeId(receipt.employeeId);
          const employeeIdToSend = backendEmployeeId || receipt.employeeId;
          let backendImageUri = receipt.imageUri || '';
          
          // Upload image to backend if we have a local image URI
          // IMPORTANT: We need to upload the image so it's accessible on the web portal
          if (receipt.imageUri && receipt.imageUri.startsWith('file://')) {
            debugLog(`📤 ApiSync: Uploading image for receipt ${receipt.id}...`);
            
            try {
              debugLog(`📤 ApiSync: Calling uploadReceiptImage for receipt ${receipt.id}...`);
              // Use Promise.race to ensure we don't wait forever, but give it enough time
              const uploadPromise = this.uploadReceiptImage(receipt.imageUri);
              const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
                setTimeout(() => {
                  resolve({ success: false, error: 'Upload timeout - will retry on next sync' });
                }, 90000); // 90 seconds - give it more time for large images
              });
              
              const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);
              debugLog(`📤 ApiSync: uploadReceiptImage returned:`, uploadResult);
              
              if (uploadResult.success && uploadResult.uri) {
                backendImageUri = uploadResult.uri;
                debugLog(`✅ ApiSync: Image uploaded successfully: ${backendImageUri}`);
                
                // Clear any missing image notification for this receipt
                try {
                  const { SmartNotificationService } = await import('./smartNotificationService');
                  SmartNotificationService.clearMissingImageNotification(receipt.employeeId, receipt.id);
                } catch (notifError) {
                  debugWarn('Could not clear missing image notification:', notifError);
                }
              } else {
                // Check if error is due to missing file - check multiple error message patterns
                const errorMsg = uploadResult.error || '';
                const isFileNotFound = errorMsg.includes('file not found') || 
                                      errorMsg.includes("couldn't be opened") || 
                                      errorMsg.includes('no such file') ||
                                      errorMsg.includes('code=260') ||
                                      errorMsg.includes('NSCocoaErrorDomain') ||
                                      errorMsg.includes('Error processing request body') ||
                                      errorMsg.includes("The file couldn't be opened") ||
                                      errorMsg.includes("couldn't be opened because there is no such file");
                
                if (isFileNotFound) {
                  // Only create notification for current month receipts
                  const receiptDate = receipt.date instanceof Date ? receipt.date : new Date(receipt.date);
                  const now = new Date();
                  const isCurrentMonth = receiptDate.getMonth() === now.getMonth() && 
                                        receiptDate.getFullYear() === now.getFullYear();
                  
                  if (isCurrentMonth) {
                    // Verify receipt still exists before creating notification
                    try {
                      const { DatabaseService } = await import('./database');
                      const existingReceipt = await DatabaseService.getReceipt(receipt.id);
                      
                      if (existingReceipt) {
                        // Create notification for missing receipt image
                        const { SmartNotificationService } = await import('./smartNotificationService');
                        const notification = SmartNotificationService.createMissingImageNotification(
                          receipt.employeeId,
                          receipt.id,
                          receipt.vendor || 'Unknown',
                          receipt.amount,
                          receiptDate
                        );
                        console.error(`❌ ApiSync: Receipt image missing for receipt ${receipt.id} (${receipt.vendor || 'Unknown'}), notification created. Error: ${errorMsg}`);
                        debugWarn(`⚠️ ApiSync: Receipt image missing for receipt ${receipt.id}, notification created`);
                      } else {
                        debugLog(`ℹ️ ApiSync: Receipt ${receipt.id} was deleted, skipping missing image notification`);
                      }
                    } catch (notifError) {
                      console.error(`❌ ApiSync: Could not create missing image notification:`, notifError);
                      debugWarn('Could not create missing image notification:', notifError);
                    }
                  } else {
                    debugLog(`ℹ️ ApiSync: Receipt ${receipt.id} is from previous month (${receiptDate.toLocaleDateString()}), skipping missing image notification`);
                  }
                } else {
                  // Log other upload errors for debugging
                  debugWarn(`⚠️ ApiSync: Image upload failed for receipt ${receipt.id}, but not due to missing file. Error: ${errorMsg}`);
                }
                
                // Log the error but continue - we'll sync the receipt without the image for now
                // The image will be uploaded on the next sync attempt
                if (uploadResult.error?.includes('timed out') || uploadResult.error?.includes('timeout')) {
                  debugWarn(`⏱️ ApiSync: Image upload timed out for receipt ${receipt.id}. Receipt will sync without image - image will be uploaded on next sync.`);
                } else {
                  debugWarn(`⚠️ ApiSync: Image upload failed for receipt ${receipt.id}. Receipt will sync without image - image will be uploaded on next sync. Error: ${uploadResult.error || 'Unknown'}`);
                }
                // Keep the original file:// URI so we know to retry the upload next time
                // Don't set backendImageUri to empty - we'll try again on next sync
              }
            } catch (uploadError) {
              // Check if this is a file not found error
              const errorMsg = uploadError instanceof Error ? uploadError.message : String(uploadError);
              const isFileNotFound = errorMsg.includes("couldn't be opened") || 
                                    errorMsg.includes("no such file") || 
                                    errorMsg.includes("code=260") ||
                                    errorMsg.includes("NSCocoaErrorDomain") ||
                                    errorMsg.includes("Error processing request body") ||
                                    errorMsg.includes("The file couldn't be opened") ||
                                    errorMsg.includes("couldn't be opened because there is no such file");
              
              if (isFileNotFound) {
                // Only create notification for current month receipts
                const receiptDate = receipt.date instanceof Date ? receipt.date : new Date(receipt.date);
                const now = new Date();
                const isCurrentMonth = receiptDate.getMonth() === now.getMonth() && 
                                      receiptDate.getFullYear() === now.getFullYear();
                
                if (isCurrentMonth) {
                  // Verify receipt still exists before creating notification
                  try {
                    const { DatabaseService } = await import('./database');
                    const existingReceipt = await DatabaseService.getReceipt(receipt.id);
                    
                    if (existingReceipt) {
                      // Create notification for missing receipt image
                      const { SmartNotificationService } = await import('./smartNotificationService');
                      const notification = SmartNotificationService.createMissingImageNotification(
                        receipt.employeeId,
                        receipt.id,
                        receipt.vendor || 'Unknown',
                        receipt.amount,
                        receiptDate
                      );
                      console.error(`❌ ApiSync: Receipt image missing for receipt ${receipt.id} (${receipt.vendor || 'Unknown'}), notification created. Error: ${errorMsg}`);
                      debugWarn(`⚠️ ApiSync: Receipt image missing for receipt ${receipt.id}, notification created`);
                    } else {
                      debugLog(`ℹ️ ApiSync: Receipt ${receipt.id} was deleted, skipping missing image notification`);
                    }
                  } catch (notifError) {
                    console.error(`❌ ApiSync: Could not create missing image notification:`, notifError);
                    debugWarn('Could not create missing image notification:', notifError);
                  }
                } else {
                  debugLog(`ℹ️ ApiSync: Receipt ${receipt.id} is from previous month (${receiptDate.toLocaleDateString()}), skipping missing image notification`);
                }
              } else if (errorMsg.includes('timeout') || errorMsg.includes('Aborted')) {
                debugLog(`⏱️ ApiSync: Image upload timed out for receipt ${receipt.id}, continuing with local URI (expected behavior)`);
              } else {
                debugWarn(`⚠️ ApiSync: Image upload error for receipt ${receipt.id}, continuing with local URI:`, errorMsg);
              }
              // Continue with original imageUri if upload fails
            }
          }
          
          // Validate and prepare receipt data
          // Only include imageUri if we successfully uploaded it (not a file:// path)
          const receiptData = {
            id: receipt.id, // Include ID to prevent duplicates on backend
            employeeId: employeeIdToSend,
            date: receipt.date instanceof Date ? receipt.date.toISOString() : new Date(receipt.date).toISOString(),
            amount: receipt.amount,
            vendor: receipt.vendor || '',
            description: receipt.description || '',
            category: receipt.category || '',
            // Only include imageUri if it's a backend path, not a local file path
            // This ensures the web portal can access the image
            imageUri: backendImageUri && !backendImageUri.startsWith('file://') ? backendImageUri : undefined
          };
          
          const response = await fetch(`${this.config.baseUrl}/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(receiptData)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ ApiSync: Receipt sync failed ${receipt.id}:`, response.status, errorText);
            throw new Error(`Failed to sync receipt: ${response.status} ${response.statusText}`);
          }
          
          // Update local database with backend image URI if image was uploaded
          if (backendImageUri && backendImageUri !== receipt.imageUri && backendImageUri.startsWith('/uploads/')) {
            try {
              const { DatabaseService } = await import('./database');
              await DatabaseService.updateReceipt(receipt.id, {
                ...receipt,
                imageUri: backendImageUri
              });
              debugLog(`✅ ApiSync: Updated local receipt ${receipt.id} with backend image URI`);
            } catch (updateError) {
              console.error(`⚠️ ApiSync: Failed to update local receipt with backend image URI:`, updateError);
            }
          }
          
          results.push({ success: true, id: receipt.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing receipt ${receipt.id}:`, error instanceof Error ? error.message : 'Unknown error');
          results.push({ success: false, id: receipt.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      const allSuccessful = results.every(result => result.success);
      
      // Collect error messages from failed individual syncs
      const failedResults = results.filter((r: any) => !r.success && r.error);
      const errorMessages = failedResults.map((r: any) => r.error).filter(Boolean);
      
      return {
        success: allSuccessful,
        data: results,
        error: errorMessages.length > 0 
          ? errorMessages.join('; ') 
          : (allSuccessful ? undefined : 'One or more mileage entry sync operations failed'),
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync daily descriptions to backend
   */
  private static async syncDailyDescriptions(descriptions: DailyDescription[]): Promise<SyncResult> {
    try {
      const results = [];
      
      for (const desc of descriptions) {
        try {
          // Add small delay between descriptions to avoid rate limiting
          if (results.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          const backendEmployeeId = await this.resolveBackendEmployeeId(desc.employeeId);
          const employeeIdToSend = backendEmployeeId || desc.employeeId;
          
          let dateToSend: string;
          if (desc.date instanceof Date) {
            const year = desc.date.getFullYear();
            const month = String(desc.date.getMonth() + 1).padStart(2, '0');
            const day = String(desc.date.getDate()).padStart(2, '0');
            dateToSend = `${year}-${month}-${day}`;
          } else {
            const dateStr = desc.date as unknown as string;
            dateToSend = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
          }
          
          const payload = {
            id: desc.id,
            employeeId: employeeIdToSend,
            date: dateToSend,
            description: desc.description || '',
            costCenter: desc.costCenter || '',
            stayedOvernight: !!desc.stayedOvernight,
            dayOff: !!desc.dayOff,
            dayOffType: desc.dayOffType || null
          };
          
          const response = await fetch(`${this.config.baseUrl}/daily-descriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ ApiSync: Failed to sync daily description ${desc.id}:`, response.status, errorText);
            throw new Error(`Failed to sync daily description: ${response.statusText}`);
          }
          
          results.push({ success: true, id: desc.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing daily description ${desc.id}:`, error);
          results.push({ success: false, id: desc.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      const allSuccessful = results.every(result => result.success);
      
      // Collect error messages from failed individual syncs
      const failedResults = results.filter((r: any) => !r.success && r.error);
      const errorMessages = failedResults.map((r: any) => r.error).filter(Boolean);
      
      return {
        success: allSuccessful,
        data: results,
        error: errorMessages.length > 0 
          ? errorMessages.join('; ') 
          : (allSuccessful ? undefined : 'One or more mileage entry sync operations failed'),
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync time tracking to backend
   */
  private static async syncTimeTracking(entries: TimeTracking[]): Promise<SyncResult> {
    try {
      const results = [];
      
      for (const entry of entries) {
        try {
          // Add small delay between entries to avoid rate limiting
          if (results.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          const backendEmployeeId = await this.resolveBackendEmployeeId(entry.employeeId);
          const employeeIdToSend = backendEmployeeId || entry.employeeId;
          // Validate and prepare time tracking data
          let dateToSend: string;
          if (entry.date instanceof Date) {
            const year = entry.date.getFullYear();
            const month = String(entry.date.getMonth() + 1).padStart(2, '0');
            const day = String(entry.date.getDate()).padStart(2, '0');
            dateToSend = `${year}-${month}-${day}`;
          } else {
            const dateStr = entry.date as string;
            dateToSend = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
          }

          const timeTrackingData = {
            id: entry.id, // Include ID to prevent duplicates on backend
            employeeId: employeeIdToSend,
            date: dateToSend,
            category: entry.category || '',
            hours: entry.hours,
            description: entry.description || '',
            costCenter: entry.costCenter || ''
          };
          
          debugLog(`📤 ApiSync: Syncing time tracking ${entry.id}:`, timeTrackingData);
          
          // Validate JSON serialization
          const jsonPayload = JSON.stringify(timeTrackingData);
          debugLog(`📤 ApiSync: JSON payload for time tracking ${entry.id}:`, jsonPayload);
          
          const response = await fetch(`${this.config.baseUrl}/time-tracking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonPayload
          });
          
          if (!response.ok) {
            // Try to get error message from response body
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errorText = await response.text();
              if (errorText) {
                try {
                  const errorJson = JSON.parse(errorText);
                  errorMessage = errorJson.error || errorJson.message || errorText;
                } catch {
                  errorMessage = errorText;
                }
              } else if (response.statusText) {
                errorMessage = response.statusText;
              }
            } catch (parseError) {
              // If we can't read the response, use status code
              errorMessage = `HTTP ${response.status}${response.statusText ? ': ' + response.statusText : ''}`;
            }
            
            // Handle rate limiting specifically
            if (response.status === 429) {
              errorMessage = `Rate limit exceeded. Please try again in a moment.`;
            }
            
            throw new Error(`Failed to sync time tracking: ${errorMessage}`);
          }
          
          results.push({ success: true, id: entry.id });
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing time tracking ${entry.id}:`, error);
          results.push({ success: false, id: entry.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      const allSuccessful = results.every(result => result.success);
      
      // Collect error messages from failed individual syncs
      const failedResults = results.filter((r: any) => !r.success && r.error);
      const errorMessages = failedResults.map((r: any) => r.error).filter(Boolean);
      
      return {
        success: allSuccessful,
        data: results,
        error: errorMessages.length > 0 
          ? errorMessages.join('; ') 
          : (allSuccessful ? undefined : 'One or more mileage entry sync operations failed'),
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Fetch employees from backend
   */
  private static async fetchEmployees(): Promise<Employee[]> {
    try {
      const url = `${this.config.baseUrl}/employees`;
      
      const response = await fetch(url);
      
      // Handle rate limiting specifically
      if (response.status === 429) {
        const errorMessage = 'Rate limit exceeded. The server is receiving too many requests. Please wait a moment and try again.';
        console.error(`❌ ApiSync: Failed to fetch employees: HTTP 429 (Rate Limited)`);
        throw new Error(errorMessage);
      }
      
      if (!response.ok) {
        // Try to get error message from response body
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error || errorJson.message || errorText;
            } catch {
              errorMessage = errorText;
            }
          } else if (response.statusText) {
            errorMessage = response.statusText;
          }
        } catch (parseError) {
          // If we can't read the response, use status code
          errorMessage = `HTTP ${response.status}${response.statusText ? ': ' + response.statusText : ''}`;
        }
        
        console.error(`❌ ApiSync: Failed to fetch employees: ${errorMessage}`);
        throw new Error(`Failed to fetch employees: ${errorMessage}`);
      }
      
      const responseText = await response.text();
      const data = JSON.parse(responseText);
      
      return data.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        preferredName: emp.preferredName || '',
        email: emp.email,
        password: emp.password || '',
        oxfordHouseId: emp.oxfordHouseId,
        position: emp.position,
        phoneNumber: emp.phoneNumber,
        baseAddress: emp.baseAddress,
        baseAddress2: emp.baseAddress2 || '',
        costCenters: Array.isArray(emp.costCenters) ? emp.costCenters : (emp.costCenters ? JSON.parse(emp.costCenters) : []),
        selectedCostCenters: Array.isArray(emp.selectedCostCenters) ? emp.selectedCostCenters : (emp.selectedCostCenters ? JSON.parse(emp.selectedCostCenters) : []),
        defaultCostCenter: emp.defaultCostCenter || '',
        createdAt: new Date(emp.createdAt),
        updatedAt: new Date(emp.updatedAt)
      }));
    } catch (error) {
      console.error('❌ ApiSync: Error in fetchEmployees:', error);
      throw error;
    }
  }

  /**
   * Fetch single employee from backend
   */
  private static async fetchEmployee(id: string): Promise<Employee | null> {
    try {
      const response = await fetch(`${this.config.baseUrl}/employees/${id}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch employee: ${response.statusText}`);
      }
      
      const emp = await response.json();
      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        password: emp.password || '',
        oxfordHouseId: emp.oxfordHouseId,
        position: emp.position,
        phoneNumber: emp.phoneNumber,
        baseAddress: emp.baseAddress,
        baseAddress2: emp.baseAddress2 || '',
        costCenters: Array.isArray(emp.costCenters) ? emp.costCenters : (emp.costCenters ? JSON.parse(emp.costCenters) : []),
        selectedCostCenters: Array.isArray(emp.selectedCostCenters) ? emp.selectedCostCenters : (emp.selectedCostCenters ? JSON.parse(emp.selectedCostCenters) : []),
        defaultCostCenter: emp.defaultCostCenter || '',
        createdAt: new Date(emp.createdAt),
        updatedAt: new Date(emp.updatedAt)
      };
    } catch (error) {
      console.error('❌ ApiSync: Error fetching employee:', error);
      return null;
    }
  }

  /**
   * Fetch mileage entries from backend
   */
  private static async fetchMileageEntries(employeeId?: string): Promise<MileageEntry[]> {
    try {
      const url = employeeId 
        ? `${this.config.baseUrl}/mileage-entries?employeeId=${employeeId}`
        : `${this.config.baseUrl}/mileage-entries`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch mileage entries: ${response.statusText}`);
      }
      
      const responseText = await response.text();
      const data = JSON.parse(responseText);
      
      return data.map((entry: any) => ({
        id: entry.id,
        employeeId: entry.employeeId,
        oxfordHouseId: entry.oxfordHouseId,
        date: this.parseDateSafe(entry.date),
        odometerReading: entry.odometerReading,
        startLocation: entry.startLocation,
        endLocation: entry.endLocation,
        purpose: entry.purpose,
        miles: entry.miles,
        notes: entry.notes,
        hoursWorked: entry.hoursWorked || 0,
        isGpsTracked: Boolean(entry.isGpsTracked),
        costCenter: entry.costCenter || '',
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt)
      }));
    } catch (error) {
      console.error('❌ ApiSync: Error in fetchMileageEntries:', error);
      throw error; // Re-throw so caller knows it failed
    }
  }

  /**
   * Fetch receipts from backend
   */
  private static async fetchReceipts(employeeId?: string): Promise<Receipt[]> {
    const url = employeeId 
      ? `${this.config.baseUrl}/receipts?employeeId=${employeeId}`
      : `${this.config.baseUrl}/receipts`;
      
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch receipts: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((receipt: any) => ({
      id: receipt.id,
      employeeId: receipt.employeeId,
      date: new Date(receipt.date),
      amount: receipt.amount,
      vendor: receipt.vendor,
      description: receipt.description,
      category: receipt.category,
      imageUri: receipt.imageUri || '',
      createdAt: new Date(receipt.createdAt),
      updatedAt: new Date(receipt.updatedAt)
    }));
  }

  /**
   * Fetch time tracking from backend
   */
  private static async fetchTimeTracking(employeeId?: string): Promise<TimeTracking[]> {
    const url = employeeId 
      ? `${this.config.baseUrl}/time-tracking?employeeId=${employeeId}`
      : `${this.config.baseUrl}/time-tracking`;
      
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch time tracking: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((entry: any) => ({
      id: entry.id,
      employeeId: entry.employeeId,
      date: this.parseDateSafe(entry.date),
      category: entry.category,
      hours: entry.hours,
      description: entry.description,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt)
    }));
  }

  /**
   * Fetch daily descriptions from backend
   */
  private static async fetchDailyDescriptions(employeeId?: string): Promise<DailyDescription[]> {
    const url = employeeId 
      ? `${this.config.baseUrl}/daily-descriptions?employeeId=${employeeId}`
      : `${this.config.baseUrl}/daily-descriptions`;
      
    const response = await fetch(url);
    if (!response.ok) {
      // Try to get more detailed error message
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorText = await response.text();
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              errorMessage = errorJson.error;
            }
          } catch {
            // If not JSON, use the text as-is
            if (errorText.length < 200) {
              errorMessage = errorText;
            }
          }
        }
      } catch {
        // Use default error message if we can't read the response
      }
      throw new Error(`Failed to fetch daily descriptions: ${errorMessage}`);
    }
    
    const data = await response.json();
    return data.map((desc: any) => ({
      id: desc.id,
      employeeId: desc.employeeId,
      date: this.parseDateSafe(desc.date),
      description: desc.description,
      costCenter: desc.costCenter,
      stayedOvernight: desc.stayedOvernight === 1 || desc.stayedOvernight === true,
      dayOff: desc.dayOff === 1 || desc.dayOff === true,
      dayOffType: desc.dayOffType || undefined,
      createdAt: new Date(desc.createdAt),
      updatedAt: new Date(desc.updatedAt)
    }));
  }

  /**
   * Fetch Per Diem rules from backend
   */
  private static async fetchPerDiemRules(): Promise<any[]> {
    const response = await fetch(`${this.config.baseUrl}/per-diem-rules`);
    if (!response.ok) {
      throw new Error(`Failed to fetch per diem rules: ${response.statusText}`);
    }
    
    const data = await response.json();
    debugLog(`📋 ApiSync: Fetched ${data.length} Per Diem rules from backend`);
    return data.map((rule: any) => ({
      id: rule.id,
      costCenter: rule.costCenter,
      maxAmount: rule.maxAmount,
      minHours: rule.minHours,
      minMiles: rule.minMiles,
      minDistanceFromBase: rule.minDistanceFromBase,
      description: rule.description,
      useActualAmount: Boolean(rule.useActualAmount),
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    }));
  }

  /**
   * Sync Per Diem rules from backend to local database
   */
  private static async syncPerDiemRulesToLocal(perDiemRules: any[]): Promise<void> {
    try {
      debugLog(`📥 ApiSync: Syncing ${perDiemRules.length} Per Diem rules to local database...`);
      
      const { getDatabaseConnection } = await import('../utils/databaseConnection');
      const database = await getDatabaseConnection();

      // Clear existing rules
      await database.runAsync('DELETE FROM per_diem_rules');

      // Insert new rules
      for (const rule of perDiemRules) {
        await database.runAsync(
          `INSERT INTO per_diem_rules (
            id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase,
            description, useActualAmount, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rule.id,
            rule.costCenter,
            rule.maxAmount,
            rule.minHours,
            rule.minMiles,
            rule.minDistanceFromBase,
            rule.description,
            rule.useActualAmount ? 1 : 0,
            rule.createdAt,
            rule.updatedAt
          ]
        );
      }

      debugLog(`✅ ApiSync: Stored ${perDiemRules.length} Per Diem rules locally`);
    } catch (error) {
      console.error('❌ ApiSync: Error syncing Per Diem rules to local database:', error);
    }
  }

  /**
   * Sync daily descriptions from backend to local database
   */
  private static async syncDailyDescriptionsToLocal(dailyDescriptions: DailyDescription[]): Promise<void> {
    try {
      debugLog(`📥 ApiSync: Syncing ${dailyDescriptions.length} daily descriptions to local database...`);
      
      const { getDatabaseConnection } = await import('../utils/databaseConnection');
      const database = await getDatabaseConnection();
      
      // Helper function to clean odometer readings from description
      const cleanOdometerReadings = (text: string): string => {
        if (!text) return text;
        // Remove patterns like "Odometer: 123456" or "Odometer: 123456 to Odometer: 123789"
        return text
          .replace(/Odometer:\s*\d+/gi, '')
          .replace(/\s+to\s+Odometer:\s*\d+/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      for (const desc of dailyDescriptions) {
        try {
          if (!desc.id) {
            console.warn(`⚠️ ApiSync: Skipping daily description without ID`);
            continue;
          }
          
          // Check if description with this ID already exists
          const existing = await database.getFirstAsync(
            'SELECT id, updatedAt FROM daily_descriptions WHERE id = ?',
            [desc.id]
          );
          
          // Convert date to YYYY-MM-DD format only (timezone-safe)
          const descDate = desc.date instanceof Date ? desc.date : new Date(desc.date);
          const dateOnly = `${descDate.getFullYear()}-${String(descDate.getMonth() + 1).padStart(2, '0')}-${String(descDate.getDate()).padStart(2, '0')}`;
          
          // Clean odometer readings from description
          const cleanedDescription = cleanOdometerReadings(desc.description || '');
          
          // Get entry's updatedAt timestamp for comparison
          const descUpdatedAt = desc.updatedAt instanceof Date ? desc.updatedAt.toISOString() : (desc.updatedAt || new Date().toISOString());
          const existingUpdatedAt = existing?.updatedAt ? (existing.updatedAt instanceof Date ? existing.updatedAt.toISOString() : existing.updatedAt) : null;
          
          // If description exists, update it; otherwise create it
          if (existing) {
            // Update existing description to ensure it matches backend
            await database.runAsync(
              `UPDATE daily_descriptions SET
                employeeId = ?, date = ?, description = ?, costCenter = ?, stayedOvernight = ?, dayOff = ?, dayOffType = ?, updatedAt = ?
              WHERE id = ?`,
              [
                desc.employeeId,
                dateOnly,
                cleanedDescription,
                desc.costCenter || '',
                desc.stayedOvernight ? 1 : 0,
                desc.dayOff ? 1 : 0,
                desc.dayOffType || null,
                descUpdatedAt,
                desc.id
              ]
            );
            debugLog(`🔄 ApiSync: Updated existing daily description ${desc.id}`);
          } else {
            // Insert new description with the SAME ID from backend to avoid duplicates
            await database.runAsync(
              `INSERT INTO daily_descriptions (
                id, employeeId, date, description, costCenter, stayedOvernight, dayOff, dayOffType, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                desc.id, // Preserve backend ID
                desc.employeeId,
                dateOnly,
                cleanedDescription,
                desc.costCenter || '',
                desc.stayedOvernight ? 1 : 0,
                desc.dayOff ? 1 : 0,
                desc.dayOffType || null,
                desc.createdAt instanceof Date ? desc.createdAt.toISOString() : (desc.createdAt || new Date().toISOString()),
                descUpdatedAt
              ]
            );
            debugLog(`➕ ApiSync: Created new daily description ${desc.id}`);
          }
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing daily description ${desc.id}:`, error);
        }
      }
      
      debugLog(`✅ ApiSync: Daily descriptions sync completed`);
    } catch (error) {
      console.error('❌ ApiSync: Error syncing daily descriptions to local database:', error);
    }
  }

  /**
   * Sync mileage entries from backend to local database
   */
  private static async syncMileageEntriesToLocal(mileageEntries: MileageEntry[]): Promise<void> {
    try {
      debugLog(`📥 ApiSync: Syncing ${mileageEntries.length} mileage entries to local database...`);
      
      const { getDatabaseConnection } = await import('../utils/databaseConnection');
      const database = await getDatabaseConnection();
      
      for (const entry of mileageEntries) {
        try {
          if (!entry.id) {
            console.warn(`⚠️ ApiSync: Skipping mileage entry without ID`);
            continue;
          }
          
          // Check if entry with this ID already exists
          const existing = await database.getFirstAsync(
            'SELECT id, updatedAt FROM mileage_entries WHERE id = ?',
            [entry.id]
          );
          
          // Convert date to YYYY-MM-DD format only (timezone-safe)
          const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
          const dateOnly = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
          
          // Get entry's updatedAt timestamp for comparison
          const entryUpdatedAt = entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : (entry.updatedAt || new Date().toISOString());
          const existingUpdatedAt = existing?.updatedAt ? (existing.updatedAt instanceof Date ? existing.updatedAt.toISOString() : existing.updatedAt) : null;
          
          // If entry exists and backend version is newer or same, update it
          // If entry doesn't exist, create it
          if (existing) {
            // Update existing entry to ensure it matches backend
            await database.runAsync(
              `UPDATE mileage_entries SET
                employeeId = ?, oxfordHouseId = ?, costCenter = ?, date = ?, odometerReading = ?,
                startLocation = ?, endLocation = ?, purpose = ?, miles = ?, notes = ?, hoursWorked = ?,
                isGpsTracked = ?, updatedAt = ?
              WHERE id = ?`,
              [
                entry.employeeId,
                entry.oxfordHouseId,
                entry.costCenter || '',
                dateOnly,
                entry.odometerReading,
                entry.startLocation,
                entry.endLocation,
                entry.purpose,
                entry.miles,
                entry.notes || '',
                entry.hoursWorked || 0,
                entry.isGpsTracked ? 1 : 0,
                entryUpdatedAt,
                entry.id
              ]
            );
            debugLog(`🔄 ApiSync: Updated existing mileage entry ${entry.id}`);
          } else {
            // Insert new entry with the SAME ID from backend to avoid duplicates
            await database.runAsync(
              `INSERT INTO mileage_entries (
                id, employeeId, oxfordHouseId, costCenter, date, odometerReading,
                startLocation, endLocation, purpose, miles, notes, hoursWorked,
                isGpsTracked, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                entry.id, // Preserve backend ID
                entry.employeeId,
                entry.oxfordHouseId,
                entry.costCenter || '',
                dateOnly, // Store as YYYY-MM-DD only
                entry.odometerReading,
                entry.startLocation,
                entry.endLocation,
                entry.purpose,
                entry.miles,
                entry.notes || '',
                entry.hoursWorked || 0,
                entry.isGpsTracked ? 1 : 0,
                entry.createdAt instanceof Date ? entry.createdAt.toISOString() : (entry.createdAt || new Date().toISOString()),
                entryUpdatedAt
              ]
            );
            debugLog(`➕ ApiSync: Created new mileage entry ${entry.id}`);
          }
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing entry ${entry.id}:`, error);
        }
      }
      
      debugLog(`✅ ApiSync: Mileage entries sync completed`);
    } catch (error) {
      console.error('❌ ApiSync: Error syncing mileage entries to local database:', error);
    }
  }

  /**
   * Sync receipts from backend to local database
   */
  private static async syncReceiptsToLocal(receipts: Receipt[]): Promise<void> {
    try {
      debugLog(`📥 ApiSync: Syncing ${receipts.length} receipts to local database...`);
      
      const { getDatabaseConnection } = await import('../utils/databaseConnection');
      const database = await getDatabaseConnection();
      
      for (const receipt of receipts) {
        try {
          if (!receipt.id) {
            console.warn(`⚠️ ApiSync: Skipping receipt without ID`);
            continue;
          }
          
          // Check if receipt with this ID already exists
          const existing = await database.getFirstAsync(
            'SELECT id, updatedAt FROM receipts WHERE id = ?',
            [receipt.id]
          );
          
          // Convert date to YYYY-MM-DD format only (timezone-safe)
          const receiptDate = receipt.date instanceof Date ? receipt.date : new Date(receipt.date);
          const dateOnly = `${receiptDate.getFullYear()}-${String(receiptDate.getMonth() + 1).padStart(2, '0')}-${String(receiptDate.getDate()).padStart(2, '0')}`;
          
          // Get receipt's updatedAt timestamp for comparison
          const receiptUpdatedAt = receipt.updatedAt instanceof Date ? receipt.updatedAt.toISOString() : (receipt.updatedAt || new Date().toISOString());
          const existingUpdatedAt = existing?.updatedAt ? (existing.updatedAt instanceof Date ? existing.updatedAt.toISOString() : existing.updatedAt) : null;
          
          // If receipt exists, update it; otherwise create it
          if (existing) {
            // Update existing receipt to ensure it matches backend
            await database.runAsync(
              `UPDATE receipts SET
                employeeId = ?, date = ?, amount = ?, vendor = ?, description = ?, 
                category = ?, imageUri = ?, costCenter = ?, updatedAt = ?
              WHERE id = ?`,
              [
                receipt.employeeId,
                dateOnly,
                receipt.amount,
                receipt.vendor || '',
                receipt.description || '',
                receipt.category || '',
                receipt.imageUri || '',
                receipt.costCenter || '',
                receiptUpdatedAt,
                receipt.id
              ]
            );
            debugLog(`🔄 ApiSync: Updated existing receipt ${receipt.id}`);
          } else {
            // Insert new receipt with the SAME ID from backend to avoid duplicates
            await database.runAsync(
              `INSERT INTO receipts (
                id, employeeId, date, amount, vendor, description, category, imageUri, costCenter, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                receipt.id, // Preserve backend ID
                receipt.employeeId,
                dateOnly,
                receipt.amount,
                receipt.vendor || '',
                receipt.description || '',
                receipt.category || '',
                receipt.imageUri || '',
                receipt.costCenter || '',
                receipt.createdAt instanceof Date ? receipt.createdAt.toISOString() : (receipt.createdAt || new Date().toISOString()),
                receiptUpdatedAt
              ]
            );
            debugLog(`➕ ApiSync: Created new receipt ${receipt.id}`);
          }
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing receipt ${receipt.id}:`, error);
        }
      }
      
      debugLog(`✅ ApiSync: Receipts sync completed`);
    } catch (error) {
      console.error('❌ ApiSync: Error syncing receipts to local database:', error);
    }
  }

  /**
   * Sync time tracking from backend to local database
   */
  private static async syncTimeTrackingToLocal(timeTracking: TimeTracking[]): Promise<void> {
    try {
      debugLog(`📥 ApiSync: Syncing ${timeTracking.length} time tracking entries to local database...`);
      
      const { getDatabaseConnection } = await import('../utils/databaseConnection');
      const database = await getDatabaseConnection();
      
      for (const tracking of timeTracking) {
        try {
          if (!tracking.id) {
            console.warn(`⚠️ ApiSync: Skipping time tracking entry without ID`);
            continue;
          }
          
          // Check if entry with this ID already exists
          const existing = await database.getFirstAsync(
            'SELECT id, updatedAt FROM time_tracking WHERE id = ?',
            [tracking.id]
          );
          
          // Convert date to YYYY-MM-DD format only (timezone-safe)
          const trackingDate = tracking.date instanceof Date ? tracking.date : new Date(tracking.date);
          const dateOnly = `${trackingDate.getFullYear()}-${String(trackingDate.getMonth() + 1).padStart(2, '0')}-${String(trackingDate.getDate()).padStart(2, '0')}`;
          
          // Get entry's updatedAt timestamp for comparison
          const trackingUpdatedAt = tracking.updatedAt instanceof Date ? tracking.updatedAt.toISOString() : (tracking.updatedAt || new Date().toISOString());
          const existingUpdatedAt = existing?.updatedAt ? (existing.updatedAt instanceof Date ? existing.updatedAt.toISOString() : existing.updatedAt) : null;
          
          // If entry exists, update it; otherwise create it
          if (existing) {
            // Update existing entry to ensure it matches backend
            await database.runAsync(
              `UPDATE time_tracking SET
                employeeId = ?, date = ?, category = ?, hours = ?, description = ?, costCenter = ?, updatedAt = ?
              WHERE id = ?`,
              [
                tracking.employeeId,
                dateOnly,
                tracking.category || '',
                tracking.hours,
                tracking.description || '',
                tracking.costCenter || '',
                trackingUpdatedAt,
                tracking.id
              ]
            );
            debugLog(`🔄 ApiSync: Updated existing time tracking entry ${tracking.id}`);
          } else {
            // Insert new entry with the SAME ID from backend to avoid duplicates
            await database.runAsync(
              `INSERT INTO time_tracking (
                id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                tracking.id, // Preserve backend ID
                tracking.employeeId,
                dateOnly,
                tracking.category || '',
                tracking.hours,
                tracking.description || '',
                tracking.costCenter || '',
                tracking.createdAt instanceof Date ? tracking.createdAt.toISOString() : (tracking.createdAt || new Date().toISOString()),
                trackingUpdatedAt
              ]
            );
            debugLog(`➕ ApiSync: Created new time tracking entry ${tracking.id}`);
          }
        } catch (error) {
          console.error(`❌ ApiSync: Error syncing time tracking entry ${tracking.id}:`, error);
        }
      }
      
      debugLog(`✅ ApiSync: Time tracking sync completed`);
    } catch (error) {
      console.error('❌ ApiSync: Error syncing time tracking to local database:', error);
    }
  }

  /**
   * Sync mileage entries from backend for a specific employee
   */
  static async syncMileageEntriesFromBackend(employeeId: string): Promise<SyncResult> {
    try {
      debugLog(`📥 ApiSync: Syncing mileage entries for employee ${employeeId}...`);
      const backendEmployeeId = await this.resolveBackendEmployeeId(employeeId);
      const effectiveEmployeeId = backendEmployeeId || employeeId;
      
      const mileageEntries = await this.fetchMileageEntries(effectiveEmployeeId);
      const mappedMileageEntries = this.mapEmployeeIdForLocal(
        mileageEntries,
        employeeId,
        backendEmployeeId
      );
      
      if (mappedMileageEntries.length > 0) {
        await this.syncMileageEntriesToLocal(mappedMileageEntries);
      }
      
      debugLog(`✅ ApiSync: Mileage entries sync completed for employee ${employeeId}: ${mappedMileageEntries.length} entries`);
      
      return {
        success: true,
        data: { mileageEntries: mappedMileageEntries },
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ ApiSync: Error syncing mileage entries for employee ${employeeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync receipts from backend for a specific employee
   */
  static async syncReceiptsFromBackend(employeeId: string): Promise<SyncResult> {
    try {
      debugLog(`📥 ApiSync: Syncing receipts for employee ${employeeId}...`);
      const backendEmployeeId = await this.resolveBackendEmployeeId(employeeId);
      const effectiveEmployeeId = backendEmployeeId || employeeId;
      
      const receipts = await this.fetchReceipts(effectiveEmployeeId);
      const mappedReceipts = this.mapEmployeeIdForLocal(
        receipts,
        employeeId,
        backendEmployeeId
      );
      
      if (mappedReceipts.length > 0) {
        await this.syncReceiptsToLocal(mappedReceipts);
      }
      
      debugLog(`✅ ApiSync: Receipts sync completed for employee ${employeeId}: ${mappedReceipts.length} receipts`);
      
      return {
        success: true,
        data: { receipts: mappedReceipts },
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ ApiSync: Error syncing receipts for employee ${employeeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync time tracking from backend for a specific employee
   */
  static async syncTimeTrackingFromBackend(employeeId: string): Promise<SyncResult> {
    try {
      debugLog(`📥 ApiSync: Syncing time tracking for employee ${employeeId}...`);
      const backendEmployeeId = await this.resolveBackendEmployeeId(employeeId);
      const effectiveEmployeeId = backendEmployeeId || employeeId;
      
      const timeTracking = await this.fetchTimeTracking(effectiveEmployeeId);
      const mappedTimeTracking = this.mapEmployeeIdForLocal(
        timeTracking,
        employeeId,
        backendEmployeeId
      );
      
      // Safety check: if there are too many entries, something might be wrong
      if (mappedTimeTracking.length > 1000) {
        debugWarn(`⚠️ ApiSync: Too many time tracking entries (${mappedTimeTracking.length}), skipping sync to prevent issues`);
        return {
          success: false,
          error: `Too many time tracking entries (${mappedTimeTracking.length}), skipping sync`,
          timestamp: new Date()
        };
      }
      
      if (mappedTimeTracking.length > 0) {
        await this.syncTimeTrackingToLocal(mappedTimeTracking);
      }
      
      debugLog(`✅ ApiSync: Time tracking sync completed for employee ${employeeId}: ${mappedTimeTracking.length} entries`);
      
      return {
        success: true,
        data: { timeTracking: mappedTimeTracking },
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ ApiSync: Error syncing time tracking for employee ${employeeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync daily descriptions from backend for a specific employee
   */
  static async syncDailyDescriptionsFromBackend(employeeId: string): Promise<SyncResult> {
    try {
      debugLog(`📥 ApiSync: Syncing daily descriptions for employee ${employeeId}...`);
      const backendEmployeeId = await this.resolveBackendEmployeeId(employeeId);
      const effectiveEmployeeId = backendEmployeeId || employeeId;
      
      const dailyDescriptions = await this.fetchDailyDescriptions(effectiveEmployeeId);
      const mappedDailyDescriptions = this.mapEmployeeIdForLocal(
        dailyDescriptions,
        employeeId,
        backendEmployeeId
      );
      
      if (mappedDailyDescriptions.length > 0) {
        await this.syncDailyDescriptionsToLocal(mappedDailyDescriptions);
      }
      
      debugLog(`✅ ApiSync: Daily descriptions sync completed for employee ${employeeId}: ${mappedDailyDescriptions.length} descriptions`);
      
      return {
        success: true,
        data: { dailyDescriptions: mappedDailyDescriptions },
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ ApiSync: Error syncing daily descriptions for employee ${employeeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync all data from backend for a specific employee
   */
  static async syncAllDataFromBackend(employeeId: string): Promise<SyncResult> {
    try {
      debugLog(`📥 ApiSync: Syncing all data for employee ${employeeId}...`);
      
      const results = await Promise.all([
        this.syncMileageEntriesFromBackend(employeeId),
        this.syncReceiptsFromBackend(employeeId),
        this.syncTimeTrackingFromBackend(employeeId),
        this.syncDailyDescriptionsFromBackend(employeeId)
      ]);
      
      const allSuccessful = results.every(result => result.success);
      
      if (allSuccessful) {
        debugLog(`✅ ApiSync: All data sync completed successfully for employee ${employeeId}`);
      } else {
        console.error(`❌ ApiSync: Some data sync operations failed for employee ${employeeId}`);
      }
      
      return {
        success: allSuccessful,
        data: results,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ ApiSync: Error syncing all data for employee ${employeeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get sync status
   */
  static async getSyncStatus(): Promise<SyncStatus> {
    try {
      const isConnected = await this.testConnection();
      
      // Get stats from backend if connected
      let stats = {
        totalEmployees: 0,
        totalMileageEntries: 0,
        totalReceipts: 0,
        totalTimeTracking: 0
      };
      
      if (isConnected) {
        try {
          const response = await fetch(`${this.config.baseUrl}/stats`);
          if (response.ok) {
            stats = await response.json();
          }
        } catch (error) {
          console.error('❌ ApiSync: Error fetching stats:', error);
        }
      }
      
      return {
        isConnected,
        lastSyncTime: this.lastSyncTime,
        totalEmployees: stats.totalEmployees,
        totalMileageEntries: stats.totalMileageEntries,
        totalReceipts: stats.totalReceipts,
        totalTimeTracking: stats.totalTimeTracking,
        pendingChanges: this.pendingChanges
      };
      
    } catch (error) {
      console.error('❌ ApiSync: Error getting sync status:', error);
      return {
        isConnected: false,
        lastSyncTime: this.lastSyncTime,
        totalEmployees: 0,
        totalMileageEntries: 0,
        totalReceipts: 0,
        totalTimeTracking: 0,
        pendingChanges: this.pendingChanges
      };
    }
  }

  /**
   * Increment pending changes counter
   */
  static incrementPendingChanges(): void {
    this.pendingChanges++;
  }

  /**
   * Reset pending changes counter
   */
  static resetPendingChanges(): void {
    this.pendingChanges = 0;
  }

  /**
   * Save last sync time to local storage
   */
  private static async saveLastSyncTime(time: Date): Promise<void> {
    try {
      // In React Native, you would use AsyncStorage
      // For now, we'll just store it in memory
      debugLog('💾 ApiSync: Last sync time saved:', time.toISOString());
    } catch (error) {
      console.error('❌ ApiSync: Error saving last sync time:', error);
    }
  }

  /**
   * Get last sync time from local storage
   */
  private static async getLastSyncTime(): Promise<Date | null> {
    try {
      // In React Native, you would use AsyncStorage
      // For now, we'll just return the in-memory value
      return this.lastSyncTime;
    } catch (error) {
      console.error('❌ ApiSync: Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Update API configuration
   */
  static updateConfig(newConfig: Partial<ApiSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    debugLog('🔄 ApiSync: Configuration updated:', this.config);
  }
}

import { AppState, AppStateStatus } from 'react-native';
import { DatabaseService } from './database';
import { ApiSyncService } from './apiSyncService';
import { debugLog, debugError, debugWarn } from '../config/debug';
import { Employee, MileageEntry, Receipt, TimeTracking } from '../types';

export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking' | 'dailyDescription' | 'dailyOdometerReading';
  data: any;
  timestamp: Date;
  retryCount: number;
}

export class SyncIntegrationService {
  private static syncQueue: SyncQueueItem[] = [];
  private static isProcessingQueue = false;
  private static autoSyncEnabled = true; // Event-driven sync on change
  private static syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static appStateListener: { remove: () => void } | null = null;
  private static lastAppState: AppStateStatus = 'active';
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly SYNC_DEBOUNCE_MS = 15000; // Debounce local changes before syncing

  /**
   * Initialize the sync integration service
   */
  static async initialize(): Promise<void> {
    try {
      debugLog('🔄 SyncIntegration: Initializing sync integration service...');
      
      // Register callback with DatabaseService
      const { setSyncCallback } = await import('./database');
      setSyncCallback((operation, entityType, data) => {
        this.queueSyncOperation(operation as any, entityType as any, data);
      });
      debugLog('✅ SyncIntegration: Callback registered with DatabaseService');
      
      // Initialize API sync service
      await ApiSyncService.initialize();
      
      // Start event-driven auto-sync
      if (this.autoSyncEnabled) {
        this.startAutoSync();
        debugLog('✅ SyncIntegration: Event-driven auto-sync enabled');
      }
      
      // Listen for app foreground to sync remote changes
      this.startAppStateListener();
      
      debugLog('✅ SyncIntegration: Sync integration service initialized');
    } catch (error) {
      console.error('❌ SyncIntegration: Failed to initialize:', error);
    }
  }

  /**
   * Enable or disable auto-sync
   */
  static setAutoSyncEnabled(enabled: boolean): void {
    this.autoSyncEnabled = enabled;
    
    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    
    debugLog(`🔄 SyncIntegration: Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Start auto-sync timer
   */
  private static startAutoSync(): void {
    debugLog('🔄 SyncIntegration: Auto-sync set to event-driven mode');
  }

  /**
   * Stop auto-sync timer
   */
  private static stopAutoSync(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
    
    debugLog('🔄 SyncIntegration: Auto-sync disabled');
  }

  /**
   * Remove items from sync queue by entity ID
   */
  static removeFromQueue(entityType: string, entityId: string): void {
    const beforeLength = this.syncQueue.length;
    this.syncQueue = this.syncQueue.filter(
      item => !(item.entityType === entityType && item.data.id === entityId)
    );
    const afterLength = this.syncQueue.length;
    
    if (beforeLength > afterLength) {
      debugLog(`🗑️ SyncIntegration: Removed ${beforeLength - afterLength} ${entityType} items from queue for ID: ${entityId}`);
    }
  }

  /**
   * Queue a sync operation
   */
  static queueSyncOperation(
    operation: 'create' | 'update' | 'delete',
    entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking' | 'dailyDescription' | 'dailyOdometerReading',
    data: any
  ): void {
    // Validate data before queuing
    if (!data || !data.id) {
      console.error(`❌ SyncIntegration: Invalid data for ${entityType} operation:`, data);
      return;
    }
    
    const queueItem: SyncQueueItem = {
      id: `${entityType}_${data.id}_${Date.now()}`,
      operation,
      entityType,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    // Check if this exact operation is already queued (prevent duplicates)
    // Only check for duplicates within the last 10 seconds to allow legitimate updates
    const recentDuplicates = this.syncQueue.filter(item => 
      item.entityType === entityType && 
      item.operation === operation &&
      item.data.id === data.id &&
      (new Date().getTime() - item.timestamp.getTime()) < 10000 // Within last 10 seconds
    );
    
    if (recentDuplicates.length > 0) {
      debugLog(`⚠️ SyncIntegration: Duplicate ${operation} for ${entityType} ${data.id} already queued recently, skipping`);
      return;
    }
    
    this.syncQueue.push(queueItem);
    debugLog(`🔄 SyncIntegration: Queued ${operation} operation for ${entityType}:`, data.id);
    
    if (this.autoSyncEnabled) {
      this.scheduleDebouncedSync();
    }
  }

  /**
   * Schedule a debounced sync for local changes.
   */
  private static scheduleDebouncedSync(): void {
    if (!this.autoSyncEnabled) {
      return;
    }
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.processSyncQueue();
    }, this.SYNC_DEBOUNCE_MS);
  }

  /**
   * Start listening for app foreground events to sync remote changes.
   */
  private static startAppStateListener(): void {
    if (this.appStateListener) {
      return;
    }
    this.appStateListener = AppState.addEventListener('change', (nextState) => {
      this.handleAppStateChange(nextState);
    });
  }

  private static async handleAppStateChange(nextState: AppStateStatus): Promise<void> {
    if (this.lastAppState !== 'active' && nextState === 'active') {
      await this.syncOnAppActive();
    }
    this.lastAppState = nextState;
  }

  private static lastSyncOnActiveTime = 0;
  private static readonly MIN_SYNC_INTERVAL_MS = 30000; // Minimum 30 seconds between syncs on app active

  private static async syncOnAppActive(): Promise<void> {
    try {
      const now = Date.now();
      // Prevent too frequent syncing - only sync if at least 30 seconds have passed
      if (now - this.lastSyncOnActiveTime < this.MIN_SYNC_INTERVAL_MS) {
        debugLog(`🔄 SyncIntegration: Skipping sync on app active (only ${Math.round((now - this.lastSyncOnActiveTime) / 1000)}s since last sync)`);
        return;
      }
      
      const currentEmployee = await DatabaseService.getCurrentEmployee();
      if (!currentEmployee?.id) {
        return;
      }
      
      this.lastSyncOnActiveTime = now;
      debugLog('🔄 SyncIntegration: App foregrounded (push then pull)');
      await this.processSyncQueue();
      await ApiSyncService.syncFromBackend(currentEmployee.id);
    } catch (error) {
      debugWarn('⚠️ SyncIntegration: Error syncing on app foreground:', error);
    }
  }

  /**
   * Process the sync queue
   */
  static async processSyncQueue(): Promise<void> {
    if (this.isProcessingQueue || this.syncQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    debugLog(`🔄 SyncIntegration: Processing sync queue (${this.syncQueue.length} items)`);
    
    try {
      // Test connection first
      const isConnected = await ApiSyncService.testConnection();
      if (!isConnected) {
        debugLog('🔄 SyncIntegration: No connection, skipping sync queue processing');
        this.isProcessingQueue = false; // Reset flag before returning
        return;
      }
      
      // Group operations by entity type for batch processing
      const groupedOperations = this.groupOperationsByType();
      
      // Process each group
      for (const [entityType, operations] of Object.entries(groupedOperations)) {
        await this.processEntityGroup(entityType as any, operations);
      }
      
      // Remove successfully processed items
      this.syncQueue = this.syncQueue.filter(item => 
        !groupedOperations[item.entityType]?.includes(item)
      );
      
      debugLog(`✅ SyncIntegration: Processed sync queue, ${this.syncQueue.length} items remaining`);
      
    } catch (error) {
      console.error('❌ SyncIntegration: Error processing sync queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Group operations by entity type
   */
  private static groupOperationsByType(): Record<string, SyncQueueItem[]> {
    const grouped: Record<string, SyncQueueItem[]> = {};
    
    for (const item of this.syncQueue) {
      if (!grouped[item.entityType]) {
        grouped[item.entityType] = [];
      }
      grouped[item.entityType].push(item);
    }
    
    return grouped;
  }

  /**
   * Process a group of operations for a specific entity type
   */
  private static async processEntityGroup(
    entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking' | 'dailyDescription' | 'dailyOdometerReading',
    operations: SyncQueueItem[]
  ): Promise<void> {
    try {
      // Separate create/update operations from delete operations
      const createUpdateOps = operations.filter(op => op.operation !== 'delete');
      const deleteOps = operations.filter(op => op.operation === 'delete');
      
      // Process create/update operations
      if (createUpdateOps.length > 0) {
        await this.processCreateUpdateOperations(entityType, createUpdateOps);
      }
      
      // Process delete operations
      if (deleteOps.length > 0) {
        await this.processDeleteOperations(entityType, deleteOps);
      }
      
    } catch (error) {
      console.error(`❌ SyncIntegration: Error processing ${entityType} group:`, error);
      console.error(`❌ SyncIntegration: Error details:`, {
        entityType,
        operationCount: operations.length,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      
      // Increment retry count for failed operations
      operations.forEach(op => {
        op.retryCount++;
        if (op.retryCount >= this.MAX_RETRY_ATTEMPTS) {
          console.error(`❌ SyncIntegration: Max retries exceeded for operation:`, op.id);
          // Remove from queue after max retries
          const index = this.syncQueue.indexOf(op);
          if (index > -1) {
            this.syncQueue.splice(index, 1);
          }
        }
      });
    }
  }

  /**
   * Process create/update operations
   */
  private static async processCreateUpdateOperations(
    entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking' | 'dailyDescription' | 'dailyOdometerReading',
    operations: SyncQueueItem[]
  ): Promise<void> {
    const entities = operations.map(op => op.data);
    
    const syncData: any = {};
    // Normalize entityType (queue may have 'mileageentry' from legacy mapping)
    const normalizedType = entityType === 'mileageentry' ? 'mileageEntry' : entityType;
    const key = normalizedType === 'mileageEntry' ? 'mileageEntries' :
                normalizedType === 'timeTracking' ? 'timeTracking' :
                normalizedType === 'dailyOdometerReading' ? 'dailyOdometerReadings' :
                `${normalizedType}s`;
    syncData[key] = entities;
    
    debugLog(`🔄 SyncIntegration: Processing ${operations.length} ${entityType} operations:`, {
      entityType,
      operationCount: operations.length,
      syncDataKeys: Object.keys(syncData),
      sampleEntity: entities[0]
    });
    
    const result = await ApiSyncService.syncToBackend(syncData);
    
    if (!result.success) {
      console.error(`❌ SyncIntegration: Sync failed for ${entityType}:`, result.error);
      throw new Error(result.error || 'Sync failed');
    }
    
    debugLog(`✅ SyncIntegration: Successfully synced ${operations.length} ${entityType} operations`);
  }

  /**
   * Process delete operations
   */
  private static async processDeleteOperations(
    entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking' | 'dailyDescription' | 'dailyOdometerReading',
    operations: SyncQueueItem[]
  ): Promise<void> {
    // For delete operations, we need to make individual API calls
    // since the backend doesn't have batch delete endpoints
    for (const operation of operations) {
      try {
        const endpoint = this.getDeleteEndpoint(entityType, operation.data.id);
        const response = await fetch(endpoint, { method: 'DELETE' });
        
        if (!response.ok) {
          throw new Error(`Delete failed: ${response.statusText}`);
        }
        
        debugLog(`✅ SyncIntegration: Successfully deleted ${entityType}:`, operation.data.id);
      } catch (error) {
        console.error(`❌ SyncIntegration: Error deleting ${entityType}:`, error);
        throw error;
      }
    }
  }

  /**
   * Get the delete endpoint for an entity type
   */
  private static getDeleteEndpoint(entityType: string, id: string): string {
    // Use API config from config/api.ts to ensure consistency
    const { API_BASE_URL } = require('../config/api');
    const baseUrl = API_BASE_URL;
    
    switch (entityType) {
      case 'employee':
        return `${baseUrl}/employees/${id}`;
      case 'mileageEntry':
        return `${baseUrl}/mileage-entries/${id}`;
      case 'receipt':
        return `${baseUrl}/receipts/${id}`;
      case 'timeTracking':
        return `${baseUrl}/time-tracking/${id}`;
      case 'dailyDescription':
        return `${baseUrl}/daily-descriptions/${id}`;
      case 'dailyOdometerReading':
        return `${baseUrl}/daily-odometer-readings/${id}`;
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Force immediate sync of all pending changes
   * Optionally sync all data for a specific employee
   * Returns object with success status and error message if failed
   */
  static async forceSync(employeeId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      debugLog('🔄 SyncIntegration: Force sync requested', employeeId ? `for employee ${employeeId}` : '');
      
      // Process queue immediately
      await this.processSyncQueue();
      
      // Get current employee if not provided
      let currentEmployeeId = employeeId;
      if (!currentEmployeeId) {
        const currentEmployee = await DatabaseService.getCurrentEmployee();
        if (currentEmployee) {
          currentEmployeeId = currentEmployee.id;
        }
      }
      
      // Always do a full sync for the current employee (syncs all local data)
      if (currentEmployeeId) {
        debugLog(`🔄 SyncIntegration: Performing full sync for employee ${currentEmployeeId}`);
        
        // Get all data for the current employee
        const employees = await DatabaseService.getEmployees();
        const currentEmployee = employees.find(e => e.id === currentEmployeeId);
        
        // Get all mileage entries for current employee
        const mileageEntries = await DatabaseService.getMileageEntries(currentEmployeeId);
        
        // Get all receipts for current employee
        const receipts = await DatabaseService.getReceipts(currentEmployeeId);
        
        // Get all time tracking for current employee
        const allTimeTracking = await DatabaseService.getAllTimeTrackingEntries();
        const timeTracking = allTimeTracking.filter(t => t.employeeId === currentEmployeeId);

      // Get all daily descriptions for current employee
      const dailyDescriptions = await DatabaseService.getDailyDescriptions(currentEmployeeId);
        
        // Sync employee data (just the current employee)
        const employeeData = currentEmployee ? [currentEmployee] : [];
        
        const result = await ApiSyncService.syncToBackend({
          employees: employeeData,
          mileageEntries,
          receipts,
        timeTracking,
        dailyDescriptions
        });
        
        if (result.success) {
          debugLog(`✅ SyncIntegration: Force sync completed successfully for employee ${currentEmployeeId}`);
          return { success: true };
        } else {
          // Check if any data was successfully synced
          const results = result.data || [];
          const successfulSyncs = results.filter((r: any) => r.success);
          const failedSyncs = results.filter((r: any) => !r.success);
          
          // If at least one sync type succeeded, report as success with a warning about partial failures
          if (successfulSyncs.length > 0) {
            const errorMsg = result.error || 'Some sync operations failed';
            debugLog(`⚠️ SyncIntegration: Partial sync success - ${successfulSyncs.length} succeeded, ${failedSyncs.length} failed`);
            
            // Return success but with a warning message about partial failures
            // The error message from syncToBackend already contains details about what failed
            const warningMsg = `Sync completed, but some data types had errors. ${errorMsg}`;
            
            return { 
              success: true, 
              error: warningMsg
            };
          }
          
          // All syncs failed
          const errorMsg = result.error || 'Unknown sync error';
          console.error('❌ SyncIntegration: Force sync failed:', errorMsg);
          return { success: false, error: errorMsg };
        }
      }
      
      // If no employee ID available, just return success (queue was processed)
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred during sync';
      console.error('❌ SyncIntegration: Force sync error:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get sync queue status
   */
  static getSyncQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    autoSyncEnabled: boolean;
    nextSyncIn: number;
  } {
    return {
      queueLength: this.syncQueue.length,
      isProcessing: this.isProcessingQueue,
      autoSyncEnabled: this.autoSyncEnabled,
      nextSyncIn: this.syncDebounceTimer ? this.SYNC_DEBOUNCE_MS : 0
    };
  }

  /**
   * Get IDs of items pending deletion for a specific entity type
   */
  static getPendingDeletionIds(entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking' | 'dailyDescription' | 'dailyOdometerReading'): Set<string> {
    const pendingIds = new Set<string>();
    this.syncQueue.forEach(item => {
      if (item.operation === 'delete' && item.entityType === entityType && item.data?.id) {
        pendingIds.add(item.data.id);
      }
    });
    return pendingIds;
  }

  /**
   * Clear the sync queue
   */
  static clearSyncQueue(): void {
    this.syncQueue = [];
    debugLog('🔄 SyncIntegration: Sync queue cleared');
  }

  /**
   * Refresh Per Diem rules from backend
   */
  static async refreshPerDiemRules(): Promise<void> {
    try {
      debugLog('🔄 SyncIntegration: Manually refreshing Per Diem rules...');
      await ApiSyncService.syncFromBackend();
      debugLog('✅ SyncIntegration: Per Diem rules refreshed successfully');
    } catch (error) {
      console.error('❌ SyncIntegration: Error refreshing Per Diem rules:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  static cleanup(): void {
    this.stopAutoSync();
    this.clearSyncQueue();
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
    debugLog('🔄 SyncIntegration: Cleanup completed');
  }
}

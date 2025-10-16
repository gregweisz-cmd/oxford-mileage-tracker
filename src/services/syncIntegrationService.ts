import { DatabaseService } from './database';
import { ApiSyncService } from './apiSyncService';
import { Employee, MileageEntry, Receipt, TimeTracking } from '../types';

export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking';
  data: any;
  timestamp: Date;
  retryCount: number;
}

export class SyncIntegrationService {
  private static syncQueue: SyncQueueItem[] = [];
  private static isProcessingQueue = false;
  private static autoSyncEnabled = true; // Enable auto-sync for real-time backend updates
  private static syncInterval: NodeJS.Timeout | null = null;
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly SYNC_INTERVAL_MS = 5000; // 5 seconds for faster sync

  /**
   * Initialize the sync integration service
   */
  static async initialize(): Promise<void> {
    try {
      console.log('🔄 SyncIntegration: Initializing sync integration service...');
      
      // Register callback with DatabaseService
      const { setSyncCallback } = await import('./database');
      setSyncCallback((operation, entityType, data) => {
        this.queueSyncOperation(operation as any, entityType as any, data);
      });
      console.log('✅ SyncIntegration: Callback registered with DatabaseService');
      
      // Initialize API sync service
      await ApiSyncService.initialize();
      
      // Start auto-sync immediately
      if (this.autoSyncEnabled) {
        this.startAutoSync();
        console.log('✅ SyncIntegration: Auto-sync enabled and started (syncs every 5 seconds)');
      }
      
      console.log('✅ SyncIntegration: Sync integration service initialized');
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
    
    console.log(`🔄 SyncIntegration: Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Start auto-sync timer
   */
  private static startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      this.processSyncQueue();
    }, this.SYNC_INTERVAL_MS);
    
    console.log('🔄 SyncIntegration: Auto-sync timer started');
  }

  /**
   * Stop auto-sync timer
   */
  private static stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    console.log('🔄 SyncIntegration: Auto-sync timer stopped');
  }

  /**
   * Queue a sync operation
   */
  static queueSyncOperation(
    operation: 'create' | 'update' | 'delete',
    entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking',
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
    
    this.syncQueue.push(queueItem);
    console.log(`🔄 SyncIntegration: Queued ${operation} operation for ${entityType}:`, data.id);
    
    // Process queue immediately if auto-sync is enabled
    if (this.autoSyncEnabled) {
      this.processSyncQueue();
    }
  }

  /**
   * Process the sync queue
   */
  private static async processSyncQueue(): Promise<void> {
    if (this.isProcessingQueue || this.syncQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    console.log(`🔄 SyncIntegration: Processing sync queue (${this.syncQueue.length} items)`);
    
    try {
      // Test connection first
      const isConnected = await ApiSyncService.testConnection();
      if (!isConnected) {
        console.log('🔄 SyncIntegration: No connection, skipping sync queue processing');
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
      
      console.log(`✅ SyncIntegration: Processed sync queue, ${this.syncQueue.length} items remaining`);
      
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
    entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking',
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
    entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking',
    operations: SyncQueueItem[]
  ): Promise<void> {
    const entities = operations.map(op => op.data);
    
    const syncData: any = {};
    syncData[entityType === 'mileageEntry' ? 'mileageEntries' : 
             entityType === 'timeTracking' ? 'timeTracking' : 
             `${entityType}s`] = entities;
    
    console.log(`🔄 SyncIntegration: Processing ${operations.length} ${entityType} operations:`, {
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
    
    console.log(`✅ SyncIntegration: Successfully synced ${operations.length} ${entityType} operations`);
  }

  /**
   * Process delete operations
   */
  private static async processDeleteOperations(
    entityType: 'employee' | 'mileageEntry' | 'receipt' | 'timeTracking',
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
        
        console.log(`✅ SyncIntegration: Successfully deleted ${entityType}:`, operation.data.id);
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
    const baseUrl = 'http://localhost:3002/api';
    
    switch (entityType) {
      case 'employee':
        return `${baseUrl}/employees/${id}`;
      case 'mileageEntry':
        return `${baseUrl}/mileage-entries/${id}`;
      case 'receipt':
        return `${baseUrl}/receipts/${id}`;
      case 'timeTracking':
        return `${baseUrl}/time-tracking/${id}`;
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Force immediate sync of all pending changes
   */
  static async forceSync(): Promise<boolean> {
    try {
      console.log('🔄 SyncIntegration: Force sync requested');
      
      // Process queue immediately
      await this.processSyncQueue();
      
      // If queue is empty, do a full sync
      if (this.syncQueue.length === 0) {
        console.log('🔄 SyncIntegration: Queue empty, performing full sync');
        
        // Get all data and sync to backend
        const employees = await DatabaseService.getEmployees();
        const mileageEntries = await DatabaseService.getMileageEntries();
        const receipts = await DatabaseService.getReceipts();
        const timeTracking = await DatabaseService.getAllTimeTrackingEntries();
        
        const result = await ApiSyncService.syncToBackend({
          employees,
          mileageEntries,
          receipts,
          timeTracking
        });
        
        if (result.success) {
          console.log('✅ SyncIntegration: Force sync completed successfully');
          return true;
        } else {
          console.error('❌ SyncIntegration: Force sync failed:', result.error);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ SyncIntegration: Force sync error:', error);
      return false;
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
      nextSyncIn: this.syncInterval ? this.SYNC_INTERVAL_MS : 0
    };
  }

  /**
   * Clear the sync queue
   */
  static clearSyncQueue(): void {
    this.syncQueue = [];
    console.log('🔄 SyncIntegration: Sync queue cleared');
  }

  /**
   * Cleanup resources
   */
  static cleanup(): void {
    this.stopAutoSync();
    this.clearSyncQueue();
    console.log('🔄 SyncIntegration: Cleanup completed');
  }
}

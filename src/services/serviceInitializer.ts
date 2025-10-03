/**
 * Service Initializer
 * 
 * This module initializes all the intelligence services to avoid circular dependencies
 * between services and the main DatabaseService.
 */

import { LocationRelationshipService } from './locationRelationshipService';
import { VendorIntelligenceService } from './vendorIntelligenceService';
import { ExternalDataSourcesService } from './externalDataSourcesService';
import { NotificationIntelligenceService } from './notificationIntelligenceService';
import { DeviceIntelligenceService } from './deviceIntelligenceService';
import { PerformanceOptimizationService } from './performanceOptimizationService';

export class ServiceInitializer {
  /**
   * Initialize all intelligence services
   */
  static async initializeAllServices(): Promise<void> {
    try {
      console.log('🚀 ServiceInitializer: Starting service initialization...');
      
      // Initialize location relationship service
      await LocationRelationshipService.initializeTables();
      console.log('✅ LocationRelationshipService initialized');
      
      // Initialize vendor intelligence service
      await VendorIntelligenceService.initializeTables();
      console.log('✅ VendorIntelligenceService initialized');
      
      // Initialize external data sources service
      await ExternalDataSourcesService.initializeTables();
      console.log('✅ ExternalDataSourcesService initialized');
      
      // Initialize notification intelligence service
      await NotificationIntelligenceService.initializeTables();
      console.log('✅ NotificationIntelligenceService initialized');
      
      // Initialize device intelligence service
      await DeviceIntelligenceService.initializeTables();
      console.log('✅ DeviceIntelligenceService initialized');
      
      // Initialize performance optimization service
      await PerformanceOptimizationService.initializeTables();
      console.log('✅ PerformanceOptimizationService initialized');
      
      console.log('🚀 ServiceInitializer: All services initialized successfully!');
    } catch (error) {
      console.error('❌ ServiceInitializer: Error initializing services:', error);
      throw error;
    }
  }
}

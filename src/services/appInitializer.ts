import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { DatabaseService } from './database';
import { OxfordHouseService } from './oxfordHouseService';
import { RealtimeSyncService } from './realtimeSyncService';
import { ServiceInitializer } from './serviceInitializer';
import { SyncIntegrationService } from './syncIntegrationService';

export class AppInitializer {
  static async initialize(): Promise<void> {
    try {
      console.log('🚀 AppInitializer: Starting initialization...');
      
      // Only initialize database on mobile platforms
      if (Platform.OS !== 'web') {
        console.log('🚀 AppInitializer: Initializing database...');
        await DatabaseService.initDatabase();
        
        console.log('🚀 AppInitializer: Initializing Oxford Houses...');
        await OxfordHouseService.initializeOxfordHouses();
        
        console.log('🚀 AppInitializer: Initializing real-time sync...');
        await RealtimeSyncService.initialize();
        
        console.log('🚀 AppInitializer: Initializing intelligence services...');
        await ServiceInitializer.initializeAllServices();
        
        // Initialize location services
        try {
          console.log('🚀 AppInitializer: Initializing location services...');
          const isEnabled = await Location.hasServicesEnabledAsync();
          console.log('🚀 AppInitializer: Location services enabled:', isEnabled);
          
          if (isEnabled) {
            const { status } = await Location.getForegroundPermissionsAsync();
            console.log('🚀 AppInitializer: Location permission status:', status);
          }
        } catch (error) {
          console.error('🚀 AppInitializer: Error initializing location services:', error);
        }
        
        console.log('🚀 AppInitializer: App initialized successfully!');
      } else {
        console.log('🚀 AppInitializer: Web platform detected - initializing database and sync for testing');
        
        // Initialize database and sync service on web platform for testing
        try {
          console.log('🚀 AppInitializer: Initializing database for web testing...');
          await DatabaseService.initDatabase();
          
          console.log('🚀 AppInitializer: Initializing Oxford Houses for web...');
          await OxfordHouseService.initializeOxfordHouses();
          
          console.log('🚀 AppInitializer: Initializing sync integration service for web...');
          await SyncIntegrationService.initialize();
          
          console.log('✅ AppInitializer: Database and sync services initialized for web testing');
        } catch (error) {
          console.error('❌ AppInitializer: Failed to initialize services for web:', error);
        }
      }
      
    } catch (error) {
      console.error('❌ AppInitializer: Error initializing app:', error);
    }
  }
}

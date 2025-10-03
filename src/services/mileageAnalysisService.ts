/**
 * Mileage Analysis Service
 * 
 * This service analyzes mileage entries after they are created to update
 * location relationships and other intelligence systems.
 */

import { MileageEntry, Receipt } from '../types';
import { LocationRelationshipService } from './locationRelationshipService';
import { VendorIntelligenceService } from './vendorIntelligenceService';

export class MileageAnalysisService {
  /**
   * Analyze a newly created mileage entry
   */
  static async analyzeMileageEntry(entry: MileageEntry): Promise<void> {
    try {
      console.log('🔍 MileageAnalysisService: Analyzing mileage entry:', entry.id);
      
      // Analyze location relationships for intelligent suggestions
      await LocationRelationshipService.analyzeMileageEntry(entry);
      
      console.log('✅ MileageAnalysisService: Mileage entry analyzed successfully');
    } catch (error) {
      console.error('❌ MileageAnalysisService: Error analyzing mileage entry:', error);
      // Don't throw error - analysis failure shouldn't break the main flow
    }
  }

  /**
   * Analyze a newly created receipt
   */
  static async analyzeReceipt(receipt: Receipt): Promise<void> {
    try {
      console.log('🔍 MileageAnalysisService: Analyzing receipt:', receipt.id);
      
      // Analyze vendor intelligence for smart suggestions
      await VendorIntelligenceService.analyzeReceipt(receipt);
      
      console.log('✅ MileageAnalysisService: Receipt analyzed successfully');
    } catch (error) {
      console.error('❌ MileageAnalysisService: Error analyzing receipt:', error);
      // Don't throw error - analysis failure shouldn't break the main flow
    }
  }
}

/**
 * Cost Center AI Service
 * Provides intelligent cost center suggestions based on trip patterns, locations, and historical data
 */

import { DatabaseService } from './database';
import { MileageEntry, Receipt, TimeTracking, DailyDescription } from '../types';

export interface CostCenterSuggestion {
  costCenter: string;
  confidence: number; // 0-1
  reasoning: string;
  frequency: number;
  lastUsed?: Date;
  patterns: CostCenterPattern[];
}

export interface CostCenterPattern {
  pattern: string;
  type: 'location' | 'purpose' | 'time' | 'amount' | 'vendor';
  frequency: number;
  confidence: number;
}

export interface CostCenterAnalysis {
  employeeId: string;
  costCenterStats: Map<string, CostCenterStats>;
  patterns: CostCenterPattern[];
  suggestions: CostCenterSuggestion[];
  lastUpdated: Date;
}

export interface CostCenterStats {
  costCenter: string;
  totalMiles: number;
  totalExpenses: number;
  totalHours: number;
  tripCount: number;
  receiptCount: number;
  timeEntryCount: number;
  descriptionCount: number;
  averageTripMiles: number;
  averageReceiptAmount: number;
  commonPurposes: string[];
  commonLocations: string[];
  commonVendors: string[];
  monthlyPattern: number[];
  lastUsed: Date;
}

export class CostCenterAiService {
  
  /**
   * Get cost center suggestions based on trip context
   */
  static async getSuggestionsForTrip(
    startLocation: string,
    endLocation: string,
    purpose: string,
    employeeId: string
  ): Promise<CostCenterSuggestion[]> {
    
    try {
      // Get employee's cost centers
      const employee = await DatabaseService.getCurrentEmployee();
      if (!employee || !employee.selectedCostCenters) {
        return [];
      }

      // Get historical data for analysis
      const analysis = await this.analyzeCostCenterPatterns(employeeId);
      
      // Generate suggestions based on context
      const suggestions: CostCenterSuggestion[] = [];
      
      for (const costCenter of employee.selectedCostCenters) {
        const stats = analysis.costCenterStats.get(costCenter);
        if (!stats) continue;

        let confidence = 0;
        let reasoning = '';
        const patterns: CostCenterPattern[] = [];

        // Location-based suggestions
        if (startLocation && endLocation) {
          const locationMatch = this.calculateLocationMatch(startLocation, endLocation, stats.commonLocations);
          if (locationMatch > 0.3) {
            confidence += locationMatch * 0.4;
            reasoning += `Similar locations used before. `;
            patterns.push({
              pattern: `${startLocation} → ${endLocation}`,
              type: 'location',
              frequency: locationMatch,
              confidence: locationMatch
            });
          }
        }

        // Purpose-based suggestions
        if (purpose) {
          const purposeMatch = this.calculatePurposeMatch(purpose, stats.commonPurposes);
          if (purposeMatch > 0.3) {
            confidence += purposeMatch * 0.3;
            reasoning += `Similar purposes used before. `;
            patterns.push({
              pattern: purpose,
              type: 'purpose',
              frequency: purposeMatch,
              confidence: purposeMatch
            });
          }
        }

        // Frequency-based suggestions
        const frequencyScore = Math.min(stats.tripCount / 10, 1); // Normalize to 0-1
        if (frequencyScore > 0.2) {
          confidence += frequencyScore * 0.2;
          reasoning += `Frequently used cost center. `;
          patterns.push({
            pattern: `${stats.tripCount} trips`,
            type: 'time',
            frequency: frequencyScore,
            confidence: frequencyScore
          });
        }

        // Recent usage bonus
        const daysSinceLastUse = stats.lastUsed ? 
          (Date.now() - stats.lastUsed.getTime()) / (1000 * 60 * 60 * 24) : 30;
        if (daysSinceLastUse < 7) {
          confidence += 0.1;
          reasoning += `Recently used. `;
        }

        if (confidence > 0.2) {
          suggestions.push({
            costCenter,
            confidence: Math.min(confidence, 1),
            reasoning: reasoning.trim(),
            frequency: stats.tripCount,
            lastUsed: stats.lastUsed,
            patterns
          });
        }
      }

      // Sort by confidence and return top suggestions
      return suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    } catch (error) {
      console.error('Error getting cost center suggestions:', error);
      return [];
    }
  }

  /**
   * Get cost center suggestions for receipt entry
   */
  static async getSuggestionsForReceipt(
    vendor: string,
    amount: number,
    category: string,
    employeeId: string
  ): Promise<CostCenterSuggestion[]> {
    
    try {
      const employee = await DatabaseService.getCurrentEmployee();
      if (!employee || !employee.selectedCostCenters) {
        return [];
      }

      const analysis = await this.analyzeCostCenterPatterns(employeeId);
      const suggestions: CostCenterSuggestion[] = [];
      
      for (const costCenter of employee.selectedCostCenters) {
        const stats = analysis.costCenterStats.get(costCenter);
        if (!stats) continue;

        let confidence = 0;
        let reasoning = '';
        const patterns: CostCenterPattern[] = [];

        // Vendor-based suggestions
        if (vendor) {
          const vendorMatch = this.calculateVendorMatch(vendor, stats.commonVendors);
          if (vendorMatch > 0.3) {
            confidence += vendorMatch * 0.4;
            reasoning += `Similar vendor used before. `;
            patterns.push({
              pattern: vendor,
              type: 'vendor',
              frequency: vendorMatch,
              confidence: vendorMatch
            });
          }
        }

        // Amount-based suggestions
        if (amount > 0) {
          const amountMatch = this.calculateAmountMatch(amount, stats.averageReceiptAmount);
          if (amountMatch > 0.3) {
            confidence += amountMatch * 0.3;
            reasoning += `Similar amount range. `;
            patterns.push({
              pattern: `$${amount}`,
              type: 'amount',
              frequency: amountMatch,
              confidence: amountMatch
            });
          }
        }

        // Category-based suggestions (if we had category patterns)
        if (category) {
          // This could be enhanced with category-specific patterns
          confidence += 0.1;
          reasoning += `Category-based suggestion. `;
        }

        // Frequency bonus
        const frequencyScore = Math.min(stats.receiptCount / 5, 1);
        if (frequencyScore > 0.2) {
          confidence += frequencyScore * 0.2;
          reasoning += `Frequently used for receipts. `;
        }

        if (confidence > 0.2) {
          suggestions.push({
            costCenter,
            confidence: Math.min(confidence, 1),
            reasoning: reasoning.trim(),
            frequency: stats.receiptCount,
            lastUsed: stats.lastUsed,
            patterns
          });
        }
      }

      return suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    } catch (error) {
      console.error('Error getting cost center suggestions for receipt:', error);
      return [];
    }
  }

  /**
   * Analyze cost center usage patterns for an employee
   */
  private static async analyzeCostCenterPatterns(employeeId: string): Promise<CostCenterAnalysis> {
    const costCenterStats = new Map<string, CostCenterStats>();
    
    try {
      // Get all data for the employee
      const [mileageEntries, receipts, timeEntries, descriptions] = await Promise.all([
        DatabaseService.getMileageEntries(employeeId),
        DatabaseService.getReceipts(employeeId),
        DatabaseService.getAllTimeTrackingEntries(),
        DatabaseService.getDailyDescriptions(employeeId)
      ]);

      // Filter time entries for this employee
      const employeeTimeEntries = timeEntries.filter(entry => entry.employeeId === employeeId);

      // Process mileage entries
      for (const entry of mileageEntries) {
        if (!entry.costCenter) continue;
        
        let stats = costCenterStats.get(entry.costCenter);
        if (!stats) {
          stats = this.createEmptyStats(entry.costCenter);
          costCenterStats.set(entry.costCenter, stats);
        }

        stats.totalMiles += entry.miles || 0;
        stats.tripCount++;
        stats.lastUsed = new Date(entry.createdAt);

        if (entry.purpose) {
          stats.commonPurposes.push(entry.purpose);
        }
        if (entry.startLocation) {
          stats.commonLocations.push(entry.startLocation);
        }
        if (entry.endLocation) {
          stats.commonLocations.push(entry.endLocation);
        }
      }

      // Process receipts
      for (const receipt of receipts) {
        if (!receipt.costCenter) continue;
        
        let stats = costCenterStats.get(receipt.costCenter);
        if (!stats) {
          stats = this.createEmptyStats(receipt.costCenter);
          costCenterStats.set(receipt.costCenter, stats);
        }

        stats.totalExpenses += receipt.amount || 0;
        stats.receiptCount++;
        stats.lastUsed = new Date(receipt.createdAt);

        if (receipt.vendor) {
          stats.commonVendors.push(receipt.vendor);
        }
      }

      // Process time entries
      for (const entry of employeeTimeEntries) {
        if (!entry.costCenter) continue;
        
        let stats = costCenterStats.get(entry.costCenter);
        if (!stats) {
          stats = this.createEmptyStats(entry.costCenter);
          costCenterStats.set(entry.costCenter, stats);
        }

        stats.totalHours += entry.hours || 0;
        stats.timeEntryCount++;
        stats.lastUsed = new Date(entry.createdAt);
      }

      // Process descriptions
      for (const description of descriptions) {
        if (!description.costCenter) continue;
        
        let stats = costCenterStats.get(description.costCenter);
        if (!stats) {
          stats = this.createEmptyStats(description.costCenter);
          costCenterStats.set(description.costCenter, stats);
        }

        stats.descriptionCount++;
        stats.lastUsed = new Date(description.createdAt);
      }

      // Calculate averages and clean up data
      for (const [costCenter, stats] of costCenterStats) {
        stats.averageTripMiles = stats.tripCount > 0 ? stats.totalMiles / stats.tripCount : 0;
        stats.averageReceiptAmount = stats.receiptCount > 0 ? stats.totalExpenses / stats.receiptCount : 0;
        
        // Get most common purposes, locations, vendors
        stats.commonPurposes = this.getMostCommon(stats.commonPurposes, 5);
        stats.commonLocations = this.getMostCommon(stats.commonLocations, 10);
        stats.commonVendors = this.getMostCommon(stats.commonVendors, 5);
      }

      return {
        employeeId,
        costCenterStats,
        patterns: [],
        suggestions: [],
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Error analyzing cost center patterns:', error);
      return {
        employeeId,
        costCenterStats: new Map(),
        patterns: [],
        suggestions: [],
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Create empty stats object for a cost center
   */
  private static createEmptyStats(costCenter: string): CostCenterStats {
    return {
      costCenter,
      totalMiles: 0,
      totalExpenses: 0,
      totalHours: 0,
      tripCount: 0,
      receiptCount: 0,
      timeEntryCount: 0,
      descriptionCount: 0,
      averageTripMiles: 0,
      averageReceiptAmount: 0,
      commonPurposes: [],
      commonLocations: [],
      commonVendors: [],
      monthlyPattern: [],
      lastUsed: new Date()
    };
  }

  /**
   * Calculate location match score
   */
  private static calculateLocationMatch(start: string, end: string, commonLocations: string[]): number {
    const route = `${start} → ${end}`;
    const reverseRoute = `${end} → ${start}`;
    
    let matches = 0;
    for (const location of commonLocations) {
      if (location.includes(start) || location.includes(end)) {
        matches++;
      }
    }
    
    return Math.min(matches / Math.max(commonLocations.length, 1), 1);
  }

  /**
   * Calculate purpose match score
   */
  private static calculatePurposeMatch(purpose: string, commonPurposes: string[]): number {
    const purposeLower = purpose.toLowerCase();
    let matches = 0;
    
    for (const commonPurpose of commonPurposes) {
      if (commonPurpose.toLowerCase().includes(purposeLower) || 
          purposeLower.includes(commonPurpose.toLowerCase())) {
        matches++;
      }
    }
    
    return Math.min(matches / Math.max(commonPurposes.length, 1), 1);
  }

  /**
   * Calculate vendor match score
   */
  private static calculateVendorMatch(vendor: string, commonVendors: string[]): number {
    const vendorLower = vendor.toLowerCase();
    let matches = 0;
    
    for (const commonVendor of commonVendors) {
      if (commonVendor.toLowerCase().includes(vendorLower) || 
          vendorLower.includes(commonVendor.toLowerCase())) {
        matches++;
      }
    }
    
    return Math.min(matches / Math.max(commonVendors.length, 1), 1);
  }

  /**
   * Calculate amount match score
   */
  private static calculateAmountMatch(amount: number, averageAmount: number): number {
    if (averageAmount === 0) return 0;
    
    const ratio = Math.min(amount, averageAmount) / Math.max(amount, averageAmount);
    return ratio;
  }

  /**
   * Get most common items from an array
   */
  private static getMostCommon(items: string[], limit: number): string[] {
    const counts = new Map<string, number>();
    
    for (const item of items) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item]) => item);
  }
}

/**
 * Cost Center Auto-Selection Service
 * Intelligently suggests cost centers based on context and history
 */

import { DatabaseService } from './database';
import { Employee, MileageEntry, Receipt, TimeTracking } from '../types';

interface CostCenterFrequency {
  costCenter: string;
  count: number;
  lastUsed: Date;
}

interface CostCenterContext {
  destination?: string;
  purpose?: string;
  category?: string; // For receipts
  screen: 'mileage' | 'receipt' | 'timeTracking' | 'description';
}

export class CostCenterAutoSelectionService {
  private static lastUsedCache = new Map<string, string>(); // In-memory cache for performance
  
  /**
   * Get smart cost center suggestion based on context
   */
  static async suggestCostCenter(
    employee: Employee,
    context: CostCenterContext
  ): Promise<string> {
    try {
      // Priority 1: Check for same destination in recent entries
      if (context.destination && context.screen === 'mileage') {
        const destinationCostCenter = await this.getCostCenterForDestination(
          employee.id,
          context.destination
        );
        if (destinationCostCenter) {
          console.log(`📍 CostCenter: Using cost center from previous trip to "${context.destination}": ${destinationCostCenter}`);
          return destinationCostCenter;
        }
      }

      // Priority 2: Check for same purpose/category
      if (context.purpose && context.screen === 'mileage') {
        const purposeCostCenter = await this.getCostCenterForPurpose(
          employee.id,
          context.purpose
        );
        if (purposeCostCenter) {
          console.log(`📍 CostCenter: Using cost center from previous "${context.purpose}" trips: ${purposeCostCenter}`);
          return purposeCostCenter;
        }
      }

      if (context.category && context.screen === 'receipt') {
        const categoryCostCenter = await this.getCostCenterForReceiptCategory(
          employee.id,
          context.category
        );
        if (categoryCostCenter) {
          console.log(`📍 CostCenter: Using cost center from previous "${context.category}" receipts: ${categoryCostCenter}`);
          return categoryCostCenter;
        }
      }

      // Priority 3: Get last used cost center for this screen
      const lastUsed = await this.getLastUsedCostCenter(employee.id, context.screen);
      if (lastUsed) {
        console.log(`📍 CostCenter: Using last cost center for ${context.screen}: ${lastUsed}`);
        return lastUsed;
      }

      // Priority 4: Get most frequently used cost center
      const mostFrequent = await this.getMostFrequentCostCenter(employee.id);
      if (mostFrequent) {
        console.log(`📍 CostCenter: Using most frequent cost center: ${mostFrequent}`);
        return mostFrequent;
      }

      // Priority 5: Use employee's default cost center
      if (employee.defaultCostCenter) {
        console.log(`📍 CostCenter: Using employee default: ${employee.defaultCostCenter}`);
        return employee.defaultCostCenter;
      }

      // Priority 6: Use first available cost center
      const firstCostCenter = employee.costCenters?.[0] || 'Program Services';
      console.log(`📍 CostCenter: Using first available: ${firstCostCenter}`);
      return firstCostCenter;

    } catch (error) {
      console.error('❌ CostCenter: Error suggesting cost center:', error);
      return employee.defaultCostCenter || employee.costCenters?.[0] || 'Program Services';
    }
  }

  /**
   * Get cost center used for a specific destination
   */
  private static async getCostCenterForDestination(
    employeeId: string,
    destination: string
  ): Promise<string | null> {
    try {
      const entries = await DatabaseService.getMileageEntries(employeeId);
      
      // Find entries with similar destination (case-insensitive partial match)
      const matchingEntries = entries.filter(entry => {
        const endLocation = entry.endLocation?.toLowerCase() || '';
        const endLocationName = entry.endLocationDetails?.name?.toLowerCase() || '';
        const searchTerm = destination.toLowerCase();
        
        return endLocation.includes(searchTerm) || 
               endLocationName.includes(searchTerm) ||
               searchTerm.includes(endLocation) ||
               searchTerm.includes(endLocationName);
      });

      if (matchingEntries.length > 0) {
        // Get the most recent entry's cost center
        const sortedEntries = matchingEntries.sort((a, b) => 
          b.date.getTime() - a.date.getTime()
        );
        return sortedEntries[0].costCenter || null;
      }

      return null;
    } catch (error) {
      console.error('❌ CostCenter: Error getting cost center for destination:', error);
      return null;
    }
  }

  /**
   * Get cost center used for a specific purpose
   */
  private static async getCostCenterForPurpose(
    employeeId: string,
    purpose: string
  ): Promise<string | null> {
    try {
      const entries = await DatabaseService.getMileageEntries(employeeId);
      
      // Find entries with similar purpose (case-insensitive partial match)
      const matchingEntries = entries.filter(entry => {
        const entryPurpose = entry.purpose?.toLowerCase() || '';
        const searchTerm = purpose.toLowerCase();
        
        return entryPurpose.includes(searchTerm) || searchTerm.includes(entryPurpose);
      });

      if (matchingEntries.length > 0) {
        // Get the most common cost center for this purpose
        const costCenterCounts = new Map<string, number>();
        matchingEntries.forEach(entry => {
          if (entry.costCenter) {
            costCenterCounts.set(entry.costCenter, (costCenterCounts.get(entry.costCenter) || 0) + 1);
          }
        });

        // Find the most frequent
        let maxCount = 0;
        let mostFrequentCostCenter: string | null = null;
        costCenterCounts.forEach((count, costCenter) => {
          if (count > maxCount) {
            maxCount = count;
            mostFrequentCostCenter = costCenter;
          }
        });

        return mostFrequentCostCenter;
      }

      return null;
    } catch (error) {
      console.error('❌ CostCenter: Error getting cost center for purpose:', error);
      return null;
    }
  }

  /**
   * Get cost center used for a specific receipt category
   */
  private static async getCostCenterForReceiptCategory(
    employeeId: string,
    category: string
  ): Promise<string | null> {
    try {
      const receipts = await DatabaseService.getReceipts(employeeId);
      
      // Find receipts with same category
      const matchingReceipts = receipts.filter(receipt => 
        receipt.category?.toLowerCase() === category.toLowerCase()
      );

      if (matchingReceipts.length > 0) {
        // Get the most common cost center for this category
        const costCenterCounts = new Map<string, number>();
        matchingReceipts.forEach(receipt => {
          const costCenter = (receipt as any).costCenter;
          if (costCenter) {
            costCenterCounts.set(costCenter, (costCenterCounts.get(costCenter) || 0) + 1);
          }
        });

        // Find the most frequent
        let maxCount = 0;
        let mostFrequentCostCenter: string | null = null;
        costCenterCounts.forEach((count, costCenter) => {
          if (count > maxCount) {
            maxCount = count;
            mostFrequentCostCenter = costCenter;
          }
        });

        return mostFrequentCostCenter;
      }

      return null;
    } catch (error) {
      console.error('❌ CostCenter: Error getting cost center for category:', error);
      return null;
    }
  }

  /**
   * Get last used cost center for a specific screen
   */
  static async getLastUsedCostCenter(
    employeeId: string,
    screen: 'mileage' | 'receipt' | 'timeTracking' | 'description'
  ): Promise<string | null> {
    try {
      const key = `${employeeId}_${screen}`;
      
      // Check cache first
      if (this.lastUsedCache.has(key)) {
        return this.lastUsedCache.get(key) || null;
      }

      // Get from most recent entry of that type
      let costCenter: string | null = null;

      switch (screen) {
        case 'mileage':
          const mileageEntries = await DatabaseService.getRecentMileageEntries(employeeId, 1);
          costCenter = mileageEntries[0]?.costCenter || null;
          break;
        case 'receipt':
          const receipts = await DatabaseService.getReceipts(employeeId);
          if (receipts.length > 0) {
            const sortedReceipts = receipts.sort((a, b) => b.date.getTime() - a.date.getTime());
            costCenter = (sortedReceipts[0] as any).costCenter || null;
          }
          break;
        case 'timeTracking':
          const timeTracking = await DatabaseService.getTimeTrackingEntries(employeeId);
          if (timeTracking.length > 0) {
            const sortedTracking = timeTracking.sort((a, b) => b.date.getTime() - a.date.getTime());
            costCenter = sortedTracking[0].costCenter || null;
          }
          break;
        case 'description':
          const descriptions = await DatabaseService.getDailyDescriptions(employeeId);
          if (descriptions.length > 0) {
            const sortedDescriptions = descriptions.sort((a, b) => b.date.getTime() - a.date.getTime());
            costCenter = sortedDescriptions[0].costCenter || null;
          }
          break;
      }

      // Cache the result
      if (costCenter) {
        this.lastUsedCache.set(key, costCenter);
      }

      return costCenter;
    } catch (error) {
      console.error('❌ CostCenter: Error getting last used cost center:', error);
      return null;
    }
  }

  /**
   * Save last used cost center for a specific screen
   */
  static async saveLastUsedCostCenter(
    employeeId: string,
    screen: 'mileage' | 'receipt' | 'timeTracking' | 'description',
    costCenter: string
  ): Promise<void> {
    try {
      const key = `${employeeId}_${screen}`;
      this.lastUsedCache.set(key, costCenter);
      // Note: The actual save happens when the entry/receipt/tracking is created
    } catch (error) {
      console.error('❌ CostCenter: Error saving last used cost center:', error);
    }
  }

  /**
   * Get most frequently used cost center across all activities
   */
  private static async getMostFrequentCostCenter(employeeId: string): Promise<string | null> {
    try {
      const [mileageEntries, receipts, timeTracking] = await Promise.all([
        DatabaseService.getMileageEntries(employeeId),
        DatabaseService.getReceipts(employeeId),
        DatabaseService.getTimeTrackingEntries(employeeId)
      ]);

      const costCenterCounts = new Map<string, CostCenterFrequency>();

      // Count from mileage entries
      mileageEntries.forEach(entry => {
        if (entry.costCenter) {
          const existing = costCenterCounts.get(entry.costCenter);
          if (existing) {
            existing.count++;
            if (entry.date > existing.lastUsed) {
              existing.lastUsed = entry.date;
            }
          } else {
            costCenterCounts.set(entry.costCenter, {
              costCenter: entry.costCenter,
              count: 1,
              lastUsed: entry.date
            });
          }
        }
      });

      // Count from receipts
      receipts.forEach(receipt => {
        const costCenter = (receipt as any).costCenter;
        if (costCenter) {
          const existing = costCenterCounts.get(costCenter);
          if (existing) {
            existing.count++;
            if (receipt.date > existing.lastUsed) {
              existing.lastUsed = receipt.date;
            }
          } else {
            costCenterCounts.set(costCenter, {
              costCenter: costCenter,
              count: 1,
              lastUsed: receipt.date
            });
          }
        }
      });

      // Count from time tracking
      timeTracking.forEach(entry => {
        if (entry.costCenter) {
          const existing = costCenterCounts.get(entry.costCenter);
          if (existing) {
            existing.count++;
            if (entry.date > existing.lastUsed) {
              existing.lastUsed = entry.date;
            }
          } else {
            costCenterCounts.set(entry.costCenter, {
              costCenter: entry.costCenter,
              count: 1,
              lastUsed: entry.date
            });
          }
        }
      });

      if (costCenterCounts.size === 0) {
        return null;
      }

      // Find the most frequent, with recency as tiebreaker
      let mostFrequent: CostCenterFrequency | null = null;
      costCenterCounts.forEach(freq => {
        if (!mostFrequent || 
            freq.count > mostFrequent.count ||
            (freq.count === mostFrequent.count && freq.lastUsed > mostFrequent.lastUsed)) {
          mostFrequent = freq;
        }
      });

      return mostFrequent?.costCenter || null;
    } catch (error) {
      console.error('❌ CostCenter: Error getting most frequent cost center:', error);
      return null;
    }
  }

  /**
   * Get cost center statistics for an employee
   */
  static async getCostCenterStats(employeeId: string): Promise<{
    mostFrequent: string | null;
    distribution: Map<string, number>;
    recentlyUsed: string[];
  }> {
    try {
      const [mileageEntries, receipts, timeTracking] = await Promise.all([
        DatabaseService.getMileageEntries(employeeId),
        DatabaseService.getReceipts(employeeId),
        DatabaseService.getTimeTrackingEntries(employeeId)
      ]);

      const costCenterCounts = new Map<string, CostCenterFrequency>();

      // Aggregate all cost center usage
      const processCostCenter = (costCenter: string | undefined, date: Date) => {
        if (!costCenter) return;
        
        const existing = costCenterCounts.get(costCenter);
        if (existing) {
          existing.count++;
          if (date > existing.lastUsed) {
            existing.lastUsed = date;
          }
        } else {
          costCenterCounts.set(costCenter, {
            costCenter,
            count: 1,
            lastUsed: date
          });
        }
      };

      mileageEntries.forEach(entry => processCostCenter(entry.costCenter, entry.date));
      receipts.forEach(receipt => processCostCenter((receipt as any).costCenter, receipt.date));
      timeTracking.forEach(entry => processCostCenter(entry.costCenter, entry.date));

      // Get distribution
      const distribution = new Map<string, number>();
      costCenterCounts.forEach((freq, costCenter) => {
        distribution.set(costCenter, freq.count);
      });

      // Get most frequent
      let mostFrequent: string | null = null;
      let maxCount = 0;
      costCenterCounts.forEach(freq => {
        if (freq.count > maxCount) {
          maxCount = freq.count;
          mostFrequent = freq.costCenter;
        }
      });

      // Get recently used (last 30 days, sorted by recency)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentCostCenters = Array.from(costCenterCounts.values())
        .filter(freq => freq.lastUsed >= thirtyDaysAgo)
        .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
        .map(freq => freq.costCenter);

      return {
        mostFrequent,
        distribution,
        recentlyUsed: recentCostCenters
      };
    } catch (error) {
      console.error('❌ CostCenter: Error getting cost center stats:', error);
      return {
        mostFrequent: null,
        distribution: new Map(),
        recentlyUsed: []
      };
    }
  }
}


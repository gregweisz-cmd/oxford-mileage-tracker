/**
 * Cost Center Auto-Selection Service
 * Intelligently suggests cost centers based on context and history
 */

import { DatabaseService } from './database';
import { MileageEntry, Employee } from '../types';
import { debugLog } from '../config/debug';

export interface CostCenterSuggestion {
  costCenter: string;
  reason: 'same_destination' | 'most_frequent' | 'default';
  confidence: 'high' | 'medium' | 'low';
}

export class CostCenterAutoSelectionService {
  /**
   * Get suggested cost center for a new mileage entry
   * Priority:
   * 1. Same destination - if we've been to this location before, use that cost center
   * 2. Most frequent - use the cost center used most often by this employee
   * 3. Default - use the employee's default cost center
   */
  static async getSuggestion(
    employeeId: string,
    endLocation: string,
    employee?: Employee
  ): Promise<CostCenterSuggestion | null> {
    try {
      if (!endLocation || !endLocation.trim()) {
        return null;
      }

      const trimmedLocation = endLocation.trim().toLowerCase();

      // Load employee if not provided
      let currentEmployee = employee;
      if (!currentEmployee) {
        currentEmployee = await DatabaseService.getCurrentEmployee();
        if (!currentEmployee) {
          debugLog('No employee found for cost center suggestion');
          return null;
        }
      }

      // Get all mileage entries for this employee
      const allEntries = await DatabaseService.getMileageEntries(employeeId);

      // Strategy 1: Check for same destination
      const sameDestinationEntries = allEntries.filter(entry => {
        const entryLocation = (entry.endLocation || '').trim().toLowerCase();
        // Exact match or check if locations are similar (within 50 characters and 80% similarity)
        return entryLocation === trimmedLocation || 
               (entryLocation.length > 0 && trimmedLocation.length > 0 &&
                this.calculateLocationSimilarity(entryLocation, trimmedLocation) > 0.8);
      }).filter(entry => entry.costCenter && entry.costCenter.trim());

      if (sameDestinationEntries.length > 0) {
        // Find the most frequently used cost center for this destination
        const costCenterCounts = new Map<string, number>();
        sameDestinationEntries.forEach(entry => {
          const cc = entry.costCenter.trim();
          costCenterCounts.set(cc, (costCenterCounts.get(cc) || 0) + 1);
        });

        // Get the most frequent one
        let maxCount = 0;
        let mostFrequentCC = '';
        costCenterCounts.forEach((count, cc) => {
          if (count > maxCount) {
            maxCount = count;
            mostFrequentCC = cc;
          }
        });

        if (mostFrequentCC) {
          debugLog(`Cost center suggestion: ${mostFrequentCC} (same destination, used ${maxCount} times)`);
          return {
            costCenter: mostFrequentCC,
            reason: 'same_destination',
            confidence: maxCount >= 3 ? 'high' : maxCount >= 2 ? 'medium' : 'low'
          };
        }
      }

      // Strategy 2: Most frequently used cost center overall
      const entriesWithCostCenter = allEntries.filter(
        entry => entry.costCenter && entry.costCenter.trim()
      );

      if (entriesWithCostCenter.length > 0) {
        const costCenterCounts = new Map<string, number>();
        entriesWithCostCenter.forEach(entry => {
          const cc = entry.costCenter.trim();
          costCenterCounts.set(cc, (costCenterCounts.get(cc) || 0) + 1);
        });

        // Get the most frequent one
        let maxCount = 0;
        let mostFrequentCC = '';
        costCenterCounts.forEach((count, cc) => {
          if (count > maxCount) {
            maxCount = count;
            mostFrequentCC = cc;
          }
        });

        if (mostFrequentCC) {
          const totalEntries = entriesWithCostCenter.length;
          const usagePercentage = (maxCount / totalEntries) * 100;
          
          debugLog(`Cost center suggestion: ${mostFrequentCC} (most frequent, used ${maxCount}/${totalEntries} times, ${usagePercentage.toFixed(1)}%)`);
          
          return {
            costCenter: mostFrequentCC,
            reason: 'most_frequent',
            confidence: usagePercentage >= 50 ? 'high' : usagePercentage >= 30 ? 'medium' : 'low'
          };
        }
      }

      // Strategy 3: Use employee's default cost center
      if (currentEmployee.defaultCostCenter) {
        debugLog(`Cost center suggestion: ${currentEmployee.defaultCostCenter} (employee default)`);
        return {
          costCenter: currentEmployee.defaultCostCenter,
          reason: 'default',
          confidence: 'medium'
        };
      }

      // Strategy 4: Use first selected cost center if no default
      if (currentEmployee.selectedCostCenters && currentEmployee.selectedCostCenters.length > 0) {
        const firstCC = currentEmployee.selectedCostCenters[0];
        debugLog(`Cost center suggestion: ${firstCC} (first selected)`);
        return {
          costCenter: firstCC,
          reason: 'default',
          confidence: 'low'
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting cost center suggestion:', error);
      return null;
    }
  }

  /**
   * Calculate similarity between two location strings
   * Uses simple character-based similarity (can be enhanced with Levenshtein distance)
   */
  private static calculateLocationSimilarity(loc1: string, loc2: string): number {
    // Normalize locations
    const normalize = (str: string) => 
      str.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')     // Normalize whitespace
        .trim();

    const n1 = normalize(loc1);
    const n2 = normalize(loc2);

    // Exact match
    if (n1 === n2) return 1.0;

    // Check if one contains the other
    if (n1.includes(n2) || n2.includes(n1)) {
      const longer = Math.max(n1.length, n2.length);
      const shorter = Math.min(n1.length, n2.length);
      return shorter / longer;
    }

    // Calculate character overlap
    const set1 = new Set(n1.split(''));
    const set2 = new Set(n2.split(''));
    
    let intersection = 0;
    set1.forEach(char => {
      if (set2.has(char)) intersection++;
    });

    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Get suggestion reason as human-readable text
   */
  static getSuggestionReasonText(suggestion: CostCenterSuggestion): string {
    switch (suggestion.reason) {
      case 'same_destination':
        return `Previously used for this location`;
      case 'most_frequent':
        return `Your most frequently used cost center`;
      case 'default':
        return `Your default cost center`;
      default:
        return 'Suggested cost center';
    }
  }
}


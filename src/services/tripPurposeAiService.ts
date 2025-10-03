/**
 * Trip Purpose AI Service
 * Suggests trip purposes based on historical data and location patterns
 */

import { MileageEntry } from '../types';
import { DatabaseService } from './database';

export interface PurposeSuggestion {
  purpose: string;
  confidence: number;
  reasoning: string;
  frequency: number;
  lastUsed?: Date;
}

export class TripPurposeAiService {
  
  /**
   * Get purpose suggestions based on start and end locations
   */
  static async getSuggestionsForRoute(
    startLocation: string,
    endLocation: string,
    employeeId: string
  ): Promise<PurposeSuggestion[]> {
    
    if (!startLocation || !endLocation) {
      return [];
    }
    
    try {
      // Get all historical trips for this employee
      const allTrips = await DatabaseService.getMileageEntries(employeeId);
      
      // Find trips with similar routes
      const similarTrips = this.findSimilarRoutes(
        startLocation,
        endLocation,
        allTrips
      );
      
      if (similarTrips.length === 0) {
        // No historical data, provide intelligent defaults based on location
        return this.getDefaultSuggestions(startLocation, endLocation);
      }
      
      // Analyze purposes from similar trips
      const purposeStats = this.analyzePurposes(similarTrips);
      
      // Generate ranked suggestions
      const suggestions = this.rankSuggestions(purposeStats);
      
      return suggestions.slice(0, 5); // Return top 5 suggestions
      
    } catch (error) {
      console.error('Error getting purpose suggestions:', error);
      return [];
    }
  }
  
  /**
   * Find trips with similar start/end locations
   */
  private static findSimilarRoutes(
    startLocation: string,
    endLocation: string,
    allTrips: MileageEntry[]
  ): MileageEntry[] {
    const normalizedStart = this.normalizeLocation(startLocation);
    const normalizedEnd = this.normalizeLocation(endLocation);
    
    return allTrips.filter(trip => {
      const tripStart = this.normalizeLocation(trip.startLocation);
      const tripEnd = this.normalizeLocation(trip.endLocation);
      
      // Exact match
      if (tripStart === normalizedStart && tripEnd === normalizedEnd) {
        return true;
      }
      
      // Fuzzy match (one location matches, other is similar)
      const startSimilarity = this.calculateSimilarity(tripStart, normalizedStart);
      const endSimilarity = this.calculateSimilarity(tripEnd, normalizedEnd);
      
      // Both locations are at least 70% similar
      return startSimilarity >= 0.7 && endSimilarity >= 0.7;
    });
  }
  
  /**
   * Analyze purposes from similar trips
   */
  private static analyzePurposes(trips: MileageEntry[]): Map<string, {
    count: number;
    lastUsed: Date;
    totalOccurrences: number;
  }> {
    const purposeMap = new Map();
    
    for (const trip of trips) {
      const purpose = trip.purpose.trim();
      if (!purpose) continue;
      
      const existing = purposeMap.get(purpose) || {
        count: 0,
        lastUsed: new Date(0),
        totalOccurrences: 0,
      };
      
      existing.count++;
      existing.totalOccurrences++;
      
      const tripDate = new Date(trip.date);
      if (tripDate > existing.lastUsed) {
        existing.lastUsed = tripDate;
      }
      
      purposeMap.set(purpose, existing);
    }
    
    return purposeMap;
  }
  
  /**
   * Rank suggestions by frequency and recency
   */
  private static rankSuggestions(
    purposeStats: Map<string, any>
  ): PurposeSuggestion[] {
    const suggestions: PurposeSuggestion[] = [];
    const now = new Date();
    
    for (const [purpose, stats] of purposeStats.entries()) {
      // Calculate recency score (more recent = higher score)
      const daysSinceUsed = (now.getTime() - stats.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - (daysSinceUsed / 365)); // Decay over a year
      
      // Calculate frequency score
      const frequencyScore = stats.count / (purposeStats.size || 1);
      
      // Combined confidence (70% frequency, 30% recency)
      const confidence = (frequencyScore * 0.7) + (recencyScore * 0.3);
      
      suggestions.push({
        purpose,
        confidence,
        reasoning: this.generateReasoning(stats.count, daysSinceUsed),
        frequency: stats.count,
        lastUsed: stats.lastUsed,
      });
    }
    
    // Sort by confidence (highest first)
    suggestions.sort((a, b) => b.confidence - a.confidence);
    
    return suggestions;
  }
  
  /**
   * Generate user-friendly reasoning
   */
  private static generateReasoning(count: number, daysSinceUsed: number): string {
    let reason = `Used ${count} time${count > 1 ? 's' : ''}`;
    
    if (daysSinceUsed < 7) {
      reason += ' (recently)';
    } else if (daysSinceUsed < 30) {
      reason += ' (this month)';
    } else if (daysSinceUsed < 90) {
      reason += ' (recently)';
    }
    
    return reason;
  }
  
  /**
   * Get default suggestions based on location keywords
   */
  private static getDefaultSuggestions(
    startLocation: string,
    endLocation: string
  ): PurposeSuggestion[] {
    const suggestions: PurposeSuggestion[] = [];
    const endLower = endLocation.toLowerCase();
    
    // Oxford House destinations
    if (endLower.includes('oxford house') || endLower.includes('oh ')) {
      suggestions.push(
        { purpose: 'House stabilization', confidence: 0.7, reasoning: 'Common for OH visits', frequency: 0 },
        { purpose: 'Resident meeting', confidence: 0.6, reasoning: 'Common for OH visits', frequency: 0 },
        { purpose: 'New resident intake', confidence: 0.5, reasoning: 'Common for OH visits', frequency: 0 },
        { purpose: 'Maintenance inspection', confidence: 0.4, reasoning: 'Common for OH visits', frequency: 0 }
      );
    }
    
    // Office/Base address returns
    if (endLower.includes('base') || endLower.includes('ba') || endLower.includes('office')) {
      suggestions.push(
        { purpose: 'Return to base', confidence: 0.6, reasoning: 'Returning to office', frequency: 0 },
        { purpose: 'Administrative work', confidence: 0.5, reasoning: 'Office location', frequency: 0 }
      );
    }
    
    // Donation-related keywords
    if (endLower.includes('donation') || endLower.includes('pickup')) {
      suggestions.push(
        { purpose: 'Donation pickup', confidence: 0.7, reasoning: 'Location keywords', frequency: 0 },
        { purpose: 'Donation delivery', confidence: 0.6, reasoning: 'Location keywords', frequency: 0 }
      );
    }
    
    // Co-worker locations
    if (endLower.includes('coworker') || endLower.includes('co-worker')) {
      suggestions.push(
        { purpose: 'Team meeting', confidence: 0.6, reasoning: 'Co-worker location', frequency: 0 },
        { purpose: 'Training session', confidence: 0.5, reasoning: 'Co-worker location', frequency: 0 }
      );
    }
    
    // Generic suggestions if nothing specific
    if (suggestions.length === 0) {
      suggestions.push(
        { purpose: 'Business meeting', confidence: 0.4, reasoning: 'General purpose', frequency: 0 },
        { purpose: 'Site visit', confidence: 0.3, reasoning: 'General purpose', frequency: 0 },
        { purpose: 'Administrative task', confidence: 0.3, reasoning: 'General purpose', frequency: 0 }
      );
    }
    
    return suggestions.slice(0, 5);
  }
  
  /**
   * Normalize location for comparison
   */
  private static normalizeLocation(location: string): string {
    return location
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd)\b/g, '');
  }
  
  /**
   * Calculate similarity between two strings (0-1)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    // Check if one contains the other
    if (str1.includes(str2) || str2.includes(str1)) {
      const shorter = str1.length < str2.length ? str1 : str2;
      const longer = str1.length >= str2.length ? str1 : str2;
      return shorter.length / longer.length;
    }
    
    // Word overlap method
    const words1 = str1.split(/\s+/).filter(w => w.length > 2);
    const words2 = str2.split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(w => words2.includes(w));
    return commonWords.length / Math.max(words1.length, words2.length);
  }
  
  /**
   * Get quick purpose templates for common scenarios
   */
  static getCommonPurposes(): string[] {
    return [
      'House stabilization',
      'Resident meeting',
      'New resident intake',
      'Maintenance inspection',
      'Donation pickup',
      'Donation delivery',
      'Administrative work',
      'Team meeting',
      'Training session',
      'Site visit',
      'House check-in',
      'Emergency response',
      'Supply delivery',
      'Document pickup',
      'Return to base',
    ];
  }
  
  /**
   * Generate purpose from locations (for trip chaining)
   */
  static generatePurposeFromLocations(
    startLocation: string,
    endLocation: string
  ): string {
    const start = this.extractLocationName(startLocation);
    const end = this.extractLocationName(endLocation);
    
    // If end is an Oxford House, suggest house-related purpose
    if (endLocation.toLowerCase().includes('oxford house') || endLocation.toLowerCase().includes('oh ')) {
      return `${start} to ${end} for house visit`;
    }
    
    // If returning to base
    if (endLocation.toLowerCase().includes('ba') || endLocation.toLowerCase().includes('base')) {
      return `${start} to ${end}`;
    }
    
    // Generic format
    return `${start} to ${end}`;
  }
  
  /**
   * Extract clean location name from full address
   */
  private static extractLocationName(location: string): string {
    // Try to extract name before address
    const parts = location.split('-').map(p => p.trim());
    if (parts.length > 1) {
      return parts[0]; // Return name part
    }
    
    // If no dash, try to get first meaningful part
    const words = location.split(/\s+/);
    if (words.length > 3) {
      return words.slice(0, 3).join(' '); // First 3 words
    }
    
    return location;
  }
  
  /**
   * Learn from user's purpose selection
   */
  static async recordPurposeSelection(
    startLocation: string,
    endLocation: string,
    selectedPurpose: string,
    wasSuggested: boolean
  ): Promise<void> {
    // This data is automatically recorded when the trip is saved
    // The historical analysis will pick it up on next suggestion request
    console.log('📚 Learning: Purpose selected', {
      start: startLocation,
      end: endLocation,
      purpose: selectedPurpose,
      wasSuggested,
    });
  }
}


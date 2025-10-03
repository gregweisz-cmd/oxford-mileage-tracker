/**
 * Base Address Detection Service
 * Detects frequently used locations and suggests setting them as base address
 */

import { MileageEntry } from '../types';

export interface BaseAddressSuggestion {
  shouldSuggest: boolean;
  location: string;
  frequency: number;
  confidence: number;
  reasoning: string;
}

export class BaseAddressDetectionService {
  
  /**
   * Analyze trips to detect potential base address
   */
  static async analyzeForBaseAddress(
    entries: MileageEntry[],
    currentBaseAddress: string
  ): Promise<BaseAddressSuggestion> {
    
    if (entries.length < 5) {
      return {
        shouldSuggest: false,
        location: '',
        frequency: 0,
        confidence: 0,
        reasoning: 'Not enough trip data yet',
      };
    }
    
    // Count start location frequencies
    const locationCounts = new Map<string, number>();
    
    for (const entry of entries) {
      const location = this.normalizeLocation(entry.startLocation);
      if (location && location !== this.normalizeLocation(currentBaseAddress)) {
        locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
      }
    }
    
    // Find most frequent non-base location
    let mostFrequent = { location: '', count: 0 };
    
    for (const [location, count] of locationCounts.entries()) {
      if (count > mostFrequent.count) {
        mostFrequent = { location, count };
      }
    }
    
    // Calculate frequency percentage
    const frequency = mostFrequent.count / entries.length;
    
    // Suggest if used as start location in 70%+ of trips
    if (frequency >= 0.7 && mostFrequent.count >= 5) {
      return {
        shouldSuggest: true,
        location: mostFrequent.location,
        frequency: Math.round(frequency * 100),
        confidence: frequency,
        reasoning: `Used as starting point in ${Math.round(frequency * 100)}% of trips (${mostFrequent.count}/${entries.length})`,
      };
    }
    
    return {
      shouldSuggest: false,
      location: mostFrequent.location,
      frequency: Math.round(frequency * 100),
      confidence: frequency,
      reasoning: 'No clear pattern detected',
    };
  }
  
  /**
   * Normalize location string for comparison
   */
  private static normalizeLocation(location: string): string {
    return location
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, '');
  }
  
  /**
   * Check if user should be prompted about base address
   */
  static shouldPromptForBaseAddress(
    totalTrips: number,
    lastPromptDate: Date | null
  ): boolean {
    // Don't prompt too frequently
    if (lastPromptDate) {
      const daysSincePrompt = (new Date().getTime() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePrompt < 14) { // Wait at least 2 weeks between prompts
        return false;
      }
    }
    
    // Prompt after 10, 25, 50, 100 trips
    return [10, 25, 50, 100].includes(totalTrips);
  }
}


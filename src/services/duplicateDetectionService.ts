/**
 * Duplicate Detection Service
 * Detects potential duplicate trips and entries to prevent errors
 */

import { MileageEntry } from '../types';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: number;
  matchingEntry?: MileageEntry;
  reason: string;
}

export class DuplicateDetectionService {
  
  /**
   * Check if a mileage entry might be a duplicate
   */
  static async checkForDuplicate(
    newEntry: Partial<MileageEntry>,
    existingEntries: MileageEntry[]
  ): Promise<DuplicateCheckResult> {
    
    // Check against entries from the same day and nearby dates
    const entryDate = new Date(newEntry.date!);
    const sameDayEntries = existingEntries.filter(entry => {
      const existingDate = new Date(entry.date);
      return this.isSameDay(entryDate, existingDate);
    });
    
    for (const existing of sameDayEntries) {
      // Calculate similarity score
      const similarity = this.calculateSimilarity(newEntry, existing);
      
      // Require score of 1.0 (all criteria met) to flag as duplicate
      // This is much stricter and only catches true duplicates
      if (similarity.score >= 1.0) {
        return {
          isDuplicate: true,
          confidence: similarity.score,
          matchingEntry: existing,
          reason: this.buildReasonMessage(similarity),
        };
      }
    }
    
    return {
      isDuplicate: false,
      confidence: 0,
      reason: 'No duplicates found',
    };
  }
  
  /**
   * Calculate similarity between two trips
   * Made much stricter - only flags true duplicates (same date, same route, same purpose, very similar mileage)
   */
  private static calculateSimilarity(
    entry1: Partial<MileageEntry>,
    entry2: MileageEntry
  ): { score: number; matches: string[] } {
    let score = 0;
    const matches: string[] = [];
    
    // Require ALL of the following for a duplicate:
    // 1. Same purpose (must be identical, not just similar)
    let hasSamePurpose = false;
    if (entry1.purpose && entry2.purpose) {
      const purpose1 = entry1.purpose.toLowerCase().trim();
      const purpose2 = entry2.purpose.toLowerCase().trim();
      
      if (purpose1 === purpose2) {
        hasSamePurpose = true;
        score += 0.3;
        matches.push('identical purpose');
      }
    }
    
    // 2. Same start location (must be very similar)
    let hasSameStart = false;
    if (entry1.startLocation && entry2.startLocation) {
      const start1 = entry1.startLocation.toLowerCase().trim();
      const start2 = entry2.startLocation.toLowerCase().trim();
      
      // Extract just the address part if it's in format "Name (Address)"
      const cleanStart1 = this.extractAddress(start1);
      const cleanStart2 = this.extractAddress(start2);
      
      if (cleanStart1 === cleanStart2 || this.fuzzyMatch(cleanStart1, cleanStart2) > 0.9) {
        hasSameStart = true;
        score += 0.3;
        matches.push('same start location');
      }
    }
    
    // 3. Same end location (must be very similar)
    let hasSameEnd = false;
    if (entry1.endLocation && entry2.endLocation) {
      const end1 = entry1.endLocation.toLowerCase().trim();
      const end2 = entry2.endLocation.toLowerCase().trim();
      
      // Extract just the address part if it's in format "Name (Address)"
      const cleanEnd1 = this.extractAddress(end1);
      const cleanEnd2 = this.extractAddress(end2);
      
      if (cleanEnd1 === cleanEnd2 || this.fuzzyMatch(cleanEnd1, cleanEnd2) > 0.9) {
        hasSameEnd = true;
        score += 0.3;
        matches.push('same end location');
      }
    }
    
    // 4. Very similar mileage (within 5%, not 10%)
    let hasSimilarMiles = false;
    if (entry1.miles && entry2.miles) {
      const diff = Math.abs(entry1.miles - entry2.miles);
      const avgMiles = (entry1.miles + entry2.miles) / 2;
      const percentDiff = avgMiles > 0 ? diff / avgMiles : 1;
      
      if (percentDiff < 0.05) { // Within 5% (much stricter)
        hasSimilarMiles = true;
        score += 0.1;
        matches.push('very similar mileage');
      }
    }
    
    // Only consider it a duplicate if ALL criteria are met
    // This prevents false positives from legitimate trips with same route but different purposes/mileage
    if (!hasSamePurpose || !hasSameStart || !hasSameEnd || !hasSimilarMiles) {
      // Reset score if not all criteria met
      return { score: 0, matches: [] };
    }
    
    return { score, matches };
  }
  
  /**
   * Extract address from format like "OH Abigail (1025 S. Fulton St., Salisbury, NC 28144)"
   * Returns just the address part
   */
  private static extractAddress(location: string): string {
    // If it contains parentheses, extract the address part
    const match = location.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    // Otherwise return the whole string
    return location;
  }
  
  /**
   * Fuzzy string matching (Levenshtein-inspired)
   */
  private static fuzzyMatch(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    // Simple fuzzy matching - check if one contains the other
    if (str1.includes(str2) || str2.includes(str1)) {
      const shorter = str1.length < str2.length ? str1 : str2;
      const longer = str1.length >= str2.length ? str1 : str2;
      return shorter.length / longer.length;
    }
    
    // Check word overlap
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));
    
    if (commonWords.length > 0) {
      return commonWords.length / Math.max(words1.length, words2.length);
    }
    
    return 0;
  }
  
  /**
   * Check if two dates are the same day
   */
  private static isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }
  
  /**
   * Build a user-friendly reason message
   */
  private static buildReasonMessage(similarity: { score: number; matches: string[] }): string {
    const matchList = similarity.matches.join(', ');
    return `Found matching trip with ${matchList} (${Math.round(similarity.score * 100)}% similar)`;
  }
  
  /**
   * Check for recent duplicate entries (within last 24 hours)
   */
  static async checkRecentDuplicates(
    newEntry: Partial<MileageEntry>,
    recentEntries: MileageEntry[]
  ): Promise<DuplicateCheckResult[]> {
    const duplicates: DuplicateCheckResult[] = [];
    
    for (const existing of recentEntries) {
      const similarity = this.calculateSimilarity(newEntry, existing);
      
      if (similarity.score >= 0.7) { // Lower threshold for recent duplicates
        duplicates.push({
          isDuplicate: true,
          confidence: similarity.score,
          matchingEntry: existing,
          reason: this.buildReasonMessage(similarity),
        });
      }
    }
    
    return duplicates;
  }
}


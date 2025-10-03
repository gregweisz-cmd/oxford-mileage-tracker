import { getDatabaseConnection } from '../utils/databaseConnection';
import { Receipt } from '../types';

/**
 * Vendor Intelligence Service
 * 
 * This service provides intelligent vendor suggestions and patterns
 * to simplify receipt entry and improve data consistency.
 */

export interface VendorProfile {
  id: string;
  employeeId: string;
  vendorName: string;
  vendorAddress?: string;
  vendorLatitude?: number;
  vendorLongitude?: number;
  commonCategory: string;
  commonAmount: number;
  frequency: number;
  lastUsed: Date;
  patterns: VendorPattern[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorPattern {
  id: string;
  vendorProfileId: string;
  category: string;
  amount: number;
  frequency: number;
  lastUsed: Date;
  confidence: number; // 0-1, how confident we are in this pattern
}

export interface VendorSuggestion {
  vendorName: string;
  vendorAddress?: string;
  suggestedCategory: string;
  confidence: number; // 0-1, how confident we are in this suggestion
  reason: string; // Why this suggestion was made
  patterns: VendorPattern[];
}

export interface NearbyVendor {
  vendorName: string;
  vendorAddress: string;
  distance: number; // in miles
  category: string;
  lastUsed: Date;
}

export class VendorIntelligenceService {
  private static readonly MAX_SUGGESTIONS = 5;
  private static readonly MIN_FREQUENCY = 2; // Minimum frequency to consider a pattern
  private static readonly SEARCH_RADIUS_MILES = 5; // Radius for nearby vendor suggestions

  /**
   * Analyze a receipt and update vendor intelligence
   */
  static async analyzeReceipt(receipt: Receipt): Promise<void> {
    try {
      // Update or create vendor profile
      await this.updateVendorProfile(receipt);

      // Update vendor patterns
      await this.updateVendorPatterns(receipt);

      console.log(`🏪 Vendor Intelligence: Analyzed receipt for vendor "${receipt.vendor}"`);
    } catch (error) {
      console.error('Error analyzing receipt for vendor intelligence:', error);
    }
  }

  /**
   * Update or create a vendor profile
   */
  private static async updateVendorProfile(receipt: Receipt): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      
      // Check if vendor profile already exists
      const existing = await db.getFirstAsync(`
        SELECT * FROM vendor_profiles 
        WHERE employeeId = ? AND vendorName = ?
      `, [receipt.employeeId, receipt.vendor]);

      if (existing) {
        // Update existing vendor profile
        await db.runAsync(`
          UPDATE vendor_profiles 
          SET frequency = frequency + 1,
              lastUsed = ?,
              updatedAt = ?
          WHERE id = ?
        `, [new Date().toISOString(), new Date().toISOString(), existing.id]);

        // Update common category and amount based on frequency
        const categoryStats = await db.getAllAsync(`
          SELECT category, COUNT(*) as count, AVG(amount) as avgAmount
          FROM receipts 
          WHERE employeeId = ? AND vendor = ?
          GROUP BY category
          ORDER BY count DESC
        `, [receipt.employeeId, receipt.vendor]);

        if (categoryStats.length > 0) {
          const mostCommon = categoryStats[0];
          await db.runAsync(`
            UPDATE vendor_profiles 
            SET commonCategory = ?, commonAmount = ?
            WHERE id = ?
          `, [mostCommon.category, mostCommon.avgAmount, existing.id]);
        }
      } else {
        // Create new vendor profile
        const id = `vp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.runAsync(`
          INSERT INTO vendor_profiles (
            id, employeeId, vendorName, vendorAddress, vendorLatitude, vendorLongitude,
            commonCategory, commonAmount, frequency, lastUsed, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `, [
          id, receipt.employeeId, receipt.vendor, null, null, null,
          receipt.category, receipt.amount, new Date().toISOString(),
          new Date().toISOString(), new Date().toISOString()
        ]);
      }
    } catch (error) {
      console.error('Error updating vendor profile:', error);
    }
  }

  /**
   * Update vendor patterns for category and amount combinations
   */
  private static async updateVendorPatterns(receipt: Receipt): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      
      // Get the vendor profile ID
      const vendorProfile = await db.getFirstAsync(`
        SELECT id FROM vendor_profiles 
        WHERE employeeId = ? AND vendorName = ?
      `, [receipt.employeeId, receipt.vendor]);

      if (!vendorProfile) return;

      // Check if pattern already exists
      const existingPattern = await db.getFirstAsync(`
        SELECT * FROM vendor_patterns 
        WHERE vendorProfileId = ? AND category = ? AND ABS(amount - ?) < 1.0
      `, [vendorProfile.id, receipt.category, receipt.amount]);

      if (existingPattern) {
        // Update existing pattern
        await db.runAsync(`
          UPDATE vendor_patterns 
          SET frequency = frequency + 1,
              lastUsed = ?,
              confidence = LEAST(1.0, confidence + 0.1)
          WHERE id = ?
        `, [new Date().toISOString(), existingPattern.id]);
      } else {
        // Create new pattern
        const id = `vpat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.runAsync(`
          INSERT INTO vendor_patterns (
            id, vendorProfileId, category, amount, frequency, lastUsed, confidence
          ) VALUES (?, ?, ?, ?, 1, ?, 0.5)
        `, [
          id, vendorProfile.id, receipt.category, receipt.amount, new Date().toISOString()
        ]);
      }
    } catch (error) {
      console.error('Error updating vendor patterns:', error);
    }
  }

  /**
   * Get vendor suggestions based on partial vendor name input
   */
  static async getVendorSuggestions(
    employeeId: string,
    partialVendorName: string
  ): Promise<VendorSuggestion[]> {
    try {
      const db = await getDatabaseConnection();
      
      if (partialVendorName.length < 2) return [];

      // Get vendor profiles that match the partial name
      const vendorProfiles = await db.getAllAsync(`
        SELECT vp.*, vp.frequency as profileFrequency
        FROM vendor_profiles vp
        WHERE vp.employeeId = ? AND vp.vendorName LIKE ?
        ORDER BY vp.frequency DESC, vp.lastUsed DESC
        LIMIT ?
      `, [employeeId, `%${partialVendorName}%`, this.MAX_SUGGESTIONS]);

      const suggestions: VendorSuggestion[] = [];

      for (const profile of vendorProfiles) {
        if (profile.profileFrequency >= this.MIN_FREQUENCY) {
          // Get patterns for this vendor
          const patterns = await db.getAllAsync(`
            SELECT * FROM vendor_patterns 
            WHERE vendorProfileId = ?
            ORDER BY frequency DESC, confidence DESC
          `, [profile.id]);

          // Calculate confidence based on frequency and recency
          const daysSinceLastUse = Math.floor(
            (Date.now() - new Date(profile.lastUsed).getTime()) / (1000 * 60 * 60 * 24)
          );
          const recencyFactor = Math.max(0, 1 - (daysSinceLastUse / 30)); // Decay over 30 days
          const confidence = Math.min(1, (profile.profileFrequency / 10) * 0.7 + recencyFactor * 0.3);

          // Get the most common pattern
          const topPattern = patterns.length > 0 ? patterns[0] : null;

          suggestions.push({
            vendorName: profile.vendorName,
            vendorAddress: profile.vendorAddress,
            suggestedCategory: topPattern?.category || profile.commonCategory,
            confidence: Math.round(confidence * 100) / 100,
            reason: `Used ${profile.profileFrequency} times, last ${daysSinceLastUse} days ago`,
            patterns: patterns.map(p => ({
              ...p,
              lastUsed: new Date(p.lastUsed)
            }))
          });
        }
      }

      return suggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error getting vendor suggestions:', error);
      return [];
    }
  }

  /**
   * Get nearby vendor suggestions based on current location
   */
  static async getNearbyVendorSuggestions(
    employeeId: string,
    latitude: number,
    longitude: number
  ): Promise<NearbyVendor[]> {
    try {
      const db = await getDatabaseConnection();
      
      // Get all vendor profiles with location data
      const vendorProfiles = await db.getAllAsync(`
        SELECT * FROM vendor_profiles 
        WHERE employeeId = ? AND vendorLatitude IS NOT NULL AND vendorLongitude IS NOT NULL
      `, [employeeId]);

      const nearbyVendors: NearbyVendor[] = [];

      for (const profile of vendorProfiles) {
        if (profile.vendorLatitude && profile.vendorLongitude) {
          // Calculate distance using Haversine formula (simplified)
          const distance = this.calculateDistance(
            latitude, longitude,
            profile.vendorLatitude, profile.vendorLongitude
          );

          if (distance <= this.SEARCH_RADIUS_MILES) {
            nearbyVendors.push({
              vendorName: profile.vendorName,
              vendorAddress: profile.vendorAddress || '',
              distance: Math.round(distance * 10) / 10,
              category: profile.commonCategory,
              lastUsed: new Date(profile.lastUsed)
            });
          }
        }
      }

      return nearbyVendors.sort((a, b) => a.distance - b.distance);
    } catch (error) {
      console.error('Error getting nearby vendor suggestions:', error);
      return [];
    }
  }

  /**
   * Get vendor patterns for a specific vendor
   */
  static async getVendorPatterns(
    employeeId: string,
    vendorName: string
  ): Promise<VendorPattern[]> {
    try {
      const db = await getDatabaseConnection();
      
      const patterns = await db.getAllAsync(`
        SELECT vp.* FROM vendor_patterns vp
        JOIN vendor_profiles vprof ON vp.vendorProfileId = vprof.id
        WHERE vprof.employeeId = ? AND vprof.vendorName = ?
        ORDER BY vp.frequency DESC, vp.confidence DESC
      `, [employeeId, vendorName]);

      return patterns.map(pattern => ({
        ...pattern,
        lastUsed: new Date(pattern.lastUsed)
      }));
    } catch (error) {
      console.error('Error getting vendor patterns:', error);
      return [];
    }
  }

  /**
   * Update vendor location information
   */
  static async updateVendorLocation(
    employeeId: string,
    vendorName: string,
    address: string,
    latitude?: number,
    longitude?: number
  ): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      
      await db.runAsync(`
        UPDATE vendor_profiles 
        SET vendorAddress = ?, vendorLatitude = ?, vendorLongitude = ?, updatedAt = ?
        WHERE employeeId = ? AND vendorName = ?
      `, [address, latitude, longitude, new Date().toISOString(), employeeId, vendorName]);
    } catch (error) {
      console.error('Error updating vendor location:', error);
    }
  }

  /**
   * Get all vendor profiles for an employee
   */
  static async getVendorProfiles(employeeId: string): Promise<VendorProfile[]> {
    try {
      const db = await getDatabaseConnection();
      
      const profiles = await db.getAllAsync(`
        SELECT vp.*, 
               GROUP_CONCAT(
                 vpat.category || ':' || vpat.amount || ':' || vpat.frequency || ':' || vpat.confidence,
                 '|'
               ) as patternsData
        FROM vendor_profiles vp
        LEFT JOIN vendor_patterns vpat ON vp.id = vpat.vendorProfileId
        WHERE vp.employeeId = ?
        GROUP BY vp.id
        ORDER BY vp.frequency DESC, vp.lastUsed DESC
      `, [employeeId]);

      return profiles.map(profile => ({
        ...profile,
        lastUsed: new Date(profile.lastUsed),
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt),
        patterns: profile.patternsData ? 
          profile.patternsData.split('|').map((patternStr: string) => {
            const [category, amount, frequency, confidence] = patternStr.split(':');
            return {
              id: '',
              vendorProfileId: profile.id,
              category,
              amount: parseFloat(amount),
              frequency: parseInt(frequency),
              lastUsed: profile.lastUsed,
              confidence: parseFloat(confidence)
            };
          }) : []
      }));
    } catch (error) {
      console.error('Error getting vendor profiles:', error);
      return [];
    }
  }

  /**
   * Initialize database tables for vendor intelligence
   */
  static async initializeTables(): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      
      // Create vendor_profiles table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS vendor_profiles (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          vendorName TEXT NOT NULL,
          vendorAddress TEXT,
          vendorLatitude REAL,
          vendorLongitude REAL,
          commonCategory TEXT NOT NULL,
          commonAmount REAL NOT NULL,
          frequency INTEGER NOT NULL DEFAULT 1,
          lastUsed TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Create vendor_patterns table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS vendor_patterns (
          id TEXT PRIMARY KEY,
          vendorProfileId TEXT NOT NULL,
          category TEXT NOT NULL,
          amount REAL NOT NULL,
          frequency INTEGER NOT NULL DEFAULT 1,
          lastUsed TEXT NOT NULL,
          confidence REAL NOT NULL DEFAULT 0.5,
          FOREIGN KEY (vendorProfileId) REFERENCES vendor_profiles (id) ON DELETE CASCADE
        );
      `);

      // Create indexes for better performance
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_vendor_profiles_employee 
        ON vendor_profiles(employeeId, vendorName);
      `);

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_vendor_patterns_profile 
        ON vendor_patterns(vendorProfileId);
      `);

      console.log('🏪 Vendor Intelligence tables initialized');
    } catch (error) {
      console.error('Error initializing vendor intelligence tables:', error);
    }
  }

  /**
   * Clean up old or unused vendor profiles (maintenance function)
   */
  static async cleanupOldVendorProfiles(daysOld: number = 90): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Remove old vendor profiles with low frequency
      await db.runAsync(`
        DELETE FROM vendor_profiles 
        WHERE lastUsed < ? AND frequency < ?
      `, [cutoffDate.toISOString(), this.MIN_FREQUENCY]);

      // Remove old vendor patterns with low frequency
      await db.runAsync(`
        DELETE FROM vendor_patterns 
        WHERE lastUsed < ? AND frequency < ?
      `, [cutoffDate.toISOString(), this.MIN_FREQUENCY]);

      console.log(`🏪 Cleaned up vendor profiles older than ${daysOld} days`);
    } catch (error) {
      console.error('Error cleaning up old vendor profiles:', error);
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI/180);
  }

  /**
   * Get vendor statistics for analytics
   */
  static async getVendorStatistics(employeeId: string): Promise<{
    totalVendors: number;
    mostFrequentVendor: string;
    totalReceipts: number;
    averageReceiptAmount: number;
    topCategories: Array<{category: string, count: number}>;
  }> {
    try {
      const db = await getDatabaseConnection();
      
      const stats = await db.getFirstAsync(`
        SELECT 
          COUNT(DISTINCT vp.vendorName) as totalVendors,
          vp.vendorName as mostFrequentVendor,
          SUM(vp.frequency) as totalReceipts
        FROM vendor_profiles vp
        WHERE vp.employeeId = ?
        ORDER BY vp.frequency DESC
        LIMIT 1
      `, [employeeId]);

      const avgAmount = await db.getFirstAsync(`
        SELECT AVG(amount) as averageAmount
        FROM receipts
        WHERE employeeId = ?
      `, [employeeId]);

      const topCategories = await db.getAllAsync(`
        SELECT category, COUNT(*) as count
        FROM receipts
        WHERE employeeId = ?
        GROUP BY category
        ORDER BY count DESC
        LIMIT 5
      `, [employeeId]);

      return {
        totalVendors: stats?.totalVendors || 0,
        mostFrequentVendor: stats?.mostFrequentVendor || 'None',
        totalReceipts: stats?.totalReceipts || 0,
        averageReceiptAmount: avgAmount?.averageAmount || 0,
        topCategories: topCategories.map(cat => ({
          category: cat.category,
          count: cat.count
        }))
      };
    } catch (error) {
      console.error('Error getting vendor statistics:', error);
      return {
        totalVendors: 0,
        mostFrequentVendor: 'None',
        totalReceipts: 0,
        averageReceiptAmount: 0,
        topCategories: []
      };
    }
  }
}

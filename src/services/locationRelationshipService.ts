import { getDatabaseConnection } from '../utils/databaseConnection';
import { MileageEntry } from '../types';

/**
 * Location Relationship Mapping Service
 * 
 * This service tracks trip patterns and relationships between locations
 * to build comprehensive MILEAGE_PURPOSE descriptions and suggest
 * intelligent trip chains for users.
 */

export interface LocationRelationship {
  id: string;
  employeeId: string;
  startLocation: string;
  endLocation: string;
  commonPurpose: string;
  frequency: number;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TripChain {
  id: string;
  employeeId: string;
  chain: string[]; // Array of locations in order
  commonPurpose: string;
  frequency: number;
  lastUsed: Date;
  totalMiles: number;
  estimatedHours: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationSuggestion {
  location: string;
  confidence: number; // 0-1, how likely this location is next
  purpose: string;
  reason: string; // Why this suggestion was made
}

export class LocationRelationshipService {
  private static readonly MAX_SUGGESTIONS = 5;
  private static readonly MIN_FREQUENCY = 2; // Minimum frequency to consider a relationship

  /**
   * Analyze a mileage entry and update location relationships
   */
  static async analyzeMileageEntry(entry: MileageEntry): Promise<void> {
    try {
      // Update direct location relationships
      await this.updateLocationRelationship(
        entry.employeeId,
        entry.startLocation,
        entry.endLocation,
        entry.purpose
      );

      // Analyze for potential trip chains
      await this.analyzeTripChains(entry);

      console.log(`📍 Location Relationship: Analyzed entry for ${entry.employeeId}`);
    } catch (error) {
      console.error('Error analyzing mileage entry:', error);
    }
  }

  /**
   * Update or create a location relationship
   */
  private static async updateLocationRelationship(
    employeeId: string,
    startLocation: string,
    endLocation: string,
    purpose: string
  ): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      
      // Check if relationship already exists
      const existing = await db.getFirstAsync(`
        SELECT * FROM location_relationships 
        WHERE employeeId = ? AND startLocation = ? AND endLocation = ?
      `, [employeeId, startLocation, endLocation]);

      if (existing) {
        // Update existing relationship
        await db.runAsync(`
          UPDATE location_relationships 
          SET frequency = frequency + 1,
              commonPurpose = ?,
              lastUsed = ?,
              updatedAt = ?
          WHERE id = ?
        `, [purpose, new Date().toISOString(), new Date().toISOString(), existing.id]);
      } else {
        // Create new relationship
        const id = `lr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.runAsync(`
          INSERT INTO location_relationships (
            id, employeeId, startLocation, endLocation, commonPurpose,
            frequency, lastUsed, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
        `, [
          id, employeeId, startLocation, endLocation, purpose,
          new Date().toISOString(), new Date().toISOString(), new Date().toISOString()
        ]);
      }
    } catch (error) {
      console.error('Error updating location relationship:', error);
    }
  }

  /**
   * Analyze mileage entries for potential trip chains
   */
  private static async analyzeTripChains(entry: MileageEntry): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      
      // Get recent entries for this employee on the same day
      const dayStart = new Date(entry.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(entry.date);
      dayEnd.setHours(23, 59, 59, 999);

      const recentEntries = await db.getAllAsync(`
        SELECT * FROM mileage_entries 
        WHERE employeeId = ? 
        AND date BETWEEN ? AND ?
        ORDER BY date ASC
      `, [entry.employeeId, dayStart.toISOString(), dayEnd.toISOString()]);

      // Look for patterns in the day's trips
      if (recentEntries.length >= 2) {
        const locations = recentEntries.map(e => e.startLocation);
        locations.push(entry.endLocation); // Add the final destination

        // Check if this chain already exists
        const chainString = locations.join(' → ');
        const existingChain = await db.getFirstAsync(`
          SELECT * FROM trip_chains 
          WHERE employeeId = ? AND chain = ?
        `, [entry.employeeId, chainString]);

        if (existingChain) {
          // Update existing chain
          const totalMiles = recentEntries.reduce((sum, e) => sum + e.miles, 0);
          await db.runAsync(`
            UPDATE trip_chains 
            SET frequency = frequency + 1,
                totalMiles = ?,
                lastUsed = ?,
                updatedAt = ?
            WHERE id = ?
          `, [totalMiles, new Date().toISOString(), new Date().toISOString(), existingChain.id]);
        } else {
          // Create new chain
          const totalMiles = recentEntries.reduce((sum, e) => sum + e.miles, 0);
          const estimatedHours = recentEntries.reduce((sum, e) => sum + (e.hoursWorked || 0), 0);
          
          const id = `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await db.runAsync(`
            INSERT INTO trip_chains (
              id, employeeId, chain, commonPurpose, frequency,
              totalMiles, estimatedHours, lastUsed, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
          `, [
            id, entry.employeeId, chainString, entry.purpose,
            totalMiles, estimatedHours, new Date().toISOString(),
            new Date().toISOString(), new Date().toISOString()
          ]);
        }
      }
    } catch (error) {
      console.error('Error analyzing trip chains:', error);
    }
  }

  /**
   * Get location suggestions based on current location and employee patterns
   */
  static async getLocationSuggestions(
    employeeId: string,
    currentLocation: string,
    timeOfDay?: string
  ): Promise<LocationSuggestion[]> {
    try {
      const db = await getDatabaseConnection();
      
      // Get direct relationships from current location
      const relationships = await db.getAllAsync(`
        SELECT * FROM location_relationships 
        WHERE employeeId = ? AND startLocation = ?
        ORDER BY frequency DESC, lastUsed DESC
        LIMIT ?
      `, [employeeId, currentLocation, this.MAX_SUGGESTIONS]);

      const suggestions: LocationSuggestion[] = [];

      for (const rel of relationships) {
        if (rel.frequency >= this.MIN_FREQUENCY) {
          // Calculate confidence based on frequency and recency
          const daysSinceLastUse = Math.floor(
            (Date.now() - new Date(rel.lastUsed).getTime()) / (1000 * 60 * 60 * 24)
          );
          const recencyFactor = Math.max(0, 1 - (daysSinceLastUse / 30)); // Decay over 30 days
          const confidence = Math.min(1, (rel.frequency / 10) * 0.7 + recencyFactor * 0.3);

          suggestions.push({
            location: rel.endLocation,
            confidence: Math.round(confidence * 100) / 100,
            purpose: rel.commonPurpose,
            reason: `Visited ${rel.frequency} times, last ${daysSinceLastUse} days ago`
          });
        }
      }

      return suggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error getting location suggestions:', error);
      return [];
    }
  }

  /**
   * Get trip chain suggestions for building comprehensive MILEAGE_PURPOSE
   */
  static async getTripChainSuggestions(
    employeeId: string,
    startLocation: string
  ): Promise<TripChain[]> {
    try {
      const db = await getDatabaseConnection();
      
      const chains = await db.getAllAsync(`
        SELECT * FROM trip_chains 
        WHERE employeeId = ? AND chain LIKE ?
        ORDER BY frequency DESC, lastUsed DESC
        LIMIT ?
      `, [employeeId, `${startLocation}%`, this.MAX_SUGGESTIONS]);

      return chains.filter(chain => chain.frequency >= this.MIN_FREQUENCY);
    } catch (error) {
      console.error('Error getting trip chain suggestions:', error);
      return [];
    }
  }

  /**
   * Generate comprehensive MILEAGE_PURPOSE from trip chain
   */
  static generateMileagePurpose(tripChain: TripChain): string {
    const locations = tripChain.chain.split(' → ');
    
    if (locations.length <= 2) {
      return `${locations[0]} to ${locations[1]} (${tripChain.commonPurpose})`;
    }

    // Build comprehensive description for multi-stop trips
    let description = `${locations[0]} to ${locations[1]} (${tripChain.commonPurpose})`;
    
    for (let i = 1; i < locations.length - 1; i++) {
      description += ` to ${locations[i + 1]}`;
    }
    
    // Add return to base if it ends with BA
    if (locations[locations.length - 1] === 'BA') {
      description += ' to BA';
    }

    return description;
  }

  /**
   * Initialize database tables for location relationships
   */
  static async initializeTables(): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      
      // Create location_relationships table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS location_relationships (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          startLocation TEXT NOT NULL,
          endLocation TEXT NOT NULL,
          commonPurpose TEXT NOT NULL,
          frequency INTEGER NOT NULL DEFAULT 1,
          lastUsed TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Create trip_chains table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS trip_chains (
          id TEXT PRIMARY KEY,
          employeeId TEXT NOT NULL,
          chain TEXT NOT NULL,
          commonPurpose TEXT NOT NULL,
          frequency INTEGER NOT NULL DEFAULT 1,
          totalMiles REAL NOT NULL DEFAULT 0,
          estimatedHours REAL NOT NULL DEFAULT 0,
          lastUsed TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      // Create indexes for better performance
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_location_relationships_employee 
        ON location_relationships(employeeId, startLocation);
      `);

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_trip_chains_employee 
        ON trip_chains(employeeId);
      `);

      console.log('📍 Location Relationship tables initialized');
    } catch (error) {
      console.error('Error initializing location relationship tables:', error);
    }
  }

  /**
   * Get all location relationships for an employee
   */
  static async getLocationRelationships(employeeId: string): Promise<LocationRelationship[]> {
    try {
      const db = await getDatabaseConnection();
      
      const relationships = await db.getAllAsync(`
        SELECT * FROM location_relationships 
        WHERE employeeId = ?
        ORDER BY frequency DESC, lastUsed DESC
      `, [employeeId]);

      return relationships.map(rel => ({
        ...rel,
        lastUsed: new Date(rel.lastUsed),
        createdAt: new Date(rel.createdAt),
        updatedAt: new Date(rel.updatedAt)
      }));
    } catch (error) {
      console.error('Error getting location relationships:', error);
      return [];
    }
  }

  /**
   * Get all trip chains for an employee
   */
  static async getTripChains(employeeId: string): Promise<TripChain[]> {
    try {
      const db = await getDatabaseConnection();
      
      const chains = await db.getAllAsync(`
        SELECT * FROM trip_chains 
        WHERE employeeId = ?
        ORDER BY frequency DESC, lastUsed DESC
      `, [employeeId]);

      return chains.map(chain => ({
        ...chain,
        lastUsed: new Date(chain.lastUsed),
        createdAt: new Date(chain.createdAt),
        updatedAt: new Date(chain.updatedAt)
      }));
    } catch (error) {
      console.error('Error getting trip chains:', error);
      return [];
    }
  }

  /**
   * Clear old or unused relationships (maintenance function)
   */
  static async cleanupOldRelationships(daysOld: number = 90): Promise<void> {
    try {
      const db = await getDatabaseConnection();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Remove old relationships with low frequency
      await db.runAsync(`
        DELETE FROM location_relationships 
        WHERE lastUsed < ? AND frequency < ?
      `, [cutoffDate.toISOString(), this.MIN_FREQUENCY]);

      // Remove old trip chains with low frequency
      await db.runAsync(`
        DELETE FROM trip_chains 
        WHERE lastUsed < ? AND frequency < ?
      `, [cutoffDate.toISOString(), this.MIN_FREQUENCY]);

      console.log(`📍 Cleaned up location relationships older than ${daysOld} days`);
    } catch (error) {
      console.error('Error cleaning up old relationships:', error);
    }
  }
}

import { DatabaseService } from './database';
import { debugLog, debugError, debugWarn } from '../config/debug';

// API Configuration - use local backend for testing, cloud backend for production
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.86.101:3002/api' 
  : 'https://oxford-mileage-backend.onrender.com/api';

export interface PerDiemRule {
  id: string;
  costCenter: string;
  maxAmount: number;
  minHours: number;
  minMiles: number;
  minDistanceFromBase: number;
  description: string;
  useActualAmount: boolean;
  createdAt: string;
  updatedAt: string;
}

export class PerDiemRulesService {
  private static rulesCache: PerDiemRule[] = [];
  private static lastFetchTime: Date | null = null;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch Per Diem rules from backend
   */
  static async fetchPerDiemRules(): Promise<PerDiemRule[]> {
    try {
      debugLog('📋 PerDiemRules: Fetching rules from backend...');
      
      const response = await fetch(`${API_BASE_URL}/per-diem-rules`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch per diem rules: ${response.status} ${response.statusText}`);
      }

      const rules = await response.json();
      
      // Cache the rules
      this.rulesCache = rules;
      this.lastFetchTime = new Date();
      
      // Store rules locally for offline access
      await this.storeRulesLocally(rules);
      
      return rules;
    } catch (error) {
      console.error('❌ PerDiemRules: Error fetching rules from backend:', error);
      
      // Try to load from local storage as fallback
      return await this.getLocalRules();
    }
  }

  /**
   * Get Per Diem rule for a specific cost center
   */
  static async getPerDiemRule(costCenter: string): Promise<PerDiemRule | null> {
    try {
      // Check cache first
      if (this.isCacheValid()) {
        const rule = this.rulesCache.find(r => r.costCenter === costCenter);
        if (rule) {
          return rule;
        }
      }

      // Fetch from backend if cache is invalid
      await this.fetchPerDiemRules();
      const rule = this.rulesCache.find(r => r.costCenter === costCenter);
      
      return rule || null;
    } catch (error) {
      console.error('❌ PerDiemRules: Error getting rule for cost center:', error);
      return null;
    }
  }

  /**
   * Calculate Per Diem amount based on rules and activity
   */
  static async calculatePerDiem(
    costCenter: string,
    hoursWorked: number = 0,
    milesTraveled: number = 0,
    distanceFromBase: number = 0,
    actualExpenses: number = 0
  ): Promise<{ amount: number; rule: PerDiemRule | null; meetsRequirements: boolean }> {
    try {
      const rule = await this.getPerDiemRule(costCenter);
      
      // Default rule if none found
      const defaultRule: PerDiemRule = {
        id: 'default',
        costCenter,
        maxAmount: 35,
        minHours: 0,
        minMiles: 0,
        minDistanceFromBase: 0,
        description: 'Default Per Diem rule',
        useActualAmount: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const activeRule = rule || defaultRule;
      
      // Check if requirements are met
      const meetsRequirements = 
        hoursWorked >= activeRule.minHours &&
        milesTraveled >= activeRule.minMiles &&
        distanceFromBase >= activeRule.minDistanceFromBase;

      let amount = 0;
      
      if (meetsRequirements) {
        if (activeRule.useActualAmount) {
          // Use actual expenses up to the maximum
          amount = Math.min(actualExpenses, activeRule.maxAmount);
        } else {
          // Use fixed maximum amount
          amount = activeRule.maxAmount;
        }
      }

      return {
        amount,
        rule: activeRule,
        meetsRequirements
      };
    } catch (error) {
      console.error('❌ PerDiemRules: Error calculating Per Diem:', error);
      return {
        amount: 0,
        rule: null,
        meetsRequirements: false
      };
    }
  }

  /**
   * Store rules locally for offline access
   */
  private static async storeRulesLocally(rules: PerDiemRule[]): Promise<void> {
    try {
      const { getDatabaseConnection } = await import('../utils/databaseConnection');
      const database = await getDatabaseConnection();

      // Clear existing rules
      await database.runAsync('DELETE FROM per_diem_rules');

      // Insert new rules
      for (const rule of rules) {
        await database.runAsync(
          `INSERT INTO per_diem_rules (
            id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase,
            description, useActualAmount, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rule.id,
            rule.costCenter,
            rule.maxAmount,
            rule.minHours,
            rule.minMiles,
            rule.minDistanceFromBase,
            rule.description,
            rule.useActualAmount ? 1 : 0,
            rule.createdAt,
            rule.updatedAt
          ]
        );
      }
    } catch (error) {
      console.error('❌ PerDiemRules: Error storing rules locally:', error);
    }
  }

  /**
   * Get rules from local storage
   */
  private static async getLocalRules(): Promise<PerDiemRule[]> {
    try {
      const { getDatabaseConnection } = await import('../utils/databaseConnection');
      const database = await getDatabaseConnection();

      const rules = await database.getAllAsync(
        'SELECT * FROM per_diem_rules ORDER BY costCenter'
      );
      return rules.map((rule: any) => ({
        id: rule.id,
        costCenter: rule.costCenter,
        maxAmount: rule.maxAmount,
        minHours: rule.minHours,
        minMiles: rule.minMiles,
        minDistanceFromBase: rule.minDistanceFromBase,
        description: rule.description,
        useActualAmount: Boolean(rule.useActualAmount),
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt
      }));
    } catch (error) {
      console.error('❌ PerDiemRules: Error loading local rules:', error);
      return [];
    }
  }

  /**
   * Check if cache is still valid
   */
  private static isCacheValid(): boolean {
    if (!this.lastFetchTime || this.rulesCache.length === 0) {
      return false;
    }
    
    const now = new Date();
    const timeDiff = now.getTime() - this.lastFetchTime.getTime();
    return timeDiff < this.CACHE_DURATION;
  }

  /**
   * Validate Per Diem eligibility and amount for a specific date and employee
   */
  static async validatePerDiem(
    employeeId: string,
    date: Date,
    hoursWorked: number = 0,
    milesDriven: number = 0,
    distanceFromBase: number = 0,
    actualExpenses: number = 0
  ): Promise<{
    isEligible: boolean;
    suggestedAmount: number;
    reason: string;
    confidence: number;
    criteria: {
      hoursWorked: boolean;
      milesDriven: boolean;
      distanceFromBase: boolean;
    };
    details: {
      baseAddress: string;
      hoursWorked: number;
      milesDriven: number;
      distanceFromBase: number;
    };
  }> {
    try {
      // Get employee info to determine cost center
      const { DatabaseService } = await import('./database');
      const employee = await DatabaseService.getEmployeeById(employeeId);
      
      if (!employee) {
        return {
          isEligible: false,
          suggestedAmount: 0,
          reason: 'Employee not found',
          confidence: 0,
          criteria: { hoursWorked: false, milesDriven: false, distanceFromBase: false },
          details: { baseAddress: '', hoursWorked, milesDriven, distanceFromBase }
        };
      }

      // Get employee's cost center
      const costCenter = employee.defaultCostCenter || employee.costCenters?.[0] || 'Program Services';
      
      // Calculate Per Diem using rules
      const perDiemResult = await this.calculatePerDiem(
        costCenter,
        hoursWorked,
        milesDriven,
        distanceFromBase,
        actualExpenses
      );

      const criteria = {
        hoursWorked: hoursWorked >= (perDiemResult.rule?.minHours || 0),
        milesDriven: milesDriven >= (perDiemResult.rule?.minMiles || 0),
        distanceFromBase: distanceFromBase >= (perDiemResult.rule?.minDistanceFromBase || 0)
      };

      const meetsAnyRequirement = criteria.hoursWorked || criteria.milesDriven || criteria.distanceFromBase;
      
      let reason = '';
      if (perDiemResult.meetsRequirements) {
        reason = `Eligible: ${perDiemResult.rule?.useActualAmount ? 'Actual expenses' : 'Fixed amount'} (${perDiemResult.rule?.maxAmount || 35})`;
      } else if (meetsAnyRequirement) {
        reason = `Partially eligible: Some requirements met`;
      } else {
        const rule = perDiemResult.rule;
        if (rule) {
          const requirements = [];
          if (rule.minHours > 0) requirements.push(`${rule.minHours}+ hours`);
          if (rule.minMiles > 0) requirements.push(`${rule.minMiles}+ miles`);
          if (rule.minDistanceFromBase > 0) requirements.push(`${rule.minDistanceFromBase}+ miles from base`);
          reason = `Not eligible: Need ${requirements.join(' OR ')}`;
        } else {
          reason = `Not eligible: No specific rule found for ${costCenter}`;
        }
      }

      const result = {
        isEligible: perDiemResult.meetsRequirements,
        suggestedAmount: perDiemResult.amount,
        reason,
        confidence: perDiemResult.meetsRequirements ? 0.9 : (meetsAnyRequirement ? 0.5 : 0.1),
        criteria,
        details: {
          baseAddress: employee.baseAddress || '',
          hoursWorked,
          milesDriven,
          distanceFromBase
        }
      };

      return result;
    } catch (error) {
      console.error('❌ PerDiemAI: Error validating Per Diem:', error);
      return {
        isEligible: false,
        suggestedAmount: 0,
        reason: 'Error calculating eligibility',
        confidence: 0,
        criteria: { hoursWorked: false, milesDriven: false, distanceFromBase: false },
        details: { baseAddress: '', hoursWorked, milesDriven, distanceFromBase }
      };
    }
  }

  /**
   * Clear cache (useful for testing or forcing refresh)
   */
  static clearCache(): void {
    this.rulesCache = [];
    this.lastFetchTime = null;
  }
}
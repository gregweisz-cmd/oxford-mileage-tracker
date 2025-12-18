import { debugLog, debugError, debugVerbose } from '../config/debug';
import { apiGet, apiPost, apiPut, apiDelete } from './rateLimitedApi';

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
  private static fetchPromise: Promise<PerDiemRule[]> | null = null; // Prevent parallel fetches

  /**
   * Fetch Per Diem rules from backend
   */
  static async fetchPerDiemRules(): Promise<PerDiemRule[]> {
    // If there's already a fetch in progress, wait for it
    if (this.fetchPromise) {
      debugVerbose('📋 PerDiemRules: Fetch already in progress, waiting...');
      return this.fetchPromise;
    }

    // Check cache first
    if (this.isCacheValid()) {
      debugVerbose('📋 PerDiemRules: Using cached rules');
      return this.rulesCache;
    }

    try {
      debugVerbose('📋 PerDiemRules: Fetching rules from backend...');
      
      // Create a promise that will be shared by all callers
      this.fetchPromise = (async () => {
        try {
          const rules = await apiGet<PerDiemRule[]>('/api/per-diem-rules');
          debugVerbose(`✅ PerDiemRules: Fetched ${rules.length} rules from backend`);
          
          // Cache the rules
          this.rulesCache = rules;
          this.lastFetchTime = new Date();
          
          return rules;
        } finally {
          // Clear the promise so future calls can fetch again
          this.fetchPromise = null;
        }
      })();

      return await this.fetchPromise;
    } catch (error) {
      this.fetchPromise = null; // Clear on error
      debugError('❌ PerDiemRules: Error fetching rules from backend:', error);
      // Return cached rules if available, even if expired
      if (this.rulesCache.length > 0) {
        debugVerbose('📋 PerDiemRules: Returning stale cache due to fetch error');
        return this.rulesCache;
      }
      return [];
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
          debugVerbose(`📋 PerDiemRules: Found cached rule for ${costCenter}:`, rule);
          return rule;
        }
      }

      // Fetch from backend if cache is invalid
      await this.fetchPerDiemRules();
      const rule = this.rulesCache.find(r => r.costCenter === costCenter);
      
      if (rule) {
        debugVerbose(`📋 PerDiemRules: Found rule for ${costCenter}:`, rule);
        return rule;
      } else {
        debugVerbose(`📋 PerDiemRules: No specific rule found for ${costCenter}, using defaults`);
        return null;
      }
    } catch (error) {
      debugError('❌ PerDiemRules: Error getting rule for cost center:', error);
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
      debugVerbose(`💰 PerDiemRules: Calculating Per Diem for ${costCenter}:`, {
        hoursWorked,
        milesTraveled,
        distanceFromBase,
        actualExpenses
      });

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
      // Note: stayedOvernight check is handled at the caller level (StaffPortal)
      // This service checks the rule-based requirements (hours, miles, distance)
      const meetsRequirements = 
        hoursWorked >= activeRule.minHours &&
        milesTraveled >= activeRule.minMiles &&
        distanceFromBase >= activeRule.minDistanceFromBase;

      let amount = 0;
      
      if (meetsRequirements) {
        if (activeRule.useActualAmount) {
          // Use actual expenses up to the maximum
          amount = Math.min(actualExpenses, activeRule.maxAmount);
          debugVerbose(`💰 PerDiemRules: Using actual amount ${actualExpenses}, capped at ${activeRule.maxAmount} = ${amount}`);
        } else {
          // Use fixed maximum amount
          amount = activeRule.maxAmount;
          debugVerbose(`💰 PerDiemRules: Using fixed amount ${amount}`);
        }
      } else {
        debugVerbose(`💰 PerDiemRules: Requirements not met:`, {
          hoursWorked: `${hoursWorked} >= ${activeRule.minHours}`,
          milesTraveled: `${milesTraveled} >= ${activeRule.minMiles}`,
          distanceFromBase: `${distanceFromBase} >= ${activeRule.minDistanceFromBase}`
        });
      }

      const result = {
        amount,
        rule: activeRule,
        meetsRequirements
      };

      debugVerbose(`💰 PerDiemRules: Calculated Per Diem:`, result);
      return result;
    } catch (error) {
      debugError('❌ PerDiemRules: Error calculating Per Diem:', error);
      return {
        amount: 0,
        rule: null,
        meetsRequirements: false
      };
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
   * Clear cache (useful for testing or forcing refresh)
   */
  static clearCache(): void {
    this.rulesCache = [];
    this.lastFetchTime = null;
    debugVerbose('🗑️ PerDiemRules: Cache cleared');
  }

  /**
   * Get Per Diem rules by cost center name
   */
  static async getRulesByCostCenter(costCenter: string): Promise<PerDiemRule | null> {
    return this.getPerDiemRule(costCenter);
  }

  /**
   * Save or update Per Diem rules
   */
  static async saveRules(rules: Partial<PerDiemRule> & { costCenter: string }): Promise<PerDiemRule> {
    try {
      debugVerbose('💾 PerDiemRules: Saving rules:', rules);
      
      // Check if rules already exist for this cost center
      const existingRules = await this.getRulesByCostCenter(rules.costCenter);
      
      const savedRules = existingRules
        ? await apiPut<PerDiemRule>(`/api/per-diem-rules/${existingRules.id}`, rules)
        : await apiPost<PerDiemRule>(`/api/per-diem-rules`, rules);
      debugVerbose('✅ PerDiemRules: Rules saved successfully:', savedRules);
      
      // Clear cache to force refresh
      this.clearCache();
      
      return savedRules;
    } catch (error) {
      debugError('❌ PerDiemRules: Error saving rules:', error);
      throw error;
    }
  }

  /**
   * Get all Per Diem rules
   */
  static async getAllRules(): Promise<PerDiemRule[]> {
    if (this.isCacheValid()) {
      return this.rulesCache;
    }
    return this.fetchPerDiemRules();
  }

  /**
   * Delete Per Diem rules
   */
  static async deleteRules(id: string): Promise<void> {
    try {
      await apiDelete(`/api/per-diem-rules/${id}`);
      debugVerbose('✅ PerDiemRules: Rules deleted successfully');
      this.clearCache();
    } catch (error) {
      debugError('❌ PerDiemRules: Error deleting rules:', error);
      throw error;
    }
  }
}

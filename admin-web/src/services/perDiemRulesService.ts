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
      console.log('📋 PerDiemRules: Fetching rules from backend...');
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/per-diem-rules`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch per diem rules: ${response.status} ${response.statusText}`);
      }

      const rules = await response.json();
      console.log(`✅ PerDiemRules: Fetched ${rules.length} rules from backend`);
      
      // Cache the rules
      this.rulesCache = rules;
      this.lastFetchTime = new Date();
      
      return rules;
    } catch (error) {
      console.error('❌ PerDiemRules: Error fetching rules from backend:', error);
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
          console.log(`📋 PerDiemRules: Found cached rule for ${costCenter}:`, rule);
          return rule;
        }
      }

      // Fetch from backend if cache is invalid
      await this.fetchPerDiemRules();
      const rule = this.rulesCache.find(r => r.costCenter === costCenter);
      
      if (rule) {
        console.log(`📋 PerDiemRules: Found rule for ${costCenter}:`, rule);
        return rule;
      } else {
        console.log(`📋 PerDiemRules: No specific rule found for ${costCenter}, using defaults`);
        return null;
      }
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
      console.log(`💰 PerDiemRules: Calculating Per Diem for ${costCenter}:`, {
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
      const meetsRequirements = 
        hoursWorked >= activeRule.minHours &&
        milesTraveled >= activeRule.minMiles &&
        distanceFromBase >= activeRule.minDistanceFromBase;

      let amount = 0;
      
      if (meetsRequirements) {
        if (activeRule.useActualAmount) {
          // Use actual expenses up to the maximum
          amount = Math.min(actualExpenses, activeRule.maxAmount);
          console.log(`💰 PerDiemRules: Using actual amount ${actualExpenses}, capped at ${activeRule.maxAmount} = ${amount}`);
        } else {
          // Use fixed maximum amount
          amount = activeRule.maxAmount;
          console.log(`💰 PerDiemRules: Using fixed amount ${amount}`);
        }
      } else {
        console.log(`💰 PerDiemRules: Requirements not met:`, {
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

      console.log(`💰 PerDiemRules: Calculated Per Diem:`, result);
      return result;
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
    console.log('🗑️ PerDiemRules: Cache cleared');
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
      console.log('💾 PerDiemRules: Saving rules:', rules);
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002';
      
      // Check if rules already exist for this cost center
      const existingRules = await this.getRulesByCostCenter(rules.costCenter);
      
      const endpoint = existingRules 
        ? `${apiUrl}/api/per-diem-rules/${existingRules.id}`
        : `${apiUrl}/api/per-diem-rules`;
      
      const method = existingRules ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rules)
      });

      if (!response.ok) {
        throw new Error(`Failed to save Per Diem rules: ${response.status} ${response.statusText}`);
      }

      const savedRules = await response.json();
      console.log('✅ PerDiemRules: Rules saved successfully:', savedRules);
      
      // Clear cache to force refresh
      this.clearCache();
      
      return savedRules;
    } catch (error) {
      console.error('❌ PerDiemRules: Error saving rules:', error);
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
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/per-diem-rules/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete Per Diem rules: ${response.status}`);
      }

      console.log('✅ PerDiemRules: Rules deleted successfully');
      this.clearCache();
    } catch (error) {
      console.error('❌ PerDiemRules: Error deleting rules:', error);
      throw error;
    }
  }
}

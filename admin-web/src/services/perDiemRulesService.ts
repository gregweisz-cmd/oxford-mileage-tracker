import { debugError, debugVerbose } from '../config/debug';
import { apiGet, apiPost, apiPut, apiDelete } from './rateLimitedApi';
import {
  evaluatePerDiemDay,
  getMaxDailyAmount,
  PerDiemDayInput,
  PerDiemDayEvaluation,
  PerDiemRuleConfig,
  PerDiemRuleType,
  PerDiemTier,
} from '../utils/perDiemTierEvaluator';

export interface PerDiemRule {
  id: string;
  costCenter: string;
  maxAmount: number;
  minHours: number;
  minMiles: number;
  minDistanceFromBase: number;
  description: string;
  useActualAmount: boolean;
  ruleType: PerDiemRuleType;
  tiers: PerDiemTier[];
  createdAt: string;
  updatedAt: string;
}

export class PerDiemRulesService {
  private static rulesCache: PerDiemRule[] = [];
  private static lastFetchTime: Date | null = null;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static fetchPromise: Promise<PerDiemRule[]> | null = null;

  private static normalizeCostCenter(value: string): string {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private static mapRule(rule: any): PerDiemRule {
    return {
      id: rule.id,
      costCenter: rule.costCenter,
      maxAmount: rule.maxAmount != null ? Number(rule.maxAmount) : 35,
      minHours: Number(rule.minHours ?? 0),
      minMiles: Number(rule.minMiles ?? 0),
      minDistanceFromBase: Number(rule.minDistanceFromBase ?? 0),
      description: rule.description || '',
      useActualAmount: Boolean(rule.useActualAmount),
      ruleType: rule.ruleType === 'tiered' ? 'tiered' : 'single',
      tiers: Array.isArray(rule.tiers)
        ? rule.tiers.map((tier: any) => ({
            id: tier.id,
            costCenter: tier.costCenter,
            label: tier.label,
            amount: Number(tier.amount),
            minHours: Number(tier.minHours),
            minMiles: Number(tier.minMiles),
            minDistanceFromBase: Number(tier.minDistanceFromBase),
            requiresOvernight: Boolean(tier.requiresOvernight),
            sortOrder: Number(tier.sortOrder),
          }))
        : [],
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  private static toRuleConfig(rule: PerDiemRule | null, costCenter: string): PerDiemRuleConfig {
    if (!rule) {
      return {
        costCenter,
        maxAmount: 35,
        minHours: 8,
        minMiles: 100,
        minDistanceFromBase: 0,
        ruleType: 'single',
        useActualAmount: false,
      };
    }
    return {
      id: rule.id,
      costCenter: rule.costCenter,
      maxAmount: rule.maxAmount,
      minHours: rule.minHours,
      minMiles: rule.minMiles,
      minDistanceFromBase: rule.minDistanceFromBase,
      useActualAmount: rule.useActualAmount,
      ruleType: rule.ruleType,
      tiers: rule.tiers,
    };
  }

  static async fetchPerDiemRules(): Promise<PerDiemRule[]> {
    if (this.fetchPromise) {
      debugVerbose('📋 PerDiemRules: Fetch already in progress, waiting...');
      return this.fetchPromise;
    }

    if (this.isCacheValid()) {
      debugVerbose('📋 PerDiemRules: Using cached rules');
      return this.rulesCache;
    }

    try {
      debugVerbose('📋 PerDiemRules: Fetching rules from backend...');

      this.fetchPromise = (async () => {
        try {
          const rules = await apiGet<any[]>('/api/per-diem-rules');
          debugVerbose(`✅ PerDiemRules: Fetched ${rules.length} rules from backend`);

          this.rulesCache = rules.map((rule) => this.mapRule(rule));
          this.lastFetchTime = new Date();

          return this.rulesCache;
        } finally {
          this.fetchPromise = null;
        }
      })();

      return await this.fetchPromise;
    } catch (error) {
      this.fetchPromise = null;
      debugError('❌ PerDiemRules: Error fetching rules from backend:', error);
      if (this.rulesCache.length > 0) {
        debugVerbose('📋 PerDiemRules: Returning stale cache due to fetch error');
        return this.rulesCache;
      }
      return [];
    }
  }

  static async getPerDiemRule(costCenter: string): Promise<PerDiemRule | null> {
    try {
      const normalizedCostCenter = this.normalizeCostCenter(costCenter);
      if (this.isCacheValid()) {
        const rule = this.rulesCache.find(
          (r) => this.normalizeCostCenter(r.costCenter) === normalizedCostCenter
        );
        if (rule) return rule;
      }

      await this.fetchPerDiemRules();
      return (
        this.rulesCache.find(
          (r) => this.normalizeCostCenter(r.costCenter) === normalizedCostCenter
        ) || null
      );
    } catch (error) {
      debugError('❌ PerDiemRules: Error getting rule for cost center:', error);
      return null;
    }
  }

  static evaluateDay(
    rule: PerDiemRule | null,
    costCenter: string,
    input: PerDiemDayInput
  ): PerDiemDayEvaluation {
    return evaluatePerDiemDay(this.toRuleConfig(rule, costCenter), input);
  }

  static getDailyMaxAmount(rule: PerDiemRule | null): number {
    return getMaxDailyAmount(this.toRuleConfig(rule, rule?.costCenter || ''));
  }

  static async calculatePerDiem(
    costCenter: string,
    hoursWorked: number = 0,
    milesTraveled: number = 0,
    distanceFromBase: number = 0,
    actualExpenses: number = 0,
    stayedOvernight: boolean = false
  ): Promise<{
    amount: number;
    rule: PerDiemRule | null;
    meetsRequirements: boolean;
    tierLabel: string | null;
    reason: string;
  }> {
    try {
      const rule = await this.getPerDiemRule(costCenter);
      const evaluation = this.evaluateDay(rule, costCenter, {
        hoursWorked,
        milesTraveled,
        distanceFromBase,
        stayedOvernight,
        actualExpenses,
      });

      return {
        amount: evaluation.amount,
        rule,
        meetsRequirements: evaluation.isEligible,
        tierLabel: evaluation.tierLabel,
        reason: evaluation.reason,
      };
    } catch (error) {
      debugError('❌ PerDiemRules: Error calculating Per Diem:', error);
      return {
        amount: 0,
        rule: null,
        meetsRequirements: false,
        tierLabel: null,
        reason: 'Error calculating per diem',
      };
    }
  }

  private static isCacheValid(): boolean {
    if (!this.lastFetchTime || this.rulesCache.length === 0) {
      return false;
    }
    const now = new Date();
    const timeDiff = now.getTime() - this.lastFetchTime.getTime();
    return timeDiff < this.CACHE_DURATION;
  }

  static clearCache(): void {
    this.rulesCache = [];
    this.lastFetchTime = null;
    debugVerbose('🗑️ PerDiemRules: Cache cleared');
  }

  static async getRulesByCostCenter(costCenter: string): Promise<PerDiemRule | null> {
    return this.getPerDiemRule(costCenter);
  }

  static async saveRules(
    rules: Partial<PerDiemRule> & { costCenter: string; tiers?: PerDiemTier[] }
  ): Promise<PerDiemRule> {
    try {
      debugVerbose('💾 PerDiemRules: Saving rules:', rules);

      const existingRules = await this.getRulesByCostCenter(rules.costCenter);
      const payload = {
        ...rules,
        ruleType: rules.ruleType === 'tiered' ? 'tiered' : 'single',
        tiers: rules.ruleType === 'tiered' ? rules.tiers || [] : [],
      };

      const savedRules = existingRules
        ? await apiPut<any>(`/api/per-diem-rules/${existingRules.id}`, payload)
        : await apiPost<any>(`/api/per-diem-rules`, payload);
      debugVerbose('✅ PerDiemRules: Rules saved successfully:', savedRules);

      this.clearCache();
      return this.mapRule(savedRules);
    } catch (error) {
      debugError('❌ PerDiemRules: Error saving rules:', error);
      throw error;
    }
  }

  static async getAllRules(): Promise<PerDiemRule[]> {
    if (this.isCacheValid()) {
      return this.rulesCache;
    }
    return this.fetchPerDiemRules();
  }

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

export type { PerDiemDayInput, PerDiemDayEvaluation, PerDiemTier };

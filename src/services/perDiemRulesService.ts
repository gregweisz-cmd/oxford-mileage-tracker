import { DatabaseService } from './database';
import { debugLog, debugError } from '../config/debug';
import { API_BASE_URL } from '../config/api';
import { getAuthHeaders } from './authHeaders';
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
  private static CACHE_DURATION = 5 * 60 * 1000;
  private static fetchInFlight: Promise<PerDiemRule[]> | null = null;
  private static readonly FETCH_TIMEOUT_MS = 12000;

  private static normalizeCostCenter(value: string | null | undefined): string {
    if (!value) return '';
    return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private static mapRule(rule: any): PerDiemRule {
    return {
      id: rule.id,
      costCenter: rule.costCenter,
      maxAmount: Number(rule.maxAmount ?? 35),
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
    if (this.fetchInFlight) return this.fetchInFlight;
    const promise = this.doFetchPerDiemRules();
    this.fetchInFlight = promise;
    try {
      return await promise;
    } finally {
      this.fetchInFlight = null;
    }
  }

  private static async doFetchPerDiemRules(): Promise<PerDiemRule[]> {
    try {
      debugLog('📋 PerDiemRules: Fetching rules from backend...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);
      const response = await fetch(`${API_BASE_URL}/per-diem-rules`, {
        method: 'GET',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch per diem rules: ${response.status} ${response.statusText}`);
      }

      const rules = await response.json();
      this.rulesCache = rules.map((rule: any) => this.mapRule(rule));
      this.lastFetchTime = new Date();
      await this.storeRulesLocally(this.rulesCache);
      return this.rulesCache;
    } catch (error) {
      console.error('❌ PerDiemRules: Error fetching rules from backend:', error);
      const local = await this.getLocalRules();
      this.rulesCache = local;
      this.lastFetchTime = new Date();
      return local;
    }
  }

  static async getPerDiemRule(costCenter: string): Promise<PerDiemRule | null> {
    try {
      const normalizedTarget = this.normalizeCostCenter(costCenter);
      const findMatchingRule = (rules: PerDiemRule[]): PerDiemRule | undefined =>
        rules.find((r) => this.normalizeCostCenter(r.costCenter) === normalizedTarget);

      if (this.isCacheValid()) {
        const rule = findMatchingRule(this.rulesCache);
        if (rule) return rule;
      }

      await this.fetchPerDiemRules();
      return findMatchingRule(this.rulesCache) || null;
    } catch (error) {
      console.error('❌ PerDiemRules: Error getting rule for cost center:', error);
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
      console.error('❌ PerDiemRules: Error calculating Per Diem:', error);
      return {
        amount: 0,
        rule: null,
        meetsRequirements: false,
        tierLabel: null,
        reason: 'Error calculating per diem',
      };
    }
  }

  private static async storeRulesLocally(rules: PerDiemRule[]): Promise<void> {
    try {
      const { withDatabaseConnection } = await import('../utils/databaseConnection');

      await withDatabaseConnection(async (database) => {
        for (const rule of rules) {
          await database.runAsync(
            `INSERT OR REPLACE INTO per_diem_rules (
            id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase,
            description, useActualAmount, ruleType, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              rule.id,
              rule.costCenter,
              rule.maxAmount,
              rule.minHours,
              rule.minMiles,
              rule.minDistanceFromBase,
              rule.description,
              rule.useActualAmount ? 1 : 0,
              rule.ruleType || 'single',
              rule.createdAt,
              rule.updatedAt,
            ]
          );
        }

        const ruleIds = rules.map((r) => r.id);
        if (ruleIds.length > 0) {
          const placeholders = ruleIds.map(() => '?').join(',');
          await database.runAsync(
            `DELETE FROM per_diem_rules WHERE id NOT IN (${placeholders})`,
            ruleIds
          );
        }

        await database.runAsync('DELETE FROM per_diem_tiers');
        for (const rule of rules) {
          for (const tier of rule.tiers || []) {
            await database.runAsync(
              `INSERT OR REPLACE INTO per_diem_tiers (
                id, costCenter, label, amount, minHours, minMiles, minDistanceFromBase,
                requiresOvernight, sortOrder, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                tier.id,
                tier.costCenter,
                tier.label,
                tier.amount,
                tier.minHours,
                tier.minMiles,
                tier.minDistanceFromBase,
                tier.requiresOvernight ? 1 : 0,
                tier.sortOrder,
                rule.createdAt,
                rule.updatedAt,
              ]
            );
          }
        }
      });
    } catch (error) {
      console.error('❌ PerDiemRules: Error storing rules locally:', error);
    }
  }

  private static async getLocalRules(): Promise<PerDiemRule[]> {
    try {
      const { withDatabaseConnection } = await import('../utils/databaseConnection');

      return await withDatabaseConnection(async (database) => {
        const rules = await database.getAllAsync('SELECT * FROM per_diem_rules ORDER BY costCenter');
        const tiers = await database.getAllAsync('SELECT * FROM per_diem_tiers ORDER BY sortOrder DESC');

        const tiersByCostCenter = new Map<string, PerDiemTier[]>();
        for (const tier of tiers as any[]) {
          const list = tiersByCostCenter.get(tier.costCenter) || [];
          list.push({
            id: tier.id,
            costCenter: tier.costCenter,
            label: tier.label,
            amount: Number(tier.amount),
            minHours: Number(tier.minHours),
            minMiles: Number(tier.minMiles),
            minDistanceFromBase: Number(tier.minDistanceFromBase),
            requiresOvernight: Boolean(tier.requiresOvernight),
            sortOrder: Number(tier.sortOrder),
          });
          tiersByCostCenter.set(tier.costCenter, list);
        }

        return (rules as any[]).map((rule) => ({
          id: rule.id,
          costCenter: rule.costCenter,
          maxAmount: rule.maxAmount,
          minHours: rule.minHours,
          minMiles: rule.minMiles,
          minDistanceFromBase: rule.minDistanceFromBase,
          description: rule.description,
          useActualAmount: Boolean(rule.useActualAmount),
          ruleType: rule.ruleType === 'tiered' ? 'tiered' : 'single',
          tiers: tiersByCostCenter.get(rule.costCenter) || [],
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
        }));
      });
    } catch (error) {
      console.error('❌ PerDiemRules: Error loading local rules:', error);
      return [];
    }
  }

  private static isCacheValid(): boolean {
    if (!this.lastFetchTime || this.rulesCache.length === 0) return false;
    const now = new Date();
    return now.getTime() - this.lastFetchTime.getTime() < this.CACHE_DURATION;
  }

  static async validatePerDiem(
    employeeId: string,
    date: Date,
    hoursWorked: number = 0,
    milesDriven: number = 0,
    distanceFromBase: number = 0,
    actualExpenses: number = 0,
    stayedOvernight: boolean = false
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
      const employee = await DatabaseService.getEmployeeById(employeeId);
      if (!employee) {
        return {
          isEligible: false,
          suggestedAmount: 0,
          reason: 'Employee not found',
          confidence: 0,
          criteria: { hoursWorked: false, milesDriven: false, distanceFromBase: false },
          details: { baseAddress: '', hoursWorked, milesDriven, distanceFromBase },
        };
      }

      const costCenter = employee.defaultCostCenter || employee.costCenters?.[0] || 'Program Services';
      const perDiemResult = await this.calculatePerDiem(
        costCenter,
        hoursWorked,
        milesDriven,
        distanceFromBase,
        actualExpenses,
        stayedOvernight
      );

      const rule = perDiemResult.rule;
      const criteria = {
        hoursWorked: hoursWorked >= (rule?.minHours || 0),
        milesDriven: milesDriven >= (rule?.minMiles || 0),
        distanceFromBase: distanceFromBase >= (rule?.minDistanceFromBase || 0),
      };

      return {
        isEligible: perDiemResult.meetsRequirements,
        suggestedAmount: perDiemResult.amount,
        reason: perDiemResult.reason,
        confidence: perDiemResult.meetsRequirements ? 0.9 : 0.1,
        criteria,
        details: {
          baseAddress: employee.baseAddress || '',
          hoursWorked,
          milesDriven,
          distanceFromBase,
        },
      };
    } catch (error) {
      console.error('❌ PerDiemRules: Error validating Per Diem:', error);
      return {
        isEligible: false,
        suggestedAmount: 0,
        reason: 'Error calculating eligibility',
        confidence: 0,
        criteria: { hoursWorked: false, milesDriven: false, distanceFromBase: false },
        details: { baseAddress: '', hoursWorked, milesDriven, distanceFromBase },
      };
    }
  }

  static clearCache(): void {
    this.rulesCache = [];
    this.lastFetchTime = null;
  }

  static async getAllRules(): Promise<PerDiemRule[]> {
    return this.fetchPerDiemRules();
  }

  static async updateRule(costCenter: string, rule: Partial<PerDiemRule>): Promise<void> {
    const rules = await this.fetchPerDiemRules();
    const normalizedTarget = this.normalizeCostCenter(costCenter);
    const now = new Date().toISOString();
    const existing = rules.find((r) => this.normalizeCostCenter(r.costCenter) === normalizedTarget);

    const nextRule: PerDiemRule = {
      id: existing?.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      costCenter: (rule.costCenter || existing?.costCenter || costCenter || '').trim(),
      maxAmount: Number(rule.maxAmount ?? existing?.maxAmount ?? 35),
      minHours: Number(rule.minHours ?? existing?.minHours ?? 0),
      minMiles: Number(rule.minMiles ?? existing?.minMiles ?? 0),
      minDistanceFromBase: Number(rule.minDistanceFromBase ?? existing?.minDistanceFromBase ?? 0),
      description: String(rule.description ?? existing?.description ?? '').trim(),
      useActualAmount: Boolean(rule.useActualAmount ?? existing?.useActualAmount ?? false),
      ruleType: rule.ruleType ?? existing?.ruleType ?? 'single',
      tiers: rule.tiers ?? existing?.tiers ?? [],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const nextRules = existing
      ? rules.map((r) => (this.normalizeCostCenter(r.costCenter) === normalizedTarget ? nextRule : r))
      : [...rules, nextRule];

    this.rulesCache = nextRules;
    this.lastFetchTime = new Date();
    await this.storeRulesLocally(nextRules);
  }

  static async deleteRule(costCenter: string): Promise<void> {
    const normalizedTarget = this.normalizeCostCenter(costCenter);
    const rules = await this.fetchPerDiemRules();
    const nextRules = rules.filter((r) => this.normalizeCostCenter(r.costCenter) !== normalizedTarget);
    this.rulesCache = nextRules;
    this.lastFetchTime = new Date();
    await this.storeRulesLocally(nextRules);
  }
}

export type { PerDiemDayInput, PerDiemDayEvaluation, PerDiemTier };

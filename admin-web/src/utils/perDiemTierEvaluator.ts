export type PerDiemRuleType = 'single' | 'tiered';

export interface PerDiemTier {
  id: string;
  costCenter: string;
  label: string;
  amount: number;
  minHours: number;
  minMiles: number;
  minDistanceFromBase: number;
  requiresOvernight: boolean;
  sortOrder: number;
}

export interface PerDiemRuleConfig {
  id?: string;
  costCenter: string;
  ruleType?: PerDiemRuleType;
  maxAmount: number;
  minHours: number;
  minMiles: number;
  minDistanceFromBase: number;
  useActualAmount?: boolean;
  tiers?: PerDiemTier[];
}

export interface PerDiemDayInput {
  hoursWorked: number;
  milesTraveled: number;
  distanceFromBase: number;
  stayedOvernight: boolean;
  actualExpenses?: number;
}

export interface PerDiemDayEvaluation {
  isEligible: boolean;
  amount: number;
  tierLabel: string | null;
  reason: string;
  ruleType: PerDiemRuleType;
}

export const ARIZONA_TIER_TEMPLATE: Omit<PerDiemTier, 'id' | 'costCenter'>[] = [
  {
    label: 'Overnight',
    amount: 35,
    minHours: 8,
    minMiles: 0,
    minDistanceFromBase: 100,
    requiresOvernight: true,
    sortOrder: 300,
  },
  {
    label: 'Extended Day',
    amount: 32,
    minHours: 12,
    minMiles: 100,
    minDistanceFromBase: 0,
    requiresOvernight: false,
    sortOrder: 200,
  },
  {
    label: 'Single Day',
    amount: 17,
    minHours: 8,
    minMiles: 100,
    minDistanceFromBase: 0,
    requiresOvernight: false,
    sortOrder: 100,
  },
];

function tierMatches(tier: PerDiemTier, input: PerDiemDayInput): boolean {
  if (tier.requiresOvernight && !input.stayedOvernight) return false;
  if (input.hoursWorked < tier.minHours) return false;
  if (tier.minMiles > 0 && input.milesTraveled < tier.minMiles) return false;
  if (tier.minDistanceFromBase > 0 && input.distanceFromBase < tier.minDistanceFromBase) return false;
  return true;
}

function evaluateTiered(
  tiers: PerDiemTier[],
  input: PerDiemDayInput
): PerDiemDayEvaluation {
  const sorted = [...tiers].sort((a, b) => b.sortOrder - a.sortOrder || b.amount - a.amount);

  for (const tier of sorted) {
    if (tierMatches(tier, input)) {
      return {
        isEligible: true,
        amount: tier.amount,
        tierLabel: tier.label,
        reason: `${tier.label}: $${tier.amount.toFixed(2)}`,
        ruleType: 'tiered',
      };
    }
  }

  const topTier = sorted[0];
  const parts: string[] = [];
  if (topTier) {
    if (input.hoursWorked < (sorted.find((t) => t.minHours > 0)?.minHours ?? 8)) {
      parts.push(`need ${sorted.find((t) => t.minHours > 0)?.minHours ?? 8}+ hours`);
    }
    if (!input.stayedOvernight && sorted.some((t) => t.requiresOvernight)) {
      parts.push('overnight requires stayed overnight + 8h + 100+ mi from BA');
    }
    if (input.milesTraveled < 100) {
      parts.push('need 100+ miles driven for day tiers');
    }
  }

  return {
    isEligible: false,
    amount: 0,
    tierLabel: null,
    reason: parts.length > 0 ? parts.join('; ') : 'No tier matched',
    ruleType: 'tiered',
  };
}

function evaluateSingle(
  rule: PerDiemRuleConfig,
  input: PerDiemDayInput
): PerDiemDayEvaluation {
  const minHours = rule.minHours ?? 0;
  const minMiles = rule.minMiles ?? 0;
  const minDistance = rule.minDistanceFromBase ?? 0;

  const meetsHours = input.hoursWorked >= minHours;
  const meetsMiles = minMiles === 0 || input.milesTraveled >= minMiles || input.stayedOvernight;
  const meetsDistance =
    minDistance === 0 || input.distanceFromBase >= minDistance || input.stayedOvernight;

  const isEligible = meetsHours && meetsMiles && meetsDistance;

  let amount = 0;
  if (isEligible) {
    if (rule.useActualAmount) {
      amount = Math.min(input.actualExpenses ?? 0, rule.maxAmount);
    } else {
      amount = rule.maxAmount;
    }
  }

  let reason = '';
  if (isEligible) {
    reason = rule.useActualAmount
      ? `Eligible: actual expenses up to $${rule.maxAmount.toFixed(2)}`
      : `Eligible: $${rule.maxAmount.toFixed(2)}`;
  } else if (!meetsHours) {
    reason = `Need ${minHours}+ hours (have ${input.hoursWorked.toFixed(1)}h)`;
  } else if (!meetsMiles) {
    reason = `Need ${minMiles}+ miles or overnight (have ${input.milesTraveled.toFixed(0)} mi)`;
  } else if (!meetsDistance) {
    reason = `Need ${minDistance}+ miles from base or overnight`;
  } else {
    reason = 'Not eligible';
  }

  return {
    isEligible,
    amount,
    tierLabel: null,
    reason,
    ruleType: 'single',
  };
}

export function evaluatePerDiemDay(
  rule: PerDiemRuleConfig,
  input: PerDiemDayInput
): PerDiemDayEvaluation {
  const ruleType = rule.ruleType ?? 'single';
  const tiers = rule.tiers ?? [];

  if (ruleType === 'tiered' && tiers.length > 0) {
    return evaluateTiered(tiers, input);
  }

  return evaluateSingle(rule, input);
}

export function getMaxDailyAmount(rule: PerDiemRuleConfig): number {
  if (rule.ruleType === 'tiered' && rule.tiers && rule.tiers.length > 0) {
    return Math.max(...rule.tiers.map((t) => t.amount));
  }
  return rule.maxAmount ?? 35;
}

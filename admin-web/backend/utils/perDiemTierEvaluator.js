/**
 * Shared per diem tier evaluation logic (backend mirror of admin-web/src/utils/perDiemTierEvaluator.ts)
 */

const ARIZONA_TIER_TEMPLATE = [
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

function tierMatches(tier, input) {
  if (tier.requiresOvernight && !input.stayedOvernight) return false;
  if (input.hoursWorked < tier.minHours) return false;
  if (tier.minMiles > 0 && input.milesTraveled < tier.minMiles) return false;
  if (tier.minDistanceFromBase > 0 && input.distanceFromBase < tier.minDistanceFromBase) return false;
  return true;
}

function evaluateTiered(tiers, input) {
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

  return {
    isEligible: false,
    amount: 0,
    tierLabel: null,
    reason: 'No tier matched',
    ruleType: 'tiered',
  };
}

function evaluateSingle(rule, input) {
  if ((rule.maxAmount ?? 0) === 0 && !rule.useActualAmount) {
    return {
      isEligible: false,
      amount: 0,
      tierLabel: null,
      reason: 'No per diem for this cost center',
      ruleType: 'single',
    };
  }

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

  let reason = 'Not eligible';
  if (isEligible) {
    reason = rule.useActualAmount
      ? `Eligible: actual expenses up to $${rule.maxAmount.toFixed(2)}`
      : `Eligible: $${rule.maxAmount.toFixed(2)}`;
  } else if (!meetsHours) {
    reason = `Need ${minHours}+ hours`;
  } else if (!meetsMiles) {
    reason = `Need ${minMiles}+ miles or overnight`;
  } else if (!meetsDistance) {
    reason = `Need ${minDistance}+ miles from base or overnight`;
  }

  return {
    isEligible,
    amount,
    tierLabel: null,
    reason,
    ruleType: 'single',
  };
}

function evaluatePerDiemDay(rule, input) {
  const ruleType = rule.ruleType || 'single';
  const tiers = rule.tiers || [];

  if (ruleType === 'tiered' && tiers.length > 0) {
    return evaluateTiered(tiers, input);
  }

  return evaluateSingle(rule, input);
}

function getMaxDailyAmount(rule) {
  if ((rule.maxAmount ?? 0) === 0 && !rule.useActualAmount && rule.ruleType !== 'tiered') {
    return 0;
  }
  if (rule.ruleType === 'tiered' && rule.tiers && rule.tiers.length > 0) {
    return Math.max(...rule.tiers.map((t) => t.amount));
  }
  return rule.maxAmount ?? 35;
}

function normalizeTierRow(row) {
  return {
    id: row.id,
    costCenter: row.costCenter,
    label: row.label,
    amount: Number(row.amount),
    minHours: Number(row.minHours),
    minMiles: Number(row.minMiles),
    minDistanceFromBase: Number(row.minDistanceFromBase),
    requiresOvernight: Boolean(row.requiresOvernight),
    sortOrder: Number(row.sortOrder),
  };
}

module.exports = {
  ARIZONA_TIER_TEMPLATE,
  evaluatePerDiemDay,
  getMaxDailyAmount,
  normalizeTierRow,
};

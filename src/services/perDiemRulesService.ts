import { DatabaseService } from './database';

export interface PerDiemRule {
  costCenter: string;
  maxAmount: number;
  minHours: number;
  minMiles: number;
  minDistanceFromBase: number;
  description: string;
}

export class PerDiemRulesService {
  private static rules: PerDiemRule[] = [
    {
      costCenter: 'CC001', // Default cost center
      maxAmount: 35,
      minHours: 8,
      minMiles: 100,
      minDistanceFromBase: 50,
      description: 'Standard per diem rules'
    },
    {
      costCenter: 'CC002', // Example: Management cost center
      maxAmount: 40,
      minHours: 8,
      minMiles: 75,
      minDistanceFromBase: 40,
      description: 'Management per diem rules'
    },
    {
      costCenter: 'CC003', // Example: Field operations
      maxAmount: 45,
      minHours: 6,
      minMiles: 50,
      minDistanceFromBase: 25,
      description: 'Field operations per diem rules'
    }
  ];

  static getRuleForCostCenter(costCenter: string): PerDiemRule {
    return this.rules.find(rule => rule.costCenter === costCenter) || this.rules[0];
  }

  static getAllRules(): PerDiemRule[] {
    return [...this.rules];
  }

  static updateRule(costCenter: string, updatedRule: Partial<PerDiemRule>): void {
    const index = this.rules.findIndex(rule => rule.costCenter === costCenter);
    if (index !== -1) {
      this.rules[index] = { ...this.rules[index], ...updatedRule };
    } else {
      // Add new rule
      this.rules.push({
        costCenter,
        maxAmount: 35,
        minHours: 8,
        minMiles: 100,
        minDistanceFromBase: 50,
        description: 'Custom per diem rules',
        ...updatedRule
      });
    }
  }

  static deleteRule(costCenter: string): boolean {
    const index = this.rules.findIndex(rule => rule.costCenter === costCenter);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  static async validatePerDiem(
    employeeId: string,
    costCenter: string,
    amount: number,
    date: Date
  ): Promise<{
    isValid: boolean;
    rule: PerDiemRule;
    validationResults: {
      meetsAmountLimit: boolean;
      meetsHourRequirement: boolean;
      meetsDistanceRequirement: boolean;
      totalMiles: number;
      totalHours: number;
    };
    message: string;
  }> {
    const rule = this.getRuleForCostCenter(costCenter);

    // Get daily mileage entries for the same date
    const dailyMileageEntries = await DatabaseService.getMileageEntries(
      employeeId,
      date.getMonth() + 1,
      date.getFullYear()
    );

    const dayMileage = dailyMileageEntries.filter(entry => 
      new Date(entry.date).getDate() === date.getDate()
    );

    const totalMiles = dayMileage.reduce((sum, entry) => sum + entry.miles, 0);
    const totalHours = dayMileage.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0);

    // Calculate distance from base address (simplified)
    const isMoreThanDistanceFromBase = totalMiles > rule.minDistanceFromBase;
    const hasWorkedRequiredHours = totalHours >= rule.minHours;
    const meetsAmountLimit = amount <= rule.maxAmount;
    const meetsDistanceRequirement = totalMiles > rule.minMiles || isMoreThanDistanceFromBase;

    const isValid = meetsAmountLimit && hasWorkedRequiredHours && meetsDistanceRequirement;

    const message = `
Per Diem Rules for ${costCenter} (${rule.description}):

• Maximum per day: $${rule.maxAmount}
• Must work ${rule.minHours}+ hours: ${hasWorkedRequiredHours ? '✅' : '❌'} (${totalHours.toFixed(1)} hours)
• Must drive ${rule.minMiles}+ miles OR be ${rule.minDistanceFromBase}+ miles from base: ${meetsDistanceRequirement ? '✅' : '❌'} (${totalMiles.toFixed(1)} miles)

Current entry: $${amount.toFixed(2)}
${meetsAmountLimit ? '✅ Within limit' : '❌ Exceeds maximum'}
${hasWorkedRequiredHours ? '✅ Meets hour requirement' : '❌ Does not meet hour requirement'}
${meetsDistanceRequirement ? '✅ Meets distance requirement' : '❌ Does not meet distance requirement'}
`;

    return {
      isValid,
      rule,
      validationResults: {
        meetsAmountLimit,
        meetsHourRequirement: hasWorkedRequiredHours,
        meetsDistanceRequirement,
        totalMiles,
        totalHours
      },
      message
    };
  }
}

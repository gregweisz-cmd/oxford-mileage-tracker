export interface EesRule {
  costCenter: string;
  maxAmount: number;
  description: string;
}

class EesRulesService {
  private static rules: EesRule[] = [
    {
      costCenter: 'AL-SOR',
      maxAmount: 600,
      description: 'AL-SOR EES limit'
    },
    {
      costCenter: 'CC001',
      maxAmount: 500,
      description: 'CC001 EES limit'
    },
    {
      costCenter: 'CC002',
      maxAmount: 600,
      description: 'CC002 EES limit'
    },
    {
      costCenter: 'CC003',
      maxAmount: 550,
      description: 'CC003 EES limit'
    },
    {
      costCenter: 'CC004',
      maxAmount: 600,
      description: 'CC004 EES limit'
    }
  ];

  static getAllRules(): EesRule[] {
    return [...this.rules];
  }

  private static normalizeCostCenter(value: string | null | undefined): string {
    if (!value) return '';
    return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  static getRule(costCenter: string): EesRule | undefined {
    const normalizedTarget = this.normalizeCostCenter(costCenter);
    return this.rules.find((rule) => this.normalizeCostCenter(rule.costCenter) === normalizedTarget);
  }

  static updateRule(costCenter: string, maxAmount: number, description: string): void {
    const normalizedTarget = this.normalizeCostCenter(costCenter);
    const existingRuleIndex = this.rules.findIndex(
      (rule) => this.normalizeCostCenter(rule.costCenter) === normalizedTarget
    );
    
    if (existingRuleIndex >= 0) {
      this.rules[existingRuleIndex] = { costCenter, maxAmount, description };
    } else {
      this.rules.push({ costCenter, maxAmount, description });
    }
  }

  static deleteRule(costCenter: string): void {
    const normalizedTarget = this.normalizeCostCenter(costCenter);
    this.rules = this.rules.filter(
      (rule) => this.normalizeCostCenter(rule.costCenter) !== normalizedTarget
    );
  }

  static async validateEes(
    employeeId: string,
    costCenter: string,
    amount: number,
    date: Date
  ): Promise<{ isValid: boolean; message: string; currentTotal?: number }> {
    const rule = this.getRule(costCenter);
    
    if (!rule) {
      return {
        isValid: false,
        message: `No EES rule found for cost center ${costCenter}`
      };
    }

    // For now, we'll just validate against the rule limit
    // In a real implementation, you might want to check monthly totals
    if (amount > rule.maxAmount) {
      return {
        isValid: false,
        message: `EES amount $${amount.toFixed(2)} exceeds the limit of $${rule.maxAmount} for cost center ${costCenter}`
      };
    }

    return {
      isValid: true,
      message: `EES amount is within the limit of $${rule.maxAmount} for cost center ${costCenter}`
    };
  }
}

export default EesRulesService;

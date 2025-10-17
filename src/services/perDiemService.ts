import { MileageEntry, Employee } from '../types';
import { PerDiemRulesService, PerDiemRule } from './perDiemRulesService';

export interface PerDiemCalculation {
  totalPerDiem: number;
  eligibleDays: number;
  maxPerDiem: number; // $350 per month
  breakdown: PerDiemDay[];
}

export interface PerDiemDay {
  date: Date;
  hoursWorked: number;
  milesDriven: number;
  distanceFromBase: number;
  isEligible: boolean;
  reason: string;
  amount: number;
  rule?: PerDiemRule;
}

export class PerDiemService {
  private static readonly PER_DIEM_RATE = 35; // $35 per day
  private static readonly MAX_MONTHLY_PER_DIEM = 350; // $350 per month
  private static readonly MIN_HOURS_FOR_PER_DIEM = 8;
  private static readonly MIN_MILES_FOR_PER_DIEM = 100;
  private static readonly MIN_DISTANCE_FROM_BASE = 50; // miles

  /**
   * Calculate per diem for a given month
   */
  static async calculateMonthlyPerDiem(
    employeeId: string,
    month: number,
    year: number,
    entries: MileageEntry[],
    employee: Employee
  ): Promise<PerDiemCalculation> {
    // Filter entries for the specified month
    const monthEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() + 1 === month && entryDate.getFullYear() === year;
    });

    // Group entries by date
    const entriesByDate = this.groupEntriesByDate(monthEntries);
    
    const breakdown: PerDiemDay[] = [];
    let totalPerDiem = 0;
    let eligibleDays = 0;

    for (const [dateStr, dayEntries] of entriesByDate) {
      const date = new Date(dateStr);
      const dayCalculation = await this.calculateDayPerDiem(date, dayEntries, employee);
      
      breakdown.push(dayCalculation);
      
      if (dayCalculation.isEligible) {
        totalPerDiem += dayCalculation.amount;
        eligibleDays++;
      }
    }

    // Cap at maximum monthly per diem
    totalPerDiem = Math.min(totalPerDiem, this.MAX_MONTHLY_PER_DIEM);

    return {
      totalPerDiem,
      eligibleDays,
      maxPerDiem: this.MAX_MONTHLY_PER_DIEM,
      breakdown
    };
  }

  /**
   * Calculate per diem for a single day
   */
  private static async calculateDayPerDiem(
    date: Date,
    dayEntries: MileageEntry[],
    employee: Employee
  ): Promise<PerDiemDay> {
    const totalHours = dayEntries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0);
    const totalMiles = dayEntries.reduce((sum, entry) => sum + entry.miles, 0);
    
    // Calculate distance from base address (simplified - would need geocoding in real implementation)
    const distanceFromBase = this.calculateDistanceFromBase(dayEntries, employee.baseAddress);
    
    // Get the employee's cost center (use default if none specified)
    const costCenter = employee.defaultCostCenter || employee.costCenters?.[0] || 'Program Services';
    
    // Get Per Diem calculation using rules
    const perDiemResult = await PerDiemRulesService.calculatePerDiem(
      costCenter,
      totalHours,
      totalMiles,
      distanceFromBase,
      0 // actualExpenses - would need to be calculated from receipts for this day
    );

    let reason = '';
    if (!perDiemResult.meetsRequirements) {
      const rule = perDiemResult.rule;
      if (rule) {
        const unmetRequirements = [];
        if (totalHours < rule.minHours) {
          unmetRequirements.push(`${totalHours.toFixed(1)}h < ${rule.minHours}h required`);
        }
        if (totalMiles < rule.minMiles) {
          unmetRequirements.push(`${totalMiles.toFixed(1)}mi < ${rule.minMiles}mi required`);
        }
        if (distanceFromBase < rule.minDistanceFromBase) {
          unmetRequirements.push(`${distanceFromBase.toFixed(1)}mi from base < ${rule.minDistanceFromBase}mi required`);
        }
        reason = `Requirements not met: ${unmetRequirements.join(', ')}`;
      } else {
        reason = 'No Per Diem rule found for cost center';
      }
    } else {
      const rule = perDiemResult.rule;
      if (rule) {
        reason = `${rule.useActualAmount ? 'Actual expenses' : 'Fixed amount'} (${rule.maxAmount.toFixed(2)}) - Requirements met`;
      } else {
        reason = `Default rate (${this.PER_DIEM_RATE}) - Requirements met`;
      }
    }

    return {
      date,
      hoursWorked: totalHours,
      milesDriven: totalMiles,
      distanceFromBase,
      isEligible: perDiemResult.meetsRequirements,
      reason,
      amount: perDiemResult.amount,
      rule: perDiemResult.rule || undefined
    };
  }

  /**
   * Group mileage entries by date
   */
  private static groupEntriesByDate(entries: MileageEntry[]): Map<string, MileageEntry[]> {
    const grouped = new Map<string, MileageEntry[]>();
    
    entries.forEach(entry => {
      const dateStr = entry.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, []);
      }
      grouped.get(dateStr)!.push(entry);
    });
    
    return grouped;
  }

  /**
   * Calculate approximate distance from base address
   * This is a simplified calculation - in a real implementation you'd use geocoding
   */
  private static calculateDistanceFromBase(entries: MileageEntry[], baseAddress: string): number {
    // For now, we'll use a simple heuristic based on the entries
    // In a real implementation, you'd geocode the base address and calculate actual distances
    
    if (!baseAddress || baseAddress.trim() === '') {
      return 0;
    }

    // Simple heuristic: if any entry has location details with coordinates, 
    // we could calculate distance. For now, return 0 as placeholder.
    // This would need to be implemented with actual geocoding service.
    
    return 0; // Placeholder - would need geocoding implementation
  }

  /**
   * Calculate total expenses (mileage + receipts + per diem)
   */
  static calculateTotalExpenses(
    totalMiles: number,
    totalReceipts: number,
    perDiemAmount: number
  ): number {
    const mileageRate = 0.445; // $0.445 per mile
    const mileageExpense = totalMiles * mileageRate;
    
    return mileageExpense + totalReceipts + perDiemAmount;
  }

  /**
   * Get expense breakdown
   */
  static getExpenseBreakdown(
    totalMiles: number,
    totalReceipts: number,
    perDiemAmount: number
  ) {
    const mileageRate = 0.445;
    const mileageExpense = totalMiles * mileageRate;
    const totalExpenses = mileageExpense + totalReceipts + perDiemAmount;

    return {
      mileageExpense,
      receiptExpense: totalReceipts,
      perDiemExpense: perDiemAmount,
      totalExpenses
    };
  }
}

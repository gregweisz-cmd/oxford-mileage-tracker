import { MileageEntry, Employee } from '../types';

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
      const dayCalculation = this.calculateDayPerDiem(date, dayEntries, employee);
      
      breakdown.push(dayCalculation);
      
      if (dayCalculation.isEligible) {
        totalPerDiem += this.PER_DIEM_RATE;
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
  private static calculateDayPerDiem(
    date: Date,
    dayEntries: MileageEntry[],
    employee: Employee
  ): PerDiemDay {
    const totalHours = dayEntries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0);
    const totalMiles = dayEntries.reduce((sum, entry) => sum + entry.miles, 0);
    
    // Calculate distance from base address (simplified - would need geocoding in real implementation)
    const distanceFromBase = this.calculateDistanceFromBase(dayEntries, employee.baseAddress);
    
    let isEligible = false;
    let reason = '';

    if (totalHours < this.MIN_HOURS_FOR_PER_DIEM) {
      reason = `Less than ${this.MIN_HOURS_FOR_PER_DIEM} hours worked (${totalHours.toFixed(1)}h)`;
    } else if (totalMiles >= this.MIN_MILES_FOR_PER_DIEM) {
      isEligible = true;
      reason = `${totalMiles.toFixed(1)} miles driven (≥${this.MIN_MILES_FOR_PER_DIEM} miles)`;
    } else if (distanceFromBase >= this.MIN_DISTANCE_FROM_BASE) {
      isEligible = true;
      reason = `${distanceFromBase.toFixed(1)} miles from base (≥${this.MIN_DISTANCE_FROM_BASE} miles)`;
    } else {
      reason = `Less than ${this.MIN_MILES_FOR_PER_DIEM} miles driven (${totalMiles.toFixed(1)}mi) and less than ${this.MIN_DISTANCE_FROM_BASE} miles from base (${distanceFromBase.toFixed(1)}mi)`;
    }

    return {
      date,
      hoursWorked: totalHours,
      milesDriven: totalMiles,
      distanceFromBase,
      isEligible,
      reason
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

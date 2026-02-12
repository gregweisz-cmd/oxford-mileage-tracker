import { MileageEntry, Employee, Receipt } from '../types';
import { PerDiemRulesService, PerDiemRule } from './perDiemRulesService';
import { DistanceService } from './distanceService';

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
  isOvernight: boolean;
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
    employee: Employee,
    receipts?: Receipt[]
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

    // Group receipts by date for overnight stay detection
    const receiptsByDate = receipts ? this.groupReceiptsByDate(receipts) : new Map();
    
    for (const [dateStr, dayEntries] of entriesByDate) {
      const date = new Date(dateStr);
      const dayReceipts = receiptsByDate.get(dateStr) || [];
      const dayCalculation = await this.calculateDayPerDiem(date, dayEntries, employee, dayReceipts);
      
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
    employee: Employee,
    dayReceipts: Receipt[] = []
  ): Promise<PerDiemDay> {
    const totalHours = dayEntries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0);
    const totalMiles = dayEntries.reduce((sum, entry) => sum + entry.miles, 0);
    
    // Check for overnight stay - look for lodging receipts (Hotels/AirBnB)
    const isOvernight = dayReceipts.some(receipt => 
      receipt.category === 'Hotels/AirBnB' || 
      receipt.category === 'Lodging' ||
      receipt.vendor.toLowerCase().includes('hotel') ||
      receipt.vendor.toLowerCase().includes('motel') ||
      receipt.vendor.toLowerCase().includes('inn') ||
      receipt.vendor.toLowerCase().includes('airbnb')
    );
    
    // Calculate distance from base address using Google Maps geocoding
    const distanceFromBase = await this.calculateDistanceFromBase(dayEntries, employee.baseAddress);
    
    // New eligibility rules:
    // 1. Must work 8+ hours (always required)
    // 2. Must meet ONE of the following:
    //    - Stay overnight away from base (50+ miles from base) OR
    //    - Drive 100+ miles in the day
    
    const meetsHoursRequirement = totalHours >= this.MIN_HOURS_FOR_PER_DIEM;
    const isOvernightAwayFromBase = isOvernight && distanceFromBase >= this.MIN_DISTANCE_FROM_BASE;
    const droveEnough = totalMiles >= this.MIN_MILES_FOR_PER_DIEM;
    
    // Eligibility: 8+ hours AND (overnight 50+ miles away OR 100+ miles driven)
    const isEligible = meetsHoursRequirement && (isOvernightAwayFromBase || droveEnough);
    
    let reason = '';
    let amount = 0;
    
    if (!meetsHoursRequirement) {
      reason = `Not eligible: Only ${totalHours.toFixed(1)}h worked (8h required)`;
    } else if (isEligible) {
      amount = this.PER_DIEM_RATE;
      if (isOvernightAwayFromBase) {
        reason = `Eligible: Overnight stay ${distanceFromBase.toFixed(1)}mi from base + ${totalHours.toFixed(1)}h worked`;
      } else if (droveEnough) {
        reason = `Eligible: ${totalMiles.toFixed(1)}mi driven + ${totalHours.toFixed(1)}h worked`;
      }
    } else {
      const missingCriteria = [];
      if (!isOvernightAwayFromBase && !droveEnough) {
        if (!isOvernight) {
          missingCriteria.push('no overnight stay away from base');
        } else {
          missingCriteria.push(`overnight only ${distanceFromBase.toFixed(1)}mi from base (50mi required)`);
        }
        if (totalMiles < this.MIN_MILES_FOR_PER_DIEM) {
          missingCriteria.push(`only ${totalMiles.toFixed(1)}mi driven (100mi required)`);
        }
      }
      reason = `Not eligible: ${missingCriteria.join(', ')}`;
    }

    return {
      date,
      hoursWorked: totalHours,
      milesDriven: totalMiles,
      distanceFromBase,
      isOvernight,
      isEligible,
      reason,
      amount,
      rule: undefined
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
   * Group receipts by date
   */
  private static groupReceiptsByDate(receipts: Receipt[]): Map<string, Receipt[]> {
    const grouped = new Map<string, Receipt[]>();
    
    receipts.forEach(receipt => {
      const dateStr = receipt.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, []);
      }
      grouped.get(dateStr)!.push(receipt);
    });
    
    return grouped;
  }

  /**
   * Calculate maximum distance from base address across all entries for a day
   * Uses Google Maps API geocoding for accurate distance calculation
   */
  private static async calculateDistanceFromBase(entries: MileageEntry[], baseAddress: string): Promise<number> {
    if (!baseAddress || baseAddress.trim() === '' || !entries || entries.length === 0) {
      return 0;
    }

    try {
      // Get the furthest location from base for this day's entries
      let maxDistance = 0;
      
      for (const entry of entries) {
        // Prefer full address from details so geocoding works (short names like "Gibson Casa" fail)
        const start = (entry.startLocationDetails?.address || entry.startLocation || '').trim();
        if (start && start !== 'BA') {
          try {
            const distance = await DistanceService.calculateDistance(baseAddress, start);
            maxDistance = Math.max(maxDistance, distance);
          } catch (error) {
            console.warn(`Could not calculate distance to start location: ${start}`, error);
          }
        }

        const end = (entry.endLocationDetails?.address || entry.endLocation || '').trim();
        if (end && end !== 'BA') {
          try {
            const distance = await DistanceService.calculateDistance(baseAddress, end);
            maxDistance = Math.max(maxDistance, distance);
          } catch (error) {
            console.warn(`Could not calculate distance to end location: ${end}`, error);
          }
        }
      }
      
      return Math.round(maxDistance * 10) / 10; // Round to nearest tenth
    } catch (error) {
      console.error('Error calculating distance from base address:', error);
      // Return 0 on error - this will make the day ineligible for per diem
      // User can manually adjust if needed
      return 0;
    }
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

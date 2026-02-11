import { MileageEntry, TimeTracking, Employee } from '../types';
import { DatabaseService } from './database';
import { BackendDataService } from './backendDataService';
import { DistanceService } from './distanceService';
import { debugLog, debugError, debugWarn } from '../config/debug';

export interface PerDiemEligibility {
  isEligible: boolean;
  reason: string;
  criteria: {
    hoursWorked: boolean;
    milesDriven: boolean;
    distanceFromBase: boolean;
  };
  details: {
    hoursWorked: number;
    milesDriven: number;
    distanceFromBase: number;
    baseAddress: string;
  };
  suggestedAmount: number;
  confidence: number; // 0-100
}

export interface PerDiemRule {
  id: string;
  name: string;
  description: string;
  criteria: {
    minHours?: number;
    minMiles?: number;
    minDistanceFromBase?: number;
  };
  amount: number;
  isActive: boolean;
}

export class PerDiemAiService {
  private static readonly PER_DIEM_AMOUNT = 35;
  private static readonly MIN_HOURS = 8;
  private static readonly MIN_MILES = 100;
  private static readonly MIN_DISTANCE_FROM_BASE = 50;

  /** Format date as YYYY-MM-DD in local time (avoid UTC shift from toISOString). */
  private static toLocalDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Check if an employee is eligible for per diem on a specific date.
   * Uses same backend-first logic as getEligibilityForMonth so results stay in sync.
   */
  static async checkPerDiemEligibility(
    employeeId: string,
    date: Date
  ): Promise<PerDiemEligibility> {
    try {
      debugLog('💵 PerDiemAI: Checking eligibility for:', { employeeId, date });

      const employees = await DatabaseService.getEmployees();
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) {
        return this.createIneligibleResponse('Employee not found');
      }

      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const dateKey = this.toLocalDateKey(date);
      const eligibilityMap = await this.getEligibilityForMonth(employeeId, month, year);
      const dayResult = eligibilityMap.get(dateKey);

      if (!dayResult) {
        return this.createIneligibleResponse('No data for this day');
      }

      // Recompute details for this day for the full PerDiemEligibility response (hours, miles, distance)
      let hoursWorked = 0;
      let milesDriven = 0;
      let distanceFromBase = 0;
      try {
        const monthlyData = await BackendDataService.getMonthData(employeeId, month, year);
        const day = monthlyData.find(d => this.toLocalDateKey(d.date) === dateKey);
        if (day) {
          hoursWorked = day.totalHours;
          milesDriven = day.totalMiles || 0;
          distanceFromBase = await this.calculateDistanceFromBase(
            day.mileageEntries || [],
            employee.baseAddress || ''
          );
        }
      } catch {
        // fallback: try local
        const [timeEntries, mileageEntries] = await Promise.all([
          DatabaseService.getTimeTrackingEntries(employeeId),
          DatabaseService.getMileageEntries(employeeId)
        ]);
        const dayTime = timeEntries.filter(e => this.toLocalDateKey(e.date) === dateKey);
        const dayMileage = mileageEntries.filter(e => this.toLocalDateKey(e.date) === dateKey);
        hoursWorked = dayTime
          .filter((e: any) => ['', 'Working Hours', 'Regular Hours'].includes((e.category || '').trim()))
          .reduce((s: number, e: any) => s + e.hours, 0);
        milesDriven = dayMileage.reduce((s, e) => s + e.miles, 0);
        distanceFromBase = await this.calculateDistanceFromBase(dayMileage, employee.baseAddress || '');
      }

      const criteria = {
        hoursWorked: hoursWorked >= this.MIN_HOURS,
        milesDriven: milesDriven >= this.MIN_MILES,
        distanceFromBase: distanceFromBase >= this.MIN_DISTANCE_FROM_BASE
      };
      const confidence = this.calculateConfidence(criteria, {
        hoursWorked,
        milesDriven,
        distanceFromBase
      });

      const response: PerDiemEligibility = {
        isEligible: dayResult.isEligible,
        reason: dayResult.reason,
        criteria,
        details: {
          hoursWorked,
          milesDriven,
          distanceFromBase,
          baseAddress: employee.baseAddress || ''
        },
        suggestedAmount: dayResult.isEligible ? this.PER_DIEM_AMOUNT : 0,
        confidence
      };

      debugLog('💵 PerDiemAI: Eligibility result:', response);
      return response;
    } catch (error) {
      console.error('❌ PerDiemAI: Error checking eligibility:', error);
      return this.createIneligibleResponse('Error checking eligibility');
    }
  }

  /**
   * Get per-diem eligibility for every day in a month (for Per Diem screen labels).
   * Rule: 8+ hours AND (100+ miles OR (stayed overnight AND 50+ mi from base)).
   * Uses backend data first (same as dashboard), then local DB; uses local date keys and real distance.
   */
  static async getEligibilityForMonth(
    employeeId: string,
    month: number,
    year: number
  ): Promise<Map<string, { isEligible: boolean; reason: string }>> {
    const result = new Map<string, { isEligible: boolean; reason: string }>();
    try {
      const employees = await DatabaseService.getEmployees();
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return result;

      // Prefer backend so eligibility matches dashboard and web (hours/mileage from same source).
      try {
        const monthlyData = await BackendDataService.getMonthData(employeeId, month, year);
        for (const day of monthlyData) {
          const dateKey = this.toLocalDateKey(day.date);
          const stayedOvernight = day.stayedOvernight ?? false;
          const distanceFromBase = await this.calculateDistanceFromBase(
            day.mileageEntries || [],
            employee.baseAddress || ''
          );
          const criteria = {
            hoursWorked: day.totalHours >= this.MIN_HOURS,
            milesDriven: (day.totalMiles || 0) >= this.MIN_MILES,
            distanceFromBase: distanceFromBase >= this.MIN_DISTANCE_FROM_BASE
          };
          const isEligible = criteria.hoursWorked && (
            criteria.milesDriven ||
            (stayedOvernight && criteria.distanceFromBase)
          );
          const reason = this.generateEligibilityReason(
            criteria,
            {
              hoursWorked: day.totalHours,
              milesDriven: day.totalMiles || 0,
              distanceFromBase
            },
            stayedOvernight,
            isEligible
          );
          result.set(dateKey, { isEligible, reason });
        }
        return result;
      } catch (backendErr) {
        debugWarn('PerDiemAI: Backend month data failed, using local:', backendErr);
      }

      // Fallback: local DB (use local date keys to avoid timezone bugs)
      const [dailyDescriptions, timeTracking, mileageEntries] = await Promise.all([
        DatabaseService.getDailyDescriptions(employeeId, month, year),
        DatabaseService.getTimeTrackingEntries(employeeId, month, year),
        DatabaseService.getMileageEntries(employeeId, month, year)
      ]);

      const daysInMonth = new Date(year, month, 0).getDate();
      const descByDate = new Map<string, { stayedOvernight: boolean }>();
      dailyDescriptions.forEach(d => {
        const key = this.toLocalDateKey(d.date);
        descByDate.set(key, { stayedOvernight: d.stayedOvernight ?? false });
      });

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const date = new Date(year, month - 1, dayNum);
        const dateKey = this.toLocalDateKey(date);

        const dayTime = timeTracking.filter(e => this.toLocalDateKey(e.date) === dateKey);
        const dayMileage = mileageEntries.filter(e => this.toLocalDateKey(e.date) === dateKey);
        const hoursWorked = dayTime
          .filter((e: any) => {
            const cat = (e.category || '').trim();
            return cat === '' || cat === 'Working Hours' || cat === 'Regular Hours';
          })
          .reduce((s, e: any) => s + e.hours, 0);
        const milesDriven = dayMileage.reduce((s, e: any) => s + e.miles, 0);
        const { stayedOvernight } = descByDate.get(dateKey) || { stayedOvernight: false };
        const distanceFromBase = await this.calculateDistanceFromBase(dayMileage, employee.baseAddress || '');

        const criteria = {
          hoursWorked: hoursWorked >= this.MIN_HOURS,
          milesDriven: milesDriven >= this.MIN_MILES,
          distanceFromBase: distanceFromBase >= this.MIN_DISTANCE_FROM_BASE
        };
        const isEligible = criteria.hoursWorked && (criteria.milesDriven || (stayedOvernight && criteria.distanceFromBase));
        const reason = this.generateEligibilityReason(
          criteria,
          { hoursWorked, milesDriven, distanceFromBase },
          stayedOvernight,
          isEligible
        );
        result.set(dateKey, { isEligible, reason });
      }
    } catch (error) {
      debugError('PerDiemAI: getEligibilityForMonth error', error);
    }
    return result;
  }

  /**
   * Calculate max distance from base address for the day's trips.
   * Uses DistanceService (backend/Google Maps) so "50+ miles from base" is real.
   */
  private static async calculateDistanceFromBase(
    mileageEntries: MileageEntry[],
    baseAddress: string
  ): Promise<number> {
    if (!baseAddress || (baseAddress || '').trim() === '' || !mileageEntries?.length) {
      return 0;
    }

    let maxDistance = 0;
    for (const entry of mileageEntries) {
      const start = (entry.startLocation || '').trim();
      if (start && start !== 'BA') {
        try {
          const d = await DistanceService.calculateDistance(baseAddress, start);
          maxDistance = Math.max(maxDistance, d);
        } catch {
          // ignore per-entry failures
        }
      }
      const end = (entry.endLocation || '').trim();
      if (end && end !== 'BA') {
        try {
          const d = await DistanceService.calculateDistance(baseAddress, end);
          maxDistance = Math.max(maxDistance, d);
        } catch {
          // ignore per-entry failures
        }
      }
    }
    return Math.round(maxDistance * 10) / 10;
  }

  /**
   * Generate eligibility reason (rule: 8+ hours AND (100+ mi OR stayed overnight 50+ mi from base))
   */
  private static generateEligibilityReason(
    criteria: { hoursWorked: boolean; milesDriven: boolean; distanceFromBase: boolean },
    details: { hoursWorked: number; milesDriven: number; distanceFromBase: number },
    stayedOvernight?: boolean,
    isEligible?: boolean
  ): string {
    if (isEligible) {
      const parts = [`${details.hoursWorked.toFixed(1)}h worked`];
      if (criteria.milesDriven) parts.push(`${details.milesDriven} mi`);
      if (stayedOvernight && criteria.distanceFromBase) parts.push('stayed 50+ mi from base');
      return `Eligible: ${parts.join(', ')}`;
    }
    if (!criteria.hoursWorked) {
      return `Not eligible: Need ${this.MIN_HOURS}+ hours worked`;
    }
    if (!criteria.milesDriven && !(stayedOvernight && criteria.distanceFromBase)) {
      return `Not eligible: Need ${this.MIN_MILES}+ miles OR stayed out of town 50+ mi from base`;
    }
    return 'Not eligible';
  }

  /**
   * Calculate confidence score
   */
  private static calculateConfidence(
    criteria: { hoursWorked: boolean; milesDriven: boolean; distanceFromBase: boolean },
    details: { hoursWorked: number; milesDriven: number; distanceFromBase: number }
  ): number {
    let confidence = 0;

    // Base confidence for meeting criteria
    if (criteria.hoursWorked) confidence += 40;
    if (criteria.milesDriven) confidence += 40;
    if (criteria.distanceFromBase) confidence += 40;

    // Bonus for exceeding requirements
    if (details.hoursWorked > this.MIN_HOURS + 2) confidence += 10;
    if (details.milesDriven > this.MIN_MILES + 20) confidence += 10;
    if (details.distanceFromBase > this.MIN_DISTANCE_FROM_BASE + 20) confidence += 10;

    return Math.min(100, confidence);
  }

  /**
   * Create ineligible response
   */
  private static createIneligibleResponse(reason: string): PerDiemEligibility {
    return {
      isEligible: false,
      reason,
      criteria: {
        hoursWorked: false,
        milesDriven: false,
        distanceFromBase: false
      },
      details: {
        hoursWorked: 0,
        milesDriven: 0,
        distanceFromBase: 0,
        baseAddress: ''
      },
      suggestedAmount: 0,
      confidence: 0
    };
  }

  /**
   * Auto-add per diem entry for eligible days
   * DISABLED: This functionality caused unintended automatic receipt generation
   */
  static async autoAddPerDiemForDate(
    employeeId: string,
    date: Date
  ): Promise<boolean> {
    // Disabled to prevent automatic Per Diem receipt generation
    return false;
  }

  /**
   * Check and auto-add per diem for multiple dates
   * DISABLED: This functionality caused unintended automatic receipt generation
   */
  static async autoAddPerDiemForDateRange(
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ added: number; total: number }> {
    // Disabled to prevent automatic Per Diem receipt generation
    return { added: 0, total: 0 };
  }

  /**
   * Get per diem summary for a month
   */
  static async getPerDiemSummary(
    employeeId: string,
    month: number,
    year: number
  ): Promise<{
    totalPerDiem: number;
    eligibleDays: number;
    totalDays: number;
    details: Array<{
      date: Date;
      isEligible: boolean;
      reason: string;
      amount: number;
    }>;
  }> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const details = [];
      let totalPerDiem = 0;
      let eligibleDays = 0;
      let totalDays = 0;

      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        totalDays++;
        const eligibility = await this.checkPerDiemEligibility(employeeId, new Date(currentDate));
        
        details.push({
          date: new Date(currentDate),
          isEligible: eligibility.isEligible,
          reason: eligibility.reason,
          amount: eligibility.suggestedAmount
        });

        if (eligibility.isEligible) {
          eligibleDays++;
          totalPerDiem += eligibility.suggestedAmount;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        totalPerDiem,
        eligibleDays,
        totalDays,
        details
      };

    } catch (error) {
      console.error('❌ PerDiemAI: Error getting per diem summary:', error);
      return {
        totalPerDiem: 0,
        eligibleDays: 0,
        totalDays: 0,
        details: []
      };
    }
  }

  /**
   * Get per diem rules
   */
  static getPerDiemRules(): PerDiemRule[] {
    return [
      {
        id: 'standard',
        name: 'Standard Per Diem',
        description: 'Automatic $35 per diem for eligible days',
        criteria: {
          minHours: this.MIN_HOURS,
          minMiles: this.MIN_MILES,
          minDistanceFromBase: this.MIN_DISTANCE_FROM_BASE
        },
        amount: this.PER_DIEM_AMOUNT,
        isActive: true
      }
    ];
  }

  /**
   * Update per diem rules
   */
  static updatePerDiemRules(rules: PerDiemRule[]): void {
    // In a production app, you'd save this to a configuration database
    debugLog('💵 PerDiemAI: Updated per diem rules:', rules);
  }
}

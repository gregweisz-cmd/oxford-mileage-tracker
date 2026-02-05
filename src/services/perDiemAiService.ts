import { MileageEntry, TimeTracking, Employee } from '../types';
import { DatabaseService } from './database';
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

  /**
   * Check if an employee is eligible for per diem on a specific date
   */
  static async checkPerDiemEligibility(
    employeeId: string,
    date: Date
  ): Promise<PerDiemEligibility> {
    try {
      debugLog('💵 PerDiemAI: Checking eligibility for:', { employeeId, date });

      // Get employee data
      const employees = await DatabaseService.getEmployees();
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) {
        return this.createIneligibleResponse('Employee not found');
      }

      // Get time tracking for the date
      const timeTrackingEntries = await DatabaseService.getTimeTrackingEntries(employeeId);
      const dayTimeTracking = timeTrackingEntries.filter(entry => 
        entry.date.toDateString() === date.toDateString()
      );

      // Get mileage entries for the date
      const mileageEntries = await DatabaseService.getMileageEntries(employeeId);
      const dayMileageEntries = mileageEntries.filter(entry => 
        entry.date.toDateString() === date.toDateString()
      );

      // Get daily description for stayedOvernight (stayed out of town)
      const dailyDescription = await DatabaseService.getDailyDescriptionByDate(employeeId, date);
      const stayedOvernight = dailyDescription?.stayedOvernight ?? false;

      // Calculate working hours only (exclude PTO, G&A, etc.)
      const hoursWorked = dayTimeTracking
        .filter((e: any) => {
          const cat = (e.category || '').trim();
          return cat === '' || cat === 'Working Hours' || cat === 'Regular Hours';
        })
        .reduce((sum: number, entry: any) => sum + entry.hours, 0);
      const milesDriven = dayMileageEntries.reduce((sum: number, entry: any) => sum + entry.miles, 0);
      const distanceFromBase = await this.calculateDistanceFromBase(
        dayMileageEntries,
        employee.baseAddress
      );

      // Eligibility: 8+ hours AND (100+ miles OR (stayed overnight AND 50+ mi from base))
      const criteria = {
        hoursWorked: hoursWorked >= this.MIN_HOURS,
        milesDriven: milesDriven >= this.MIN_MILES,
        distanceFromBase: distanceFromBase >= this.MIN_DISTANCE_FROM_BASE
      };
      const isEligible = criteria.hoursWorked && (criteria.milesDriven || (stayedOvernight && criteria.distanceFromBase));

      // Generate reason (reflects 8h AND (100mi OR stayed 50+ from base))
      const reason = this.generateEligibilityReason(criteria, {
        hoursWorked,
        milesDriven,
        distanceFromBase
      }, stayedOvernight, isEligible);

      // Calculate confidence
      const confidence = this.calculateConfidence(criteria, {
        hoursWorked,
        milesDriven,
        distanceFromBase
      });

      const response: PerDiemEligibility = {
        isEligible,
        reason,
        criteria,
        details: {
          hoursWorked,
          milesDriven,
          distanceFromBase,
          baseAddress: employee.baseAddress
        },
        suggestedAmount: isEligible ? this.PER_DIEM_AMOUNT : 0,
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

      const [dailyDescriptions, timeTracking, mileageEntries] = await Promise.all([
        DatabaseService.getDailyDescriptions(employeeId, month, year),
        DatabaseService.getTimeTrackingEntries(employeeId, month, year),
        DatabaseService.getMileageEntries(employeeId, month, year)
      ]);

      const daysInMonth = new Date(year, month, 0).getDate();
      const descByDate = new Map<string, { stayedOvernight: boolean }>();
      dailyDescriptions.forEach(d => {
        const key = d.date.toISOString().split('T')[0];
        descByDate.set(key, { stayedOvernight: d.stayedOvernight ?? false });
      });

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateKey = date.toISOString().split('T')[0];

        const dayTime = timeTracking.filter(e => e.date.toDateString() === date.toDateString());
        const dayMileage = mileageEntries.filter(e => e.date.toDateString() === date.toDateString());
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
   * Calculate distance from base address
   */
  private static async calculateDistanceFromBase(
    mileageEntries: MileageEntry[],
    baseAddress: string
  ): Promise<number> {
    if (!baseAddress || mileageEntries.length === 0) {
      return 0;
    }

    // Find the farthest distance from base in any trip
    let maxDistance = 0;

    for (const entry of mileageEntries) {
      // Check start location distance from base
      const startDistance = await this.estimateDistance(baseAddress, entry.startLocation);
      if (startDistance > maxDistance) {
        maxDistance = startDistance;
      }

      // Check end location distance from base
      const endDistance = await this.estimateDistance(baseAddress, entry.endLocation);
      if (endDistance > maxDistance) {
        maxDistance = endDistance;
      }
    }

    return maxDistance;
  }

  /**
   * Estimate distance between two locations (simplified)
   */
  private static async estimateDistance(location1: string, location2: string): Promise<number> {
    // This is a simplified distance estimation
    // In production, you'd use a proper geocoding service
    
    // For now, we'll use a basic pattern matching approach
    const baseCity = this.extractCity(location1);
    const targetCity = this.extractCity(location2);
    
    if (baseCity === targetCity) {
      return 0; // Same city
    }

    // Return estimated distance based on common patterns
    // This is a placeholder - in production you'd use Google Maps API
    return Math.random() * 100 + 10; // 10-110 miles
  }

  /**
   * Extract city from address string
   */
  private static extractCity(address: string): string {
    // Simple city extraction - look for common patterns
    const cityPatterns = [
      /([A-Za-z\s]+),\s*NC/i,
      /([A-Za-z\s]+),\s*SC/i,
      /([A-Za-z\s]+),\s*VA/i,
      /([A-Za-z\s]+),\s*TN/i
    ];

    for (const pattern of cityPatterns) {
      const match = address.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return address; // Return full address if no city found
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

import { MileageEntry, TimeTracking, Employee } from '../types';
import { DatabaseService } from './database';

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
      console.log('💵 PerDiemAI: Checking eligibility for:', { employeeId, date });

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

      // Calculate totals
      const hoursWorked = dayTimeTracking.reduce((sum: number, entry: any) => sum + entry.hours, 0);
      const milesDriven = dayMileageEntries.reduce((sum: number, entry: any) => sum + entry.miles, 0);
      const distanceFromBase = await this.calculateDistanceFromBase(
        dayMileageEntries,
        employee.baseAddress
      );

      // Check eligibility criteria
      const criteria = {
        hoursWorked: hoursWorked >= this.MIN_HOURS,
        milesDriven: milesDriven >= this.MIN_MILES,
        distanceFromBase: distanceFromBase >= this.MIN_DISTANCE_FROM_BASE
      };

      const isEligible = criteria.hoursWorked || criteria.milesDriven || criteria.distanceFromBase;

      // Generate reason
      const reason = this.generateEligibilityReason(criteria, {
        hoursWorked,
        milesDriven,
        distanceFromBase
      });

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

      console.log('💵 PerDiemAI: Eligibility result:', response);
      return response;

    } catch (error) {
      console.error('❌ PerDiemAI: Error checking eligibility:', error);
      return this.createIneligibleResponse('Error checking eligibility');
    }
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
   * Generate eligibility reason
   */
  private static generateEligibilityReason(
    criteria: { hoursWorked: boolean; milesDriven: boolean; distanceFromBase: boolean },
    details: { hoursWorked: number; milesDriven: number; distanceFromBase: number }
  ): string {
    const reasons = [];

    if (criteria.hoursWorked) {
      reasons.push(`${details.hoursWorked} hours worked (≥${this.MIN_HOURS} required)`);
    }

    if (criteria.milesDriven) {
      reasons.push(`${details.milesDriven} miles driven (≥${this.MIN_MILES} required)`);
    }

    if (criteria.distanceFromBase) {
      reasons.push(`${details.distanceFromBase.toFixed(1)} miles from base (≥${this.MIN_DISTANCE_FROM_BASE} required)`);
    }

    if (reasons.length === 0) {
      return `Not eligible: Need ${this.MIN_HOURS}+ hours OR ${this.MIN_MILES}+ miles OR ${this.MIN_DISTANCE_FROM_BASE}+ miles from base`;
    }

    return `Eligible: ${reasons.join(' OR ')}`;
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
   */
  static async autoAddPerDiemForDate(
    employeeId: string,
    date: Date
  ): Promise<boolean> {
    try {
      const eligibility = await this.checkPerDiemEligibility(employeeId, date);
      
      if (!eligibility.isEligible) {
        console.log('💵 PerDiemAI: Not eligible for per diem on', date.toDateString());
        return false;
      }

      // Check if per diem already exists for this date
      const receipts = await DatabaseService.getReceipts(employeeId);
      const existingPerDiem = receipts.find(receipt => 
        receipt.date.toDateString() === date.toDateString() &&
        receipt.category === 'Per Diem'
      );

      if (existingPerDiem) {
        console.log('💵 PerDiemAI: Per diem already exists for', date.toDateString());
        return false;
      }

      // Create per diem receipt entry
      const perDiemReceipt = {
        id: `perdiem-${Date.now()}`,
        employeeId,
        date,
        amount: this.PER_DIEM_AMOUNT,
        vendor: 'Per Diem - Auto Added',
        description: `Per diem for ${date.toDateString()} - ${eligibility.reason}`,
        category: 'Per Diem',
        imageUri: '', // No image for auto-added per diem
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save the per diem receipt
      await DatabaseService.createReceipt(perDiemReceipt);
      
      console.log('💵 PerDiemAI: Auto-added per diem for', date.toDateString());
      return true;

    } catch (error) {
      console.error('❌ PerDiemAI: Error auto-adding per diem:', error);
      return false;
    }
  }

  /**
   * Check and auto-add per diem for multiple dates
   */
  static async autoAddPerDiemForDateRange(
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ added: number; total: number }> {
    try {
      let added = 0;
      let total = 0;

      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        total++;
        const wasAdded = await this.autoAddPerDiemForDate(employeeId, new Date(currentDate));
        if (wasAdded) {
          added++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log('💵 PerDiemAI: Auto-added per diem for', added, 'out of', total, 'days');
      return { added, total };

    } catch (error) {
      console.error('❌ PerDiemAI: Error auto-adding per diem for date range:', error);
      return { added: 0, total: 0 };
    }
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
    console.log('💵 PerDiemAI: Updated per diem rules:', rules);
  }
}

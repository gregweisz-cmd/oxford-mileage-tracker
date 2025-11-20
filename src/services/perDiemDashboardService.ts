/**
 * Per Diem Dashboard Service
 * Provides Per Diem statistics and eligibility information for dashboard widgets
 */

import { DatabaseService } from './database';
import { PerDiemRulesService } from './perDiemRulesService';
import { Employee } from '../types';

export interface PerDiemDashboardStats {
  currentMonthTotal: number;
  monthlyLimit: number;
  remaining: number;
  percentUsed: number;
  daysEligible: number;
  daysClaimed: number;
  isEligibleToday: boolean;
  todayEligibilityReason: string;
  receipts: number;
  averagePerDay: number;
  projectedMonthEnd: number;
  status: 'safe' | 'warning' | 'limit_reached';
}

export class PerDiemDashboardService {
  private static readonly DEFAULT_MONTHLY_LIMIT = 350; // Fallback if no rule found

  /**
   * Get comprehensive Per Diem statistics for dashboard
   */
  static async getPerDiemStats(
    employee: Employee,
    month: number,
    year: number
  ): Promise<PerDiemDashboardStats> {
    try {
      // Get employee's cost center for Per Diem rules
      const costCenter = employee.defaultCostCenter || employee.costCenters?.[0] || 'Program Services';
      const rule = await PerDiemRulesService.getPerDiemRule(costCenter);
      
      // Use rule's monthly limit or fallback to default
      const monthlyLimit = rule?.monthlyLimit || this.DEFAULT_MONTHLY_LIMIT;
      
      // Get all receipts for the month
      const receipts = await DatabaseService.getReceipts(employee.id, month, year);
      const perDiemReceipts = receipts.filter(r => r.category === 'Per Diem');
      
      // Calculate current total
      const currentMonthTotal = perDiemReceipts.reduce((sum, r) => sum + r.amount, 0);
      
      // Get eligible days analysis
      const eligibilityAnalysis = await this.analyzeEligibilityForMonth(employee, month, year);
      
      // Check if eligible today
      const todayEligibility = await this.checkEligibilityForToday(employee);
      
      // Calculate statistics
      const remaining = monthlyLimit - currentMonthTotal;
      const percentUsed = monthlyLimit > 0 ? (currentMonthTotal / monthlyLimit) * 100 : 0;
      
      // Determine status
      let status: 'safe' | 'warning' | 'limit_reached';
      if (currentMonthTotal >= monthlyLimit) {
        status = 'limit_reached';
      } else if (currentMonthTotal >= monthlyLimit * 0.85) {
        status = 'warning';
      } else {
        status = 'safe';
      }

      // Calculate averages and projections
      const dayOfMonth = new Date().getDate();
      const averagePerDay = dayOfMonth > 0 ? currentMonthTotal / dayOfMonth : 0;
      const daysInMonth = new Date(year, month, 0).getDate();
      const projectedMonthEnd = averagePerDay * daysInMonth;

      return {
        currentMonthTotal,
        monthlyLimit,
        remaining,
        percentUsed,
        daysEligible: eligibilityAnalysis.eligibleDays,
        daysClaimed: perDiemReceipts.length,
        isEligibleToday: todayEligibility.isEligible,
        todayEligibilityReason: todayEligibility.reason,
        receipts: perDiemReceipts.length,
        averagePerDay,
        projectedMonthEnd,
        status
      };
    } catch (error) {
      console.error('❌ PerDiemDashboard: Error getting Per Diem stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Analyze Per Diem eligibility for the entire month
   */
  private static async analyzeEligibilityForMonth(
    employee: Employee,
    month: number,
    year: number
  ): Promise<{ eligibleDays: number; unclaimedDays: number }> {
    try {
      // Get mileage and time tracking for the month
      const [mileageEntries, timeTracking] = await Promise.all([
        DatabaseService.getMileageEntries(employee.id, month, year),
        DatabaseService.getTimeTrackingEntries(employee.id, month, year)
      ]);

      // Group by date
      const dayActivity = new Map<string, { miles: number; hours: number }>();

      mileageEntries.forEach(entry => {
        const dateKey = entry.date.toISOString().split('T')[0];
        const existing = dayActivity.get(dateKey) || { miles: 0, hours: 0 };
        existing.miles += entry.miles;
        existing.hours += entry.hoursWorked || 0;
        dayActivity.set(dateKey, existing);
      });

      timeTracking.forEach(entry => {
        const dateKey = entry.date.toISOString().split('T')[0];
        const existing = dayActivity.get(dateKey) || { miles: 0, hours: 0 };
        if (entry.category === 'Working Hours') {
          existing.hours += entry.hours;
        }
        dayActivity.set(dateKey, existing);
      });

      // Get employee's cost center for Per Diem rules
      const costCenter = employee.defaultCostCenter || employee.costCenters?.[0] || 'Program Services';
      const rule = await PerDiemRulesService.getPerDiemRule(costCenter);

      const minHours = rule?.minHours || 8;
      const minMiles = rule?.minMiles || 100;

      // Count eligible days
      let eligibleDays = 0;
      dayActivity.forEach(activity => {
        if (activity.hours >= minHours || activity.miles >= minMiles) {
          eligibleDays++;
        }
      });

      return {
        eligibleDays,
        unclaimedDays: 0 // Could calculate this by comparing with claimed days
      };
    } catch (error) {
      console.error('❌ PerDiemDashboard: Error analyzing eligibility:', error);
      return { eligibleDays: 0, unclaimedDays: 0 };
    }
  }

  /**
   * Check if employee is eligible for Per Diem today
   */
  private static async checkEligibilityForToday(
    employee: Employee
  ): Promise<{ isEligible: boolean; reason: string }> {
    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      // Get today's activity
      const [mileageEntries, timeTracking] = await Promise.all([
        DatabaseService.getMileageEntries(employee.id),
        DatabaseService.getTimeTrackingEntries(employee.id)
      ]);

      // Filter for today
      const todayMileage = mileageEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.toISOString().split('T')[0] === todayStart.toISOString().split('T')[0];
      });

      const todayTimeTracking = timeTracking.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.toISOString().split('T')[0] === todayStart.toISOString().split('T')[0];
      });

      const totalMiles = todayMileage.reduce((sum, entry) => sum + entry.miles, 0);
      const totalHours = todayTimeTracking
        .filter(entry => entry.category === 'Working Hours')
        .reduce((sum, entry) => sum + entry.hours, 0);

      // Get Per Diem rules
      const costCenter = employee.defaultCostCenter || employee.costCenters?.[0] || 'Program Services';
      const rule = await PerDiemRulesService.getPerDiemRule(costCenter);

      const minHours = rule?.minHours || 8;
      const minMiles = rule?.minMiles || 100;

      // Check eligibility
      if (totalHours >= minHours) {
        return {
          isEligible: true,
          reason: `${totalHours.toFixed(1)}h worked (≥${minHours}h required)`
        };
      } else if (totalMiles >= minMiles) {
        return {
          isEligible: true,
          reason: `${totalMiles.toFixed(1)} miles (≥${minMiles} miles required)`
        };
      } else {
        return {
          isEligible: false,
          reason: `Need ${minHours}h worked OR ${minMiles}+ miles`
        };
      }
    } catch (error) {
      console.error('❌ PerDiemDashboard: Error checking today eligibility:', error);
      return {
        isEligible: false,
        reason: 'Unable to determine eligibility'
      };
    }
  }

  /**
   * Get empty stats (fallback)
   */
  private static getEmptyStats(): PerDiemDashboardStats {
    return {
      currentMonthTotal: 0,
      monthlyLimit: this.DEFAULT_MONTHLY_LIMIT,
      remaining: this.DEFAULT_MONTHLY_LIMIT,
      percentUsed: 0,
      daysEligible: 0,
      daysClaimed: 0,
      isEligibleToday: false,
      todayEligibilityReason: 'No data available',
      receipts: 0,
      averagePerDay: 0,
      projectedMonthEnd: 0,
      status: 'safe'
    };
  }
}


/**
 * Per Diem Dashboard Service
 * Provides Per Diem statistics and eligibility information for dashboard widgets
 * Eligibility rule: 8+ hours AND (100+ miles OR stayed overnight 50+ mi from base)
 */

import { DatabaseService } from './database';
import { PerDiemRulesService } from './perDiemRulesService';
import { PerDiemAiService } from './perDiemAiService';
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

      // Only show "Eligible today" if they haven't already claimed per diem for today
      const today = new Date();
      const hasPerDiemForToday = perDiemReceipts.some(
        (r) => r.date && new Date(r.date).toDateString() === today.toDateString()
      );
      const isEligibleTodayUnclaimed = todayEligibility.isEligible && !hasPerDiemForToday;

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
        isEligibleToday: isEligibleTodayUnclaimed,
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
   * Analyze Per Diem eligibility for the entire month.
   * Uses same rule as Per Diem screen: 8+ hours AND (100+ miles OR stayed overnight 50+ mi from base).
   */
  private static async analyzeEligibilityForMonth(
    employee: Employee,
    month: number,
    year: number
  ): Promise<{ eligibleDays: number; unclaimedDays: number }> {
    try {
      const eligibilityMap = await PerDiemAiService.getEligibilityForMonth(employee.id, month, year);
      let eligibleDays = 0;
      eligibilityMap.forEach(({ isEligible }) => {
        if (isEligible) eligibleDays++;
      });
      return {
        eligibleDays,
        unclaimedDays: 0
      };
    } catch (error) {
      console.error('❌ PerDiemDashboard: Error analyzing eligibility:', error);
      return { eligibleDays: 0, unclaimedDays: 0 };
    }
  }

  /**
   * Check if employee is eligible for Per Diem today.
   * Uses same rule: 8+ hours AND (100+ miles OR stayed overnight 50+ mi from base).
   */
  private static async checkEligibilityForToday(
    employee: Employee
  ): Promise<{ isEligible: boolean; reason: string }> {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const eligibilityMap = await PerDiemAiService.getEligibilityForMonth(employee.id, month, year);
      const dateKey = today.toISOString().split('T')[0];
      const dayResult = eligibilityMap.get(dateKey);
      return dayResult ?? { isEligible: false, reason: 'Unable to determine eligibility' };
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


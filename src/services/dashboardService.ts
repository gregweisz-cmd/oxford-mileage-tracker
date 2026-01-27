/**
 * Dashboard Service
 * Uses BackendDataService for monthly stats when available (so Hours Worked tile
 * reflects cleared/updated data from Hours & Description), falls back to UnifiedDataService.
 */

import { DatabaseService } from './database';
import { UnifiedDataService } from './unifiedDataService';
import { BackendDataService } from './backendDataService';
import { MileageEntry, Receipt } from '../types';

export class DashboardService {
  /**
   * Get dashboard stats. Tries backend first for monthly stats so the Hours Worked
   * tile stays in sync with data changed on the Hours & Description screen.
   */
  static async getDashboardStats(employeeId: string, month?: number, year?: number): Promise<{
    recentMileageEntries: MileageEntry[];
    recentReceipts: Receipt[];
    monthlyStats: {
      totalMiles: number;
      totalHours: number;
      totalReceipts: number;
      totalPerDiemReceipts: number;
      mileageEntries: MileageEntry[];
      receipts: Receipt[];
    };
  }> {
    const now = new Date();
    const selectedMonth = month || now.getMonth() + 1;
    const selectedYear = year || now.getFullYear();

    try {
      // Get recent entries (last 5) from local DB
      const [recentMileageEntries, recentReceipts] = await Promise.all([
        DatabaseService.getMileageEntries(employeeId),
        DatabaseService.getReceipts(employeeId)
      ]);

      // Prefer backend for monthly stats so "Hours Worked" reflects changes from Hours & Description
      let monthlySummary: { totalHours: number; totalMiles: number; totalReceipts: number; totalPerDiemReceipts: number };
      let monthlyData: { mileageEntries: MileageEntry[]; receipts: Receipt[]; totalHours: number }[];

      try {
        const backendMonthData = await BackendDataService.getMonthData(employeeId, selectedMonth, selectedYear);
        const totalHours = backendMonthData.reduce((s, d) => s + d.totalHours, 0);
        const totalMiles = backendMonthData.reduce((s, d) => s + d.totalMiles, 0);
        const totalReceipts = backendMonthData.reduce((s, d) => s + d.totalReceipts, 0);
        const totalPerDiemReceipts = backendMonthData.reduce((s, d) => {
          const perDiem = d.receipts.filter((r: Receipt) => r.category === 'Per Diem').reduce((sum: number, r: Receipt) => sum + r.amount, 0);
          return s + perDiem;
        }, 0);
        monthlySummary = { totalHours, totalMiles, totalReceipts, totalPerDiemReceipts };
        monthlyData = backendMonthData;
      } catch {
        const unifiedSummary = await UnifiedDataService.getDashboardSummary(employeeId, selectedMonth, selectedYear);
        const unifiedMonthData = await UnifiedDataService.getMonthData(employeeId, selectedMonth, selectedYear);
        monthlySummary = unifiedSummary;
        monthlyData = unifiedMonthData;
      }

      const monthlyMileageEntries: MileageEntry[] = [];
      const monthlyReceipts: Receipt[] = [];
      monthlyData.forEach((day: { mileageEntries?: MileageEntry[]; receipts?: Receipt[] }) => {
        monthlyMileageEntries.push(...(day.mileageEntries || []));
        monthlyReceipts.push(...(day.receipts || []));
      });

      return {
        recentMileageEntries: recentMileageEntries.slice(0, 5),
        recentReceipts: recentReceipts.slice(0, 5),
        monthlyStats: {
          totalMiles: monthlySummary.totalMiles,
          totalHours: monthlySummary.totalHours,
          totalReceipts: monthlySummary.totalReceipts,
          totalPerDiemReceipts: monthlySummary.totalPerDiemReceipts || 0,
          mileageEntries: monthlyMileageEntries,
          receipts: monthlyReceipts
        }
      };
    } catch (error) {
      console.error('❌ DashboardService: Error getting dashboard stats:', error);
      // Return empty stats on error
      return {
        recentMileageEntries: [],
        recentReceipts: [],
        monthlyStats: {
          totalMiles: 0,
          totalHours: 0,
          totalReceipts: 0,
          totalPerDiemReceipts: 0,
          mileageEntries: [],
          receipts: []
        }
      };
    }
  }
}

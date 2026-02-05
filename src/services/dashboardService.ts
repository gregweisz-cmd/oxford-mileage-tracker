/**
 * Dashboard Service
 * Uses local DB (UnifiedDataService) for stats so the home screen shows exactly what was
 * synced from the backend, avoiding mismatches when the backend API fails or returns different data per device.
 */

import { DatabaseService } from './database';
import { UnifiedDataService } from './unifiedDataService';
import { MileageEntry, Receipt } from '../types';

export class DashboardService {
  /**
   * Get dashboard stats from local DB (synced from backend). Numbers match what was last synced.
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
      const [recentMileageEntries, recentReceipts] = await Promise.all([
        DatabaseService.getMileageEntries(employeeId),
        DatabaseService.getReceipts(employeeId)
      ]);

      const monthlySummary = await UnifiedDataService.getDashboardSummary(employeeId, selectedMonth, selectedYear);
      const monthlyData = await UnifiedDataService.getMonthData(employeeId, selectedMonth, selectedYear);

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

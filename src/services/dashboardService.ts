/**
 * Dashboard Service
 * Uses UnifiedDataService for consistent data access
 */

import { DatabaseService } from './database';
import { UnifiedDataService } from './unifiedDataService';
import { MileageEntry, Receipt } from '../types';

export class DashboardService {
  /**
   * Get dashboard stats using unified data service
   */
  static async getDashboardStats(employeeId: string): Promise<{
    recentMileageEntries: MileageEntry[];
    recentReceipts: Receipt[];
    monthlyStats: {
      totalMiles: number;
      totalHours: number;
      totalReceipts: number;
      mileageEntries: MileageEntry[];
      receipts: Receipt[];
    };
  }> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
      // Get recent entries (last 5)
      const [recentMileageEntries, recentReceipts] = await Promise.all([
        DatabaseService.getMileageEntries(employeeId),
        DatabaseService.getReceipts(employeeId)
      ]);

      // Get monthly summary using unified service
      const monthlySummary = await UnifiedDataService.getDashboardSummary(employeeId, month, year);
      
      // Get monthly data for detailed breakdown
      const monthlyData = await UnifiedDataService.getMonthData(employeeId, month, year);
      
      // Extract mileage entries and receipts from monthly data
      const monthlyMileageEntries: MileageEntry[] = [];
      const monthlyReceipts: Receipt[] = [];
      
      monthlyData.forEach(day => {
        monthlyMileageEntries.push(...day.mileageEntries);
        monthlyReceipts.push(...day.receipts);
      });

      return {
        recentMileageEntries: recentMileageEntries.slice(0, 5),
        recentReceipts: recentReceipts.slice(0, 5),
        monthlyStats: {
          totalMiles: monthlySummary.totalMiles,
          totalHours: monthlySummary.totalHours,
          totalReceipts: monthlySummary.totalReceipts,
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
          mileageEntries: [],
          receipts: []
        }
      };
    }
  }
}

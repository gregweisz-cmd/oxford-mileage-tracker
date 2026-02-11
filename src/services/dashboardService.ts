/**
 * Dashboard Service
 * Uses backend as source of truth for dashboard tiles so numbers match the web portal
 * and Hours & Description page. Falls back to local DB if backend is unavailable.
 */

import { DatabaseService } from './database';
import { UnifiedDataService } from './unifiedDataService';
import { BackendDataService } from './backendDataService';
import { MileageEntry, Receipt } from '../types';
import { UnifiedDayData } from './unifiedDataService';

export class DashboardService {
  /**
   * Get dashboard stats from backend so tiles match web portal and Hours & Description.
   * Falls back to local DB (UnifiedDataService) if backend request fails.
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

    const emptyResult = {
      recentMileageEntries: [] as MileageEntry[],
      recentReceipts: [] as Receipt[],
      monthlyStats: {
        totalMiles: 0,
        totalHours: 0,
        totalReceipts: 0,
        totalPerDiemReceipts: 0,
        mileageEntries: [] as MileageEntry[],
        receipts: [] as Receipt[]
      }
    };

    try {
      // Prefer backend so dashboard matches web portal and Hours & Description page
      const monthlyData = await BackendDataService.getMonthData(employeeId, selectedMonth, selectedYear);
      return this.aggregateMonthDataToDashboardStats(monthlyData);
    } catch (backendError) {
      console.warn('⚠️ DashboardService: Backend failed, using local data:', backendError);
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
      } catch (localError) {
        console.error('❌ DashboardService: Error getting dashboard stats:', localError);
        return emptyResult;
      }
    }
  }

  /**
   * Aggregate BackendDataService.getMonthData() result into dashboard stats format.
   */
  private static aggregateMonthDataToDashboardStats(monthlyData: UnifiedDayData[]): {
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
  } {
    const totalHours = monthlyData.reduce((sum, day) => sum + day.totalHours, 0);
    const totalMiles = monthlyData.reduce((sum, day) => sum + day.totalMiles, 0);
    const mileageEntries: MileageEntry[] = [];
    const receipts: Receipt[] = [];
    monthlyData.forEach(day => {
      mileageEntries.push(...(day.mileageEntries || []));
      receipts.push(...(day.receipts || []));
    });
    const totalPerDiemReceipts = receipts
      .filter(r => r.category === 'Per Diem')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalReceipts = receipts
      .filter(r => r.category !== 'Per Diem')
      .reduce((sum, r) => sum + r.amount, 0);

    // Recent: sort by date descending, take first 5
    const byDateDesc = (a: { date: Date }, b: { date: Date }) =>
      new Date(b.date).getTime() - new Date(a.date).getTime();
    const recentMileageEntries = [...mileageEntries].sort(byDateDesc).slice(0, 5);
    const recentReceipts = [...receipts].sort(byDateDesc).slice(0, 5);

    return {
      recentMileageEntries,
      recentReceipts,
      monthlyStats: {
        totalMiles,
        totalHours,
        totalReceipts,
        totalPerDiemReceipts,
        mileageEntries,
        receipts
      }
    };
  }
}

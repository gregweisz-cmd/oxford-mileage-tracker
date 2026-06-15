/**
 * Dashboard Service
 * Local-first for responsive Home UI; optional background refresh from backend.
 */

import { DatabaseService } from './database';
import { UnifiedDataService } from './unifiedDataService';
import { BackendDataService } from './backendDataService';
import { MileageEntry, Receipt } from '../types';
import { UnifiedDayData } from './unifiedDataService';

export type DashboardStats = {
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
};

const emptyDashboardStats = (month: number, year: number): DashboardStats => ({
  recentMileageEntries: [],
  recentReceipts: [],
  monthlyStats: {
    totalMiles: 0,
    totalHours: 0,
    totalReceipts: 0,
    totalPerDiemReceipts: 0,
    mileageEntries: [],
    receipts: [],
  },
});

function monthYearOrNow(month?: number, year?: number): { month: number; year: number } {
  const now = new Date();
  return {
    month: month || now.getMonth() + 1,
    year: year || now.getFullYear(),
  };
}

export class DashboardService {
  /**
   * Fast path: SQLite / UnifiedDataService only (no network).
   */
  static async getDashboardStatsFromLocal(
    employeeId: string,
    month?: number,
    year?: number
  ): Promise<DashboardStats> {
    const { month: selectedMonth, year: selectedYear } = monthYearOrNow(month, year);

    try {
      const [recentMileageEntries, recentReceipts] = await Promise.all([
        DatabaseService.getMileageEntries(employeeId, selectedMonth, selectedYear),
        DatabaseService.getReceipts(employeeId, selectedMonth, selectedYear),
      ]);
      const monthlySummary = await UnifiedDataService.getDashboardSummary(
        employeeId,
        selectedMonth,
        selectedYear
      );
      const monthlyData = await UnifiedDataService.getMonthData(
        employeeId,
        selectedMonth,
        selectedYear
      );
      const monthlyMileageEntries: MileageEntry[] = [];
      const monthlyReceipts: Receipt[] = [];
      monthlyData.forEach((day: { mileageEntries?: MileageEntry[]; receipts?: Receipt[] }) => {
        monthlyMileageEntries.push(...(day.mileageEntries || []));
        monthlyReceipts.push(...(day.receipts || []));
      });

      const byDateDesc = (a: { date: Date }, b: { date: Date }) =>
        new Date(b.date).getTime() - new Date(a.date).getTime();

      return {
        recentMileageEntries: [...recentMileageEntries].sort(byDateDesc).slice(0, 5),
        recentReceipts: [...recentReceipts].sort(byDateDesc).slice(0, 5),
        monthlyStats: {
          totalMiles: monthlySummary.totalMiles,
          totalHours: monthlySummary.totalHours,
          totalReceipts: monthlySummary.totalReceipts,
          totalPerDiemReceipts: monthlySummary.totalPerDiemReceipts || 0,
          mileageEntries: monthlyMileageEntries,
          receipts: monthlyReceipts,
        },
      };
    } catch (error) {
      console.error('❌ DashboardService: Error loading local dashboard stats:', error);
      return emptyDashboardStats(selectedMonth, selectedYear);
    }
  }

  /**
   * Network path: backend month APIs (matches web portal).
   */
  static async getDashboardStatsFromBackend(
    employeeId: string,
    month?: number,
    year?: number
  ): Promise<DashboardStats> {
    const { month: selectedMonth, year: selectedYear } = monthYearOrNow(month, year);

    const monthlyData = await BackendDataService.getMonthData(
      employeeId,
      selectedMonth,
      selectedYear
    );
    let result = this.aggregateMonthDataToDashboardStats(monthlyData);

    if (result.recentMileageEntries.length === 0 && result.monthlyStats.totalMiles === 0) {
      const localMileage = await DatabaseService.getMileageEntries(
        employeeId,
        selectedMonth,
        selectedYear
      );
      const totalMiles = localMileage.reduce((s, e) => s + e.miles, 0);
      const byDateDesc = (a: { date: Date }, b: { date: Date }) =>
        new Date(b.date).getTime() - new Date(a.date).getTime();
      const recentMileageEntries = [...localMileage].sort(byDateDesc).slice(0, 5);
      result = {
        ...result,
        recentMileageEntries,
        monthlyStats: {
          ...result.monthlyStats,
          totalMiles,
          mileageEntries: localMileage,
        },
      };
    }

    if (result.recentReceipts.length === 0 && result.monthlyStats.receipts.length === 0) {
      const localReceipts = await DatabaseService.getReceipts(
        employeeId,
        selectedMonth,
        selectedYear
      );
      const byDateDesc = (a: { date: Date }, b: { date: Date }) =>
        new Date(b.date).getTime() - new Date(a.date).getTime();
      const recentReceipts = [...localReceipts].sort(byDateDesc).slice(0, 5);
      const totalReceipts = localReceipts
        .filter((r) => r.category !== 'Per Diem')
        .reduce((s, r) => s + r.amount, 0);
      const totalPerDiemReceipts = localReceipts
        .filter((r) => r.category === 'Per Diem')
        .reduce((s, r) => s + r.amount, 0);
      result = {
        ...result,
        recentReceipts,
        monthlyStats: {
          ...result.monthlyStats,
          totalReceipts,
          totalPerDiemReceipts: result.monthlyStats.totalPerDiemReceipts || totalPerDiemReceipts,
          receipts: localReceipts,
        },
      };
    }

    return result;
  }

  /**
   * @deprecated Prefer getDashboardStatsFromLocal + optional background getDashboardStatsFromBackend.
   */
  static async getDashboardStats(
    employeeId: string,
    month?: number,
    year?: number
  ): Promise<DashboardStats> {
    const { month: selectedMonth, year: selectedYear } = monthYearOrNow(month, year);
    try {
      return await this.getDashboardStatsFromBackend(employeeId, selectedMonth, selectedYear);
    } catch (backendError) {
      console.warn('⚠️ DashboardService: Backend failed, using local data:', backendError);
      return this.getDashboardStatsFromLocal(employeeId, selectedMonth, selectedYear);
    }
  }

  private static aggregateMonthDataToDashboardStats(monthlyData: UnifiedDayData[]): DashboardStats {
    const totalHours = monthlyData.reduce((sum, day) => sum + day.totalHours, 0);
    const totalMiles = monthlyData.reduce((sum, day) => sum + day.totalMiles, 0);
    const mileageEntries: MileageEntry[] = [];
    const receipts: Receipt[] = [];
    monthlyData.forEach((day) => {
      mileageEntries.push(...(day.mileageEntries || []));
      receipts.push(...(day.receipts || []));
    });
    const totalPerDiemReceipts = receipts
      .filter((r) => r.category === 'Per Diem')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalReceipts = receipts
      .filter((r) => r.category !== 'Per Diem')
      .reduce((sum, r) => sum + r.amount, 0);

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
        receipts,
      },
    };
  }
}

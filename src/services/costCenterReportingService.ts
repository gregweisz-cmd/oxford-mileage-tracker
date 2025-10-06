/**
 * Cost Center Reporting Service
 * Aggregates all employee data by cost center for comprehensive reporting
 */

import { DatabaseService } from './database';
import { CostCenterSummary, MileageEntry, Receipt, TimeTracking, DailyDescription, Employee } from '../types';
import { PerDiemService } from './perDiemService';

export interface CostCenterReport {
  costCenter: string;
  month: number;
  year: number;
  totalHours: number;
  totalMiles: number;
  totalReceipts: number;
  totalPerDiem: number;
  totalExpenses: number;
  mileageEntries: MileageEntry[];
  receipts: Receipt[];
  timeTrackingEntries: TimeTracking[];
  descriptionEntries: DailyDescription[];
  entryCounts: {
    mileageEntries: number;
    receiptEntries: number;
    timeTrackingEntries: number;
    descriptionEntries: number;
  };
}

export interface CostCenterMonthlyReport {
  employeeId: string;
  month: number;
  year: number;
  costCenterReports: CostCenterReport[];
  totals: {
    totalHours: number;
    totalMiles: number;
    totalReceipts: number;
    totalPerDiem: number;
    totalExpenses: number;
    totalEntries: number;
  };
}

export class CostCenterReportingService {
  /**
   * Generate comprehensive cost center report for an employee for a specific month
   */
  static async generateMonthlyCostCenterReport(
    employeeId: string, 
    month: number, 
    year: number
  ): Promise<CostCenterMonthlyReport> {
    console.log('📊 CostCenterReportingService: Generating monthly report for:', { employeeId, month, year });
    
    // Get all data for the month
    const [mileageEntries, receipts, timeTrackingEntries, dailyDescriptions, employee] = await Promise.all([
      DatabaseService.getMileageEntries(employeeId, month, year),
      DatabaseService.getReceipts(employeeId, month, year),
      DatabaseService.getTimeTrackingEntries(employeeId, month, year),
      DatabaseService.getDailyDescriptions(employeeId, month, year),
      DatabaseService.getEmployeeById(employeeId)
    ]);
    
    console.log('📊 CostCenterReportingService: Raw data counts:', {
      mileageEntries: mileageEntries.length,
      receipts: receipts.length,
      timeTrackingEntries: timeTrackingEntries.length,
      dailyDescriptions: dailyDescriptions.length
    });
    
    // Group data by cost center
    const costCenterData = new Map<string, {
      mileageEntries: MileageEntry[];
      receipts: Receipt[];
      timeTrackingEntries: TimeTracking[];
      descriptionEntries: DailyDescription[];
    }>();
    
    // Process mileage entries
    mileageEntries.forEach((entry: MileageEntry) => {
      const costCenter = entry.costCenter || employee?.defaultCostCenter || 'Unassigned';
      if (!costCenterData.has(costCenter)) {
        costCenterData.set(costCenter, {
          mileageEntries: [],
          receipts: [],
          timeTrackingEntries: [],
          descriptionEntries: []
        });
      }
      costCenterData.get(costCenter)!.mileageEntries.push(entry);
    });
    
    // Process receipts
    receipts.forEach((receipt: Receipt) => {
      const costCenter = receipt.costCenter || employee?.defaultCostCenter || 'Unassigned';
      if (!costCenterData.has(costCenter)) {
        costCenterData.set(costCenter, {
          mileageEntries: [],
          receipts: [],
          timeTrackingEntries: [],
          descriptionEntries: []
        });
      }
      costCenterData.get(costCenter)!.receipts.push(receipt);
    });
    
    // Process time tracking entries
    timeTrackingEntries.forEach((entry: TimeTracking) => {
      const costCenter = entry.costCenter || employee?.defaultCostCenter || 'Unassigned';
      if (!costCenterData.has(costCenter)) {
        costCenterData.set(costCenter, {
          mileageEntries: [],
          receipts: [],
          timeTrackingEntries: [],
          descriptionEntries: []
        });
      }
      costCenterData.get(costCenter)!.timeTrackingEntries.push(entry);
    });
    
    // Process daily descriptions
    dailyDescriptions.forEach((description: DailyDescription) => {
      const costCenter = description.costCenter || employee?.defaultCostCenter || 'Unassigned';
      if (!costCenterData.has(costCenter)) {
        costCenterData.set(costCenter, {
          mileageEntries: [],
          receipts: [],
          timeTrackingEntries: [],
          descriptionEntries: []
        });
      }
      costCenterData.get(costCenter)!.descriptionEntries.push(description);
    });
    
    // Generate cost center reports
    const costCenterReports: CostCenterReport[] = [];
    let totalHours = 0;
    let totalMiles = 0;
    let totalReceipts = 0;
    let totalPerDiem = 0;
    let totalExpenses = 0;
    let totalEntries = 0;
    
    for (const [costCenter, data] of costCenterData) {
      // Calculate totals for this cost center
      const costCenterHours = data.timeTrackingEntries.reduce((sum, entry) => sum + entry.hours, 0);
      const costCenterMiles = data.mileageEntries.reduce((sum, entry) => sum + entry.miles, 0);
      const costCenterReceipts = data.receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
      
      // Calculate per diem for this cost center
      const perDiemCalculation = await PerDiemService.calculateMonthlyPerDiem(
        employeeId,
        month,
        year,
        data.mileageEntries,
        employee || { id: employeeId, name: '', email: '', password: '', oxfordHouseId: '', position: '', baseAddress: '', costCenters: [], selectedCostCenters: [], createdAt: new Date(), updatedAt: new Date() }
      );
      const costCenterPerDiem = perDiemCalculation.totalPerDiem;
      
      const costCenterExpenses = costCenterMiles * 0.655 + costCenterReceipts + costCenterPerDiem;
      
      const report: CostCenterReport = {
        costCenter,
        month,
        year,
        totalHours: costCenterHours,
        totalMiles: costCenterMiles,
        totalReceipts: costCenterReceipts,
        totalPerDiem: costCenterPerDiem,
        totalExpenses: costCenterExpenses,
        mileageEntries: data.mileageEntries,
        receipts: data.receipts,
        timeTrackingEntries: data.timeTrackingEntries,
        descriptionEntries: data.descriptionEntries,
        entryCounts: {
          mileageEntries: data.mileageEntries.length,
          receiptEntries: data.receipts.length,
          timeTrackingEntries: data.timeTrackingEntries.length,
          descriptionEntries: data.descriptionEntries.length
        }
      };
      
      costCenterReports.push(report);
      
      // Add to totals
      totalHours += costCenterHours;
      totalMiles += costCenterMiles;
      totalReceipts += costCenterReceipts;
      totalPerDiem += costCenterPerDiem;
      totalExpenses += costCenterExpenses;
      totalEntries += data.mileageEntries.length + data.receipts.length + data.timeTrackingEntries.length + data.descriptionEntries.length;
    }
    
    // Sort cost center reports by cost center name
    costCenterReports.sort((a, b) => a.costCenter.localeCompare(b.costCenter));
    
    const monthlyReport: CostCenterMonthlyReport = {
      employeeId,
      month,
      year,
      costCenterReports,
      totals: {
        totalHours,
        totalMiles,
        totalReceipts,
        totalPerDiem,
        totalExpenses,
        totalEntries
      }
    };
    
    console.log('📊 CostCenterReportingService: Generated report with', costCenterReports.length, 'cost centers');
    console.log('📊 CostCenterReportingService: Totals:', monthlyReport.totals);
    
    return monthlyReport;
  }
  
  /**
   * Update or create cost center summaries for a specific month
   */
  static async updateCostCenterSummaries(employeeId: string, month: number, year: number): Promise<void> {
    console.log('📊 CostCenterReportingService: Updating cost center summaries for:', { employeeId, month, year });
    
    const monthlyReport = await this.generateMonthlyCostCenterReport(employeeId, month, year);
    
    for (const costCenterReport of monthlyReport.costCenterReports) {
      const existingSummary = await DatabaseService.getCostCenterSummary(
        employeeId, 
        costCenterReport.costCenter, 
        month, 
        year
      );
      
      const summaryData = {
        employeeId,
        costCenter: costCenterReport.costCenter,
        month,
        year,
        totalHours: costCenterReport.totalHours,
        totalMiles: costCenterReport.totalMiles,
        totalReceipts: costCenterReport.totalReceipts,
        totalPerDiem: costCenterReport.totalPerDiem,
        totalExpenses: costCenterReport.totalExpenses,
        mileageEntries: costCenterReport.entryCounts.mileageEntries,
        receiptEntries: costCenterReport.entryCounts.receiptEntries,
        timeTrackingEntries: costCenterReport.entryCounts.timeTrackingEntries,
        descriptionEntries: costCenterReport.entryCounts.descriptionEntries
      };
      
      if (existingSummary) {
        await DatabaseService.updateCostCenterSummary(existingSummary.id, summaryData);
        console.log('📊 CostCenterReportingService: Updated summary for cost center:', costCenterReport.costCenter);
      } else {
        await DatabaseService.createCostCenterSummary(summaryData);
        console.log('📊 CostCenterReportingService: Created summary for cost center:', costCenterReport.costCenter);
      }
    }
  }
  
  /**
   * Get cost center summaries for an employee
   */
  static async getCostCenterSummaries(employeeId: string, month?: number, year?: number): Promise<CostCenterSummary[]> {
    return await DatabaseService.getCostCenterSummaries(employeeId, month, year);
  }
  
  /**
   * Get detailed cost center report with all entries
   */
  static async getDetailedCostCenterReport(
    employeeId: string, 
    costCenter: string, 
    month: number, 
    year: number
  ): Promise<CostCenterReport | null> {
    const monthlyReport = await this.generateMonthlyCostCenterReport(employeeId, month, year);
    return monthlyReport.costCenterReports.find(report => report.costCenter === costCenter) || null;
  }
  
  /**
   * Recalculate all cost center summaries for an employee (useful after data changes)
   */
  static async recalculateAllSummaries(employeeId: string): Promise<void> {
    console.log('📊 CostCenterReportingService: Recalculating all summaries for employee:', employeeId);
    
    // Get all unique months/years that have data
    const [mileageEntries, receipts, timeTrackingEntries, dailyDescriptions] = await Promise.all([
      DatabaseService.getMileageEntries(employeeId),
      DatabaseService.getReceipts(employeeId),
      DatabaseService.getTimeTrackingEntries(employeeId),
      DatabaseService.getDailyDescriptions(employeeId)
    ]);
    
    // Find all unique month/year combinations
    const monthYearSet = new Set<string>();
    
    [...mileageEntries, ...receipts, ...timeTrackingEntries, ...dailyDescriptions].forEach(entry => {
      const monthYear = `${entry.date.getMonth() + 1}-${entry.date.getFullYear()}`;
      monthYearSet.add(monthYear);
    });
    
    // Recalculate summaries for each month/year
    for (const monthYear of monthYearSet) {
      const [month, year] = monthYear.split('-').map(Number);
      await this.updateCostCenterSummaries(employeeId, month, year);
    }
    
    console.log('📊 CostCenterReportingService: Recalculated summaries for', monthYearSet.size, 'months');
  }
}

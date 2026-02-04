/**
 * Unified Data Service
 * Single source of truth for all employee data
 * Eliminates redundancy and ensures consistency
 */

import { DatabaseService } from './database';
import { MileageEntry, TimeTracking, Receipt, Employee } from '../types';

export interface UnifiedDayData {
  date: Date;
  employeeId: string;

  // Single source of truth for hours
  totalHours: number;
  /** Hours per cost center (matches web portal). Key = cost center name, value = hours. */
  costCenterHours: Record<string, number>;
  hoursBreakdown: {
    workingHours: number; // Sum of costCenterHours (for backward compat)
    gahours: number;
    holidayHours: number;
    ptoHours: number;
    stdLtdHours: number;
    pflPfmlHours: number;
  };

  // Single source of truth for mileage
  totalMiles: number;
  mileageEntries: MileageEntry[];

  // Single source of truth for receipts
  totalReceipts: number;
  receipts: Receipt[];

  // Metadata
  costCenter?: string;
  notes?: string;
  description?: string;
  /** Backend id of daily description row; used for reliable delete/update */
  descriptionId?: string;
  dayOff?: boolean;
  dayOffType?: string;
}

export class UnifiedDataService {
  /**
   * Format a Date as YYYY-MM-DD in local time to avoid timezone shifts.
   */
  private static toLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  /**
   * Get unified data for a specific day
   */
  static async getDayData(employeeId: string, date: Date): Promise<UnifiedDayData> {
    const dateStr = this.toLocalDateKey(date);
    
    // Get all data for this day
    const [mileageEntries, timeTrackingEntries, receipts, dailyDescription] = await Promise.all([
      DatabaseService.getMileageEntries(employeeId, date.getMonth() + 1, date.getFullYear()),
      DatabaseService.getTimeTrackingEntries(employeeId, date.getMonth() + 1, date.getFullYear()),
      DatabaseService.getReceipts(employeeId, date.getMonth() + 1, date.getFullYear()),
      DatabaseService.getDailyDescriptionByDate(employeeId, date)
    ]);
    
    // Filter to specific day
    const dayMileage = mileageEntries.filter(entry =>
      this.toLocalDateKey(entry.date) === dateStr
    );
    
    const dayTimeTracking = timeTrackingEntries.filter(entry =>
      this.toLocalDateKey(entry.date) === dateStr
    );
    
    const dayReceipts = receipts.filter(receipt =>
      this.toLocalDateKey(receipt.date) === dateStr
    );
    
    const costCenterHours: Record<string, number> = {};
    const hoursBreakdown = {
      workingHours: 0,
      gahours: 0,
      holidayHours: 0,
      ptoHours: 0,
      stdLtdHours: 0,
      pflPfmlHours: 0
    };

    // Working-hours entries: category '' or 'Working Hours' or 'Regular Hours' — group by costCenter
    dayTimeTracking.forEach(entry => {
      const category = (entry.category || '').trim();
      const cc = (entry.costCenter || '').trim();
      const isWorking = category === '' || category === 'Working Hours' || category === 'Regular Hours';
      if (isWorking && entry.hours > 0) {
        const key = cc || 'Unassigned';
        costCenterHours[key] = (costCenterHours[key] || 0) + entry.hours;
      }
    });
    hoursBreakdown.workingHours = Object.values(costCenterHours).reduce((s, h) => s + h, 0);

    // Other categories (dedupe by category, keep most recent)
    const categoryMap = new Map<string, any>();
    dayTimeTracking.forEach(entry => {
      const category = entry.category || '';
      const isWorking = category === '' || category === 'Working Hours' || category === 'Regular Hours';
      if (isWorking) return;
      const existing = categoryMap.get(category);
      if (!existing || (entry.updatedAt && existing.updatedAt && new Date(entry.updatedAt) > new Date(existing.updatedAt))) {
        categoryMap.set(category, entry);
      }
    });
    categoryMap.forEach(entry => {
      switch (entry.category) {
        case 'G&A Hours':
          hoursBreakdown.gahours += entry.hours;
          break;
        case 'Holiday Hours':
          hoursBreakdown.holidayHours += entry.hours;
          break;
        case 'PTO Hours':
          hoursBreakdown.ptoHours += entry.hours;
          break;
        case 'STD/LTD Hours':
          hoursBreakdown.stdLtdHours += entry.hours;
          break;
        case 'PFL/PFML Hours':
          hoursBreakdown.pflPfmlHours += entry.hours;
          break;
      }
    });

    const totalHours = hoursBreakdown.workingHours + Object.values(hoursBreakdown).slice(1).reduce((s, h) => s + h, 0);
    const totalMiles = dayMileage.reduce((sum, entry) => sum + entry.miles, 0);
    const totalReceipts = dayReceipts
      .filter(receipt => receipt.category !== 'Per Diem')
      .reduce((sum, receipt) => sum + receipt.amount, 0);

    return {
      date,
      employeeId,
      totalHours,
      costCenterHours,
      hoursBreakdown,
      totalMiles,
      mileageEntries: dayMileage,
      totalReceipts,
      receipts: dayReceipts,
      costCenter: dayTimeTracking[0]?.costCenter || dayMileage[0]?.costCenter || dailyDescription?.costCenter || '',
      notes: dayMileage[0]?.notes || '',
      description: dailyDescription?.description || '',
      dayOff: dailyDescription?.dayOff || false,
      dayOffType: dailyDescription?.dayOffType || undefined
    };
  }
  
  /**
   * Get unified data for a month
   */
  static async getMonthData(employeeId: string, month: number, year: number): Promise<UnifiedDayData[]> {
    // Get all data for the month in parallel
    const [mileageEntries, timeTrackingEntries, receipts, dailyDescriptions] = await Promise.all([
      DatabaseService.getMileageEntries(employeeId, month, year),
      DatabaseService.getTimeTrackingEntries(employeeId, month, year),
      DatabaseService.getReceipts(employeeId, month, year),
      DatabaseService.getDailyDescriptions(employeeId, month, year)
    ]);
    
    // Group data by date
    const daysMap = new Map<string, {
      mileage: any[],
      timeTracking: any[],
      receipts: any[],
      description?: string,
      dayOff?: boolean,
      dayOffType?: string
    }>();
    
    // Initialize all days of the month
    // month is 1-based (1=January, 12=December), but Date constructor expects 0-based
    // So we need to get the last day of the current month
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateKey = this.toLocalDateKey(date);
      daysMap.set(dateKey, {
        mileage: [],
        timeTracking: [],
        receipts: []
      });
    }
    
    // Group entries by date
    mileageEntries.forEach(entry => {
      const dateKey = this.toLocalDateKey(entry.date);
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.mileage.push(entry);
      }
    });
    
    timeTrackingEntries.forEach(entry => {
      const dateKey = this.toLocalDateKey(entry.date);
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.timeTracking.push(entry);
      }
    });
    
    receipts.forEach(receipt => {
      const dateKey = this.toLocalDateKey(receipt.date);
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.receipts.push(receipt);
      }
    });
    
    // Add daily descriptions
    dailyDescriptions.forEach(description => {
      const dateKey = this.toLocalDateKey(description.date);
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.description = description.description;
        dayData.dayOff = description.dayOff;
        dayData.dayOffType = description.dayOffType;
      }
    });
    
    // Convert to UnifiedDayData format
    const days: UnifiedDayData[] = [];
    daysMap.forEach((dayData, dateKey) => {
      // Create date in local timezone to avoid UTC conversion issues
      const [year, month, day] = dateKey.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      const costCenterHours: Record<string, number> = {};
      const hoursBreakdown = {
        workingHours: 0,
        gahours: 0,
        holidayHours: 0,
        ptoHours: 0,
        stdLtdHours: 0,
        pflPfmlHours: 0
      };

      dayData.timeTracking.forEach(entry => {
        const category = (entry.category || '').trim();
        const cc = (entry.costCenter || '').trim();
        const isWorking = category === '' || category === 'Working Hours' || category === 'Regular Hours';
        if (isWorking && entry.hours > 0) {
          const key = cc || 'Unassigned';
          costCenterHours[key] = (costCenterHours[key] || 0) + entry.hours;
        }
      });
      hoursBreakdown.workingHours = Object.values(costCenterHours).reduce((s, h) => s + h, 0);

      const categoryMap = new Map<string, any>();
      dayData.timeTracking.forEach(entry => {
        const category = entry.category || '';
        const isWorking = category === '' || category === 'Working Hours' || category === 'Regular Hours';
        if (isWorking) return;
        const existing = categoryMap.get(category);
        if (!existing || (entry.updatedAt && existing.updatedAt && new Date(entry.updatedAt) > new Date(existing.updatedAt))) {
          categoryMap.set(category, entry);
        }
      });
      categoryMap.forEach(entry => {
        switch (entry.category) {
          case 'G&A Hours':
            hoursBreakdown.gahours += entry.hours;
            break;
          case 'Holiday Hours':
            hoursBreakdown.holidayHours += entry.hours;
            break;
          case 'PTO Hours':
            hoursBreakdown.ptoHours += entry.hours;
            break;
          case 'STD/LTD Hours':
            hoursBreakdown.stdLtdHours += entry.hours;
            break;
          case 'PFL/PFML Hours':
            hoursBreakdown.pflPfmlHours += entry.hours;
            break;
        }
      });

      const totalHours = hoursBreakdown.workingHours + Object.values(hoursBreakdown).slice(1).reduce((s, h) => s + h, 0);
      const totalMiles = dayData.mileage.reduce((sum, entry) => sum + entry.miles, 0);
      const totalReceipts = dayData.receipts
        .filter(receipt => receipt.category !== 'Per Diem')
        .reduce((sum, receipt) => sum + receipt.amount, 0);

      days.push({
        date,
        employeeId,
        totalHours,
        costCenterHours,
        hoursBreakdown,
        totalMiles,
        mileageEntries: dayData.mileage,
        totalReceipts,
        receipts: dayData.receipts,
        costCenter: dayData.timeTracking[0]?.costCenter || dayData.mileage[0]?.costCenter || '',
        notes: dayData.mileage[0]?.notes || '',
        description: dayData.description || '',
        dayOff: dayData.dayOff || false,
        dayOffType: dayData.dayOffType || undefined
      });
    });
    
    return days.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  /**
   * Update hours for a specific day.
   * Supports per-cost-center working hours (matches web portal) and category hours (PTO, G&A, etc.).
   */
  static async updateDayHours(
    employeeId: string,
    date: Date,
    options: {
      /** Hours per cost center (key = cost center name). Replaces single "Working Hours" with one entry per center. */
      costCenterHours?: Record<string, number>;
      /** Category hours (PTO, G&A, etc.). If costCenterHours not provided, workingHours + costCenter used for one entry (legacy). */
      hoursBreakdown?: Partial<UnifiedDayData['hoursBreakdown']>;
      /** Used only when costCenterHours is not provided (legacy). */
      costCenter?: string;
    }
  ): Promise<void> {
    const { costCenterHours, hoursBreakdown = {}, costCenter } = options;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const existingEntries = await DatabaseService.getTimeTrackingEntries(employeeId, month, year);
    const dayEntries = existingEntries.filter(entry => {
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const entryDayStr = `${entryDate.getUTCFullYear()}-${String(entryDate.getUTCMonth() + 1).padStart(2, '0')}-${String(entryDate.getUTCDate()).padStart(2, '0')}`;
      return entryDayStr === dayStr;
    });

    for (const entry of dayEntries) {
      await DatabaseService.deleteTimeTracking(entry.id);
    }

    if (costCenterHours && Object.keys(costCenterHours).length > 0) {
      for (const [ccName, hours] of Object.entries(costCenterHours)) {
        if (hours > 0) {
          await DatabaseService.createTimeTracking({
            employeeId,
            date,
            category: 'Working Hours',
            hours,
            description: '',
            costCenter: ccName === 'Unassigned' ? '' : ccName
          });
        }
      }
    } else if (hoursBreakdown.workingHours != null && hoursBreakdown.workingHours > 0) {
      await DatabaseService.createTimeTracking({
        employeeId,
        date,
        category: 'Working Hours',
        hours: hoursBreakdown.workingHours,
        description: '',
        costCenter: costCenter || ''
      });
    }

    const categories = [
      { key: 'gahours', category: 'G&A Hours' },
      { key: 'holidayHours', category: 'Holiday Hours' },
      { key: 'ptoHours', category: 'PTO Hours' },
      { key: 'stdLtdHours', category: 'STD/LTD Hours' },
      { key: 'pflPfmlHours', category: 'PFL/PFML Hours' }
    ];
    for (const { key, category } of categories) {
      const hours = hoursBreakdown[key as keyof typeof hoursBreakdown] || 0;
      if (hours > 0) {
        await DatabaseService.createTimeTracking({
          employeeId,
          date,
          category: category as any,
          hours,
          description: '',
          costCenter: ''
        });
      }
    }
  }
  
  /**
   * Reset all hours for a specific month (set all to 0)
   */
  static async resetMonthHours(
    employeeId: string,
    month: number,
    year: number
  ): Promise<void> {
    // Get all time tracking entries for the month
    const existingEntries = await DatabaseService.getTimeTrackingEntries(
      employeeId,
      month,
      year
    );
    
    // Delete all entries for the month
    for (const entry of existingEntries) {
      await DatabaseService.deleteTimeTracking(entry.id);
    }
  }
  
  /**
   * Update daily description for a specific day
   */
  static async updateDayDescription(
    employeeId: string, 
    date: Date, 
    description: string,
    costCenter?: string,
    stayedOvernight?: boolean,
    dayOff?: boolean,
    dayOffType?: string
  ): Promise<void> {
    
    // Check if description already exists for this day
    const existingDescription = await DatabaseService.getDailyDescriptionByDate(employeeId, date);
    
    // If description is empty and not a day off, delete it
    const isEmpty = !description || description.trim() === '';
    if (isEmpty && !dayOff && existingDescription) {
      console.log(`🗑️ UnifiedDataService: Deleting daily description ${existingDescription.id} for date ${date.toISOString()}`);
      await DatabaseService.deleteDailyDescription(existingDescription.id);
      console.log(`✅ UnifiedDataService: Daily description deleted successfully`);
      return;
    }
    
    // If description is empty and not a day off but doesn't exist, nothing to delete
    if (isEmpty && !dayOff && !existingDescription) {
      console.log(`ℹ️ UnifiedDataService: No description to delete for date ${date.toISOString()}`);
      return;
    }
    
    // If it's a day off or has content, update or create
    if (existingDescription) {
      // Update existing description
      await DatabaseService.updateDailyDescription(existingDescription.id, {
        description,
        costCenter,
        stayedOvernight,
        dayOff,
        dayOffType
      });
    } else if (!isEmpty || dayOff) {
      // Create new description (only if not empty or is a day off)
      await DatabaseService.createDailyDescription({
        employeeId,
        date,
        description,
        costCenter,
        stayedOvernight,
        dayOff,
        dayOffType
      });
    }
  }
  
  /**
   * Get dashboard summary data
   */
  static async getDashboardSummary(employeeId: string, month: number, year: number): Promise<{
    totalHours: number;
    totalMiles: number;
    totalReceipts: number;
    totalPerDiemReceipts: number;
    daysWithData: number;
  }> {
    const monthData = await this.getMonthData(employeeId, month, year);
    
    const totalHours = monthData.reduce((sum, day) => sum + day.totalHours, 0);
    const totalMiles = monthData.reduce((sum, day) => sum + day.totalMiles, 0);
    const totalReceipts = monthData.reduce((sum, day) => sum + day.totalReceipts, 0);
    
    // Calculate total Per Diem receipts separately
    const totalPerDiemReceipts = monthData.reduce((sum, day) => {
      const perDiemAmount = day.receipts
        .filter(receipt => receipt.category === 'Per Diem')
        .reduce((daySum, receipt) => daySum + receipt.amount, 0);
      return sum + perDiemAmount;
    }, 0);
    
    const daysWithData = monthData.filter(day => 
      day.totalHours > 0 || day.totalMiles > 0 || day.totalReceipts > 0 || day.receipts.some(r => r.category === 'Per Diem')
    ).length;
    
    return {
      totalHours,
      totalMiles,
      totalReceipts,
      totalPerDiemReceipts,
      daysWithData
    };
  }
}

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
  hoursBreakdown: {
    workingHours: number;
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
}

export class UnifiedDataService {
  /**
   * Get unified data for a specific day
   */
  static async getDayData(employeeId: string, date: Date): Promise<UnifiedDayData> {
    const dateStr = date.toISOString().split('T')[0];
    
    // Get all data for this day
    const [mileageEntries, timeTrackingEntries, receipts, dailyDescription] = await Promise.all([
      DatabaseService.getMileageEntries(employeeId, date.getMonth() + 1, date.getFullYear()),
      DatabaseService.getTimeTrackingEntries(employeeId, date.getMonth() + 1, date.getFullYear()),
      DatabaseService.getReceipts(employeeId, date.getMonth() + 1, date.getFullYear()),
      DatabaseService.getDailyDescriptionByDate(employeeId, date)
    ]);
    
    // Filter to specific day
    const dayMileage = mileageEntries.filter(entry => 
      entry.date.toISOString().split('T')[0] === dateStr
    );
    
    const dayTimeTracking = timeTrackingEntries.filter(entry => 
      entry.date.toISOString().split('T')[0] === dateStr
    );
    
    const dayReceipts = receipts.filter(receipt => 
      receipt.date.toISOString().split('T')[0] === dateStr
    );
    
    // Calculate unified hours breakdown
    const hoursBreakdown = {
      workingHours: 0,
      gahours: 0,
      holidayHours: 0,
      ptoHours: 0,
      stdLtdHours: 0,
      pflPfmlHours: 0
    };
    
    // Process time tracking entries
    dayTimeTracking.forEach(entry => {
      switch (entry.category) {
        case 'Working Hours':
          hoursBreakdown.workingHours += entry.hours;
          break;
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
    
    // Calculate totals (exclude Per Diem receipts from regular receipts total)
    const totalHours = Object.values(hoursBreakdown).reduce((sum, hours) => sum + hours, 0);
    const totalMiles = dayMileage.reduce((sum, entry) => sum + entry.miles, 0);
    const totalReceipts = dayReceipts
      .filter(receipt => receipt.category !== 'Per Diem')
      .reduce((sum, receipt) => sum + receipt.amount, 0);
    
    return {
      date,
      employeeId,
      totalHours,
      hoursBreakdown,
      totalMiles,
      mileageEntries: dayMileage,
      totalReceipts,
      receipts: dayReceipts,
      costCenter: dayTimeTracking[0]?.costCenter || dayMileage[0]?.costCenter || dailyDescription?.costCenter || '',
      notes: dayMileage[0]?.notes || '',
      description: dailyDescription?.description || ''
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
      description?: string
    }>();
    
    // Initialize all days of the month
    // month is 1-based (1=January, 12=December), but Date constructor expects 0-based
    // So we need to get the last day of the current month
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateKey = date.toISOString().split('T')[0];
      daysMap.set(dateKey, {
        mileage: [],
        timeTracking: [],
        receipts: []
      });
    }
    
    // Group entries by date
    mileageEntries.forEach(entry => {
      const dateKey = entry.date.toISOString().split('T')[0];
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.mileage.push(entry);
      }
    });
    
    timeTrackingEntries.forEach(entry => {
      const dateKey = entry.date.toISOString().split('T')[0];
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.timeTracking.push(entry);
      }
    });
    
    receipts.forEach(receipt => {
      const dateKey = receipt.date.toISOString().split('T')[0];
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.receipts.push(receipt);
      }
    });
    
    // Add daily descriptions
    dailyDescriptions.forEach(description => {
      const dateKey = description.date.toISOString().split('T')[0];
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.description = description.description;
      }
    });
    
    // Convert to UnifiedDayData format
    const days: UnifiedDayData[] = [];
    daysMap.forEach((dayData, dateKey) => {
      // Create date in local timezone to avoid UTC conversion issues
      const [year, month, day] = dateKey.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Calculate hours breakdown
      const hoursBreakdown = {
        workingHours: 0,
        gahours: 0,
        holidayHours: 0,
        ptoHours: 0,
        stdLtdHours: 0,
        pflPfmlHours: 0
      };
      
      dayData.timeTracking.forEach(entry => {
        switch (entry.category) {
          case 'Working Hours':
            hoursBreakdown.workingHours += entry.hours;
            break;
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
      
      const totalHours = Object.values(hoursBreakdown).reduce((sum, hours) => sum + hours, 0);
      const totalMiles = dayData.mileage.reduce((sum, entry) => sum + entry.miles, 0);
      // Exclude Per Diem receipts from regular receipts total
      const totalReceipts = dayData.receipts
        .filter(receipt => receipt.category !== 'Per Diem')
        .reduce((sum, receipt) => sum + receipt.amount, 0);
      
      days.push({
        date,
        employeeId,
        totalHours,
        hoursBreakdown,
        totalMiles,
        mileageEntries: dayData.mileage,
        totalReceipts,
        receipts: dayData.receipts,
        costCenter: dayData.timeTracking[0]?.costCenter || dayData.mileage[0]?.costCenter || '',
        notes: dayData.mileage[0]?.notes || '',
        description: dayData.description || ''
      });
    });
    
    return days.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  /**
   * Update hours for a specific day
   * This is the ONLY way to modify hours data
   */
  static async updateDayHours(
    employeeId: string, 
    date: Date, 
    hoursBreakdown: Partial<UnifiedDayData['hoursBreakdown']>,
    costCenter?: string
  ): Promise<void> {
    // Delete existing time tracking entries for this day
    const existingEntries = await DatabaseService.getTimeTrackingEntries(
      employeeId, 
      date.getMonth() + 1, 
      date.getFullYear()
    );
    
    const dayStr = date.toISOString().split('T')[0];
    const dayEntries = existingEntries.filter(entry => 
      entry.date.toISOString().split('T')[0] === dayStr
    );
    
    // Delete existing entries
    for (const entry of dayEntries) {
      await DatabaseService.deleteTimeTracking(entry.id);
    }
    
    // Create new entries for each category with hours > 0
    const categories = [
      { key: 'workingHours', category: 'Working Hours' },
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
          costCenter: costCenter || ''
        });
      }
    }
  }
  
  /**
   * Update daily description for a specific day
   */
  static async updateDayDescription(
    employeeId: string, 
    date: Date, 
    description: string,
    costCenter?: string
  ): Promise<void> {
    
    // Check if description already exists for this day
    const existingDescription = await DatabaseService.getDailyDescriptionByDate(employeeId, date);
    
    if (existingDescription) {
      // Update existing description
      await DatabaseService.updateDailyDescription(existingDescription.id, {
        description,
        costCenter
      });
    } else {
      // Create new description
      await DatabaseService.createDailyDescription({
        employeeId,
        date,
        description,
        costCenter
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

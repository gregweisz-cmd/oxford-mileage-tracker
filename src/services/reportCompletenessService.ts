import { MileageEntry, Receipt, TimeTracking, Employee } from '../types';
import { DatabaseService } from './database';

export interface CompletenessIssue {
  id: string;
  type: 'missing_odometer' | 'incomplete_hours' | 'missing_receipt' | 'gap_detection' | 'missing_purpose' | 'incomplete_route';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggestion: string;
  affectedEntries?: string[];
  date?: Date;
  category?: string;
}

export interface CompletenessReport {
  employeeId: string;
  month: number;
  year: number;
  overallScore: number; // 0-100
  issues: CompletenessIssue[];
  recommendations: string[];
  isReadyForSubmission: boolean;
}

export class ReportCompletenessService {
  /**
   * Analyze report completeness for a given month/year using mobile app database
   */
  static async analyzeReportCompleteness(
    employeeId: string,
    month: number,
    year: number
  ): Promise<CompletenessReport> {
    console.log('🔍 ReportCompleteness: Analyzing report for', { employeeId, month, year });
    
    try {
      // Get all data for the month from the mobile database
      console.log('🔍 ReportCompleteness: Fetching data from local database...');
      
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      
      const [mileageEntries, receipts, timeTracking, employee] = await Promise.all([
        DatabaseService.getMileageEntries(employeeId, month, year),
        DatabaseService.getReceipts(employeeId, month, year),
        DatabaseService.getTimeTrackingEntries(employeeId, month, year),
        DatabaseService.getEmployeeById(employeeId)
      ]);

      console.log('🔍 ReportCompleteness: Data loaded:', {
        mileageCount: mileageEntries.length,
        receiptsCount: receipts.length,
        timeTrackingCount: timeTracking.length,
        employeeName: employee?.name
      });
      
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      const issues: CompletenessIssue[] = [];
      
      // Run all completeness checks
      issues.push(...this.checkMissingOdometerReadings(mileageEntries));
      issues.push(...this.checkIncompleteCostCenterHours(timeTracking, employee));
      issues.push(...this.checkMissingReceipts(mileageEntries, receipts));
      issues.push(...this.checkUnusualGaps(mileageEntries, timeTracking));
      issues.push(...this.checkMissingWorkDays(mileageEntries, timeTracking, month, year));
      issues.push(...this.checkMissingPurposes(mileageEntries));
      issues.push(...this.checkIncompleteRoutes(mileageEntries));
      
      // Calculate overall score
      const overallScore = this.calculateCompletenessScore(issues, mileageEntries.length, receipts.length);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(issues);
      
      // Determine if ready for submission
      const criticalIssues = issues.filter(issue => issue.severity === 'critical');
      const highIssues = issues.filter(issue => issue.severity === 'high');
      const isReadyForSubmission = criticalIssues.length === 0 && highIssues.length <= 1;
      
      const report: CompletenessReport = {
        employeeId,
        month,
        year,
        overallScore,
        issues,
        recommendations,
        isReadyForSubmission
      };
      
      console.log('✅ ReportCompleteness: Analysis complete', {
        score: overallScore,
        issuesCount: issues.length,
        readyForSubmission: isReadyForSubmission
      });
      
      return report;
      
    } catch (error) {
      console.error('❌ ReportCompleteness: Error analyzing report:', error);
      throw error;
    }
  }
  
  /**
   * Check for missing odometer readings in trip chains
   */
  private static checkMissingOdometerReadings(mileageEntries: MileageEntry[]): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    // Group entries by date
    const entriesByDate = this.groupEntriesByDate(mileageEntries);
    
    Object.entries(entriesByDate).forEach(([dateStr, entries]) => {
      const sortedEntries = entries.sort((a, b) => {
        const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return aDate.getTime() - bDate.getTime();
      });
      
      // Check for trip chains without proper odometer readings
      for (let i = 0; i < sortedEntries.length - 1; i++) {
        const currentEntry = sortedEntries[i];
        const nextEntry = sortedEntries[i + 1];
        
        // If current entry has odometer but next doesn't, it's an issue
        if (currentEntry.odometerReading && !nextEntry.odometerReading && 
            currentEntry.endLocation === nextEntry.startLocation) {
          issues.push({
            id: `missing-odometer-${nextEntry.id}`,
            type: 'missing_odometer',
            severity: 'high',
            title: 'Missing Odometer Reading',
            description: `Entry on ${dateStr} starting from ${nextEntry.startLocation} is missing odometer reading. Previous entry ended at the same location with reading ${currentEntry.odometerReading}`,
            suggestion: 'Add odometer reading to ensure accurate mileage calculation',
            affectedEntries: [nextEntry.id],
            date: new Date(dateStr)
          });
        }
      }
    });
    
    return issues;
  }
  
  /**
   * Check for incomplete cost center hour allocations
   */
  private static checkIncompleteCostCenterHours(timeTracking: TimeTracking[], employee: Employee): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    if (!employee || !employee.costCenters || employee.costCenters.length === 0) {
      return issues; // No cost centers to check
    }
    
    // Group time tracking by date
    const trackingByDate = this.groupTimeTrackingByDate(timeTracking);
    
    Object.entries(trackingByDate).forEach(([dateStr, entries]) => {
      const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
      
      // Check if hours are distributed across cost centers properly
      const costCenterHours = new Map<string, number>();
      entries.forEach(entry => {
        const cc = entry.costCenter || 'Unknown';
        costCenterHours.set(cc, (costCenterHours.get(cc) || 0) + entry.hours);
      });
      
      // If employee has multiple cost centers but all hours go to one, suggest distribution
      if (employee.costCenters.length > 1 && costCenterHours.size === 1 && totalHours >= 8) {
        issues.push({
          id: `incomplete-hours-${dateStr}`,
          type: 'incomplete_hours',
          severity: 'medium',
          title: 'Hours Not Distributed Across Cost Centers',
          description: `On ${dateStr}, all ${totalHours} hours were allocated to a single cost center. Consider distributing across multiple cost centers if applicable.`,
          suggestion: 'Review and distribute hours across appropriate cost centers',
          date: new Date(dateStr)
        });
      }
    });
    
    return issues;
  }
  
  /**
   * Check for missing receipts for expenses
   */
  private static checkMissingReceipts(mileageEntries: MileageEntry[], receipts: Receipt[]): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    // Group receipts by date
    const receiptsByDate = new Map<string, Receipt[]>();
    receipts.forEach(receipt => {
      const dateStr = receipt.date instanceof Date 
        ? receipt.date.toISOString().split('T')[0]
        : new Date(receipt.date).toISOString().split('T')[0];
      if (!receiptsByDate.has(dateStr)) {
        receiptsByDate.set(dateStr, []);
      }
      receiptsByDate.get(dateStr)!.push(receipt);
    });
    
    // Check if there are days with mileage but no receipts
    mileageEntries.forEach(entry => {
      const dateStr = entry.date instanceof Date 
        ? entry.date.toISOString().split('T')[0]
        : new Date(entry.date).toISOString().split('T')[0];
      
      if (!receiptsByDate.has(dateStr) && entry.miles > 50) {
        // High mileage days might have expenses
        issues.push({
          id: `missing-receipt-${entry.id}`,
          type: 'missing_receipt',
          severity: 'low',
          title: 'No Receipts for High Mileage Day',
          description: `${entry.miles} miles driven on ${dateStr} but no receipts recorded`,
          suggestion: 'Consider if any expenses (gas, tolls, parking) were incurred',
          date: new Date(dateStr)
        });
      }
    });
    
    return issues;
  }
  
  /**
   * Check for unusual gaps in work patterns
   */
  private static checkUnusualGaps(mileageEntries: MileageEntry[], timeTracking: TimeTracking[]): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    // Combine all dates
    const allDates = new Set<string>();
    mileageEntries.forEach(entry => {
      const dateStr = entry.date instanceof Date 
        ? entry.date.toISOString().split('T')[0]
        : new Date(entry.date).toISOString().split('T')[0];
      allDates.add(dateStr);
    });
    timeTracking.forEach(entry => {
      const dateStr = entry.date instanceof Date 
        ? entry.date.toISOString().split('T')[0]
        : new Date(entry.date).toISOString().split('T')[0];
      allDates.add(dateStr);
    });
    
    const sortedDates = Array.from(allDates).sort().map(d => new Date(d));
    
    // Check for gaps longer than 7 days
    for (let i = 1; i < sortedDates.length; i++) {
      const gapDays = Math.floor((sortedDates[i].getTime() - sortedDates[i-1].getTime()) / (1000 * 60 * 60 * 24));
      if (gapDays > 7) {
        issues.push({
          id: `gap-${sortedDates[i-1].toISOString()}`,
          type: 'gap_detection',
          severity: 'low',
          title: 'Long Gap Detected',
          description: `Gap of ${gapDays} days between ${sortedDates[i-1].toLocaleDateString()} and ${sortedDates[i].toLocaleDateString()}`,
          suggestion: 'Ensure all work days are properly recorded',
          date: sortedDates[i]
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Check for missing work days
   */
  private static checkMissingWorkDays(mileageEntries: MileageEntry[], timeTracking: TimeTracking[], month: number, year: number): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    // This is a simplified check - can be enhanced
    const workDays = mileageEntries.length + timeTracking.length;
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // If very few work days recorded, might be an issue
    if (workDays < 10 && daysInMonth > 20) {
      issues.push({
        id: `missing-workdays-${month}-${year}`,
        type: 'gap_detection',
        severity: 'medium',
        title: 'Few Work Days Recorded',
        description: `Only ${workDays} work days recorded for the month`,
        suggestion: 'Review your calendar and ensure all work days are recorded'
      });
    }
    
    return issues;
  }
  
  /**
   * Check for missing purposes
   */
  private static checkMissingPurposes(mileageEntries: MileageEntry[]): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    mileageEntries.forEach(entry => {
      if (!entry.purpose || entry.purpose.trim().length === 0) {
        issues.push({
          id: `missing-purpose-${entry.id}`,
          type: 'missing_purpose',
          severity: 'high',
          title: 'Missing Purpose',
          description: `Mileage entry on ${entry.date instanceof Date ? entry.date.toLocaleDateString() : new Date(entry.date).toLocaleDateString()} is missing a purpose`,
          suggestion: 'Add a purpose to explain why this mileage was incurred',
          affectedEntries: [entry.id],
          date: entry.date instanceof Date ? entry.date : new Date(entry.date)
        });
      }
    });
    
    return issues;
  }
  
  /**
   * Check for incomplete routes
   */
  private static checkIncompleteRoutes(mileageEntries: MileageEntry[]): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    mileageEntries.forEach(entry => {
      if (!entry.startLocation || !entry.endLocation) {
        issues.push({
          id: `incomplete-route-${entry.id}`,
          type: 'incomplete_route',
          severity: 'high',
          title: 'Incomplete Route Information',
          description: `Mileage entry is missing start or end location`,
          suggestion: 'Add both start and end locations for accurate tracking',
          affectedEntries: [entry.id],
          date: entry.date instanceof Date ? entry.date : new Date(entry.date)
        });
      }
    });
    
    return issues;
  }
  
  /**
   * Calculate overall completeness score (0-100)
   */
  private static calculateCompletenessScore(issues: CompletenessIssue[], mileageCount: number, receiptCount: number): number {
    if (mileageCount === 0 && receiptCount === 0) {
      return 0; // No data = 0 score
    }
    
    let score = 100;
    
    // Deduct points for each issue by severity
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    });
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Generate recommendations based on issues
   */
  private static generateRecommendations(issues: CompletenessIssue[]): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');
    const missingOdometer = issues.filter(i => i.type === 'missing_odometer');
    const missingPurpose = issues.filter(i => i.type === 'missing_purpose');
    const incompleteRoute = issues.filter(i => i.type === 'incomplete_route');
    
    if (criticalIssues.length > 0) {
      recommendations.push(`Fix ${criticalIssues.length} critical issue(s) before submission`);
    }
    
    if (highIssues.length > 0) {
      recommendations.push(`Address ${highIssues.length} high-priority issue(s)`);
    }
    
    if (missingOdometer.length > 0) {
      recommendations.push(`Add odometer readings for ${missingOdometer.length} entry/entries`);
    }
    
    if (missingPurpose.length > 0) {
      recommendations.push(`Add purpose descriptions for ${missingPurpose.length} mileage entry/entries`);
    }
    
    if (incompleteRoute.length > 0) {
      recommendations.push(`Complete route information for ${incompleteRoute.length} entry/entries`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Report looks complete and ready for submission!');
    }
    
    return recommendations;
  }
  
  /**
   * Group mileage entries by date
   */
  private static groupEntriesByDate(entries: MileageEntry[]): Record<string, MileageEntry[]> {
    const grouped: Record<string, MileageEntry[]> = {};
    
    entries.forEach(entry => {
      const dateStr = entry.date instanceof Date 
        ? entry.date.toISOString().split('T')[0]
        : new Date(entry.date).toISOString().split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(entry);
    });
    
    return grouped;
  }
  
  /**
   * Group time tracking by date
   */
  private static groupTimeTrackingByDate(entries: TimeTracking[]): Record<string, TimeTracking[]> {
    const grouped: Record<string, TimeTracking[]> = {};
    
    entries.forEach(entry => {
      const dateStr = entry.date instanceof Date 
        ? entry.date.toISOString().split('T')[0]
        : new Date(entry.date).toISOString().split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(entry);
    });
    
    return grouped;
  }
}

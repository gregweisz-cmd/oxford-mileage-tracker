import { DatabaseService } from './database';
import { MileageEntry, Receipt, TimeTracking, Employee } from '../types';

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
   * Analyze report completeness for a given month/year
   */
  static async analyzeReportCompleteness(
    employeeId: string,
    month: number,
    year: number
  ): Promise<CompletenessReport> {
    console.log('🔍 ReportCompleteness: Analyzing report for', { employeeId, month, year });
    
    try {
      // Get all data for the month
      const mileageEntries = await DatabaseService.getMileageEntries(employeeId, month, year);
      const receipts = await DatabaseService.getReceipts(employeeId, month, year);
      const timeTracking = await DatabaseService.getTimeTracking(employeeId, month, year);
      const employee = await DatabaseService.getEmployee(employeeId);
      
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      const issues: CompletenessIssue[] = [];
      
      // Run all completeness checks
      issues.push(...this.checkMissingOdometerReadings(mileageEntries));
      issues.push(...this.checkIncompleteCostCenterHours(timeTracking, employee));
      issues.push(...this.checkMissingReceipts(mileageEntries, receipts));
      issues.push(...this.checkUnusualGaps(mileageEntries, timeTracking));
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
      const sortedEntries = entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      // Check for trip chains without proper odometer readings
      for (let i = 0; i < sortedEntries.length - 1; i++) {
        const currentEntry = sortedEntries[i];
        const nextEntry = sortedEntries[i + 1];
        
        // Check if entries form a chain (end location of current = start location of next)
        if (currentEntry.endLocation === nextEntry.startLocation) {
          const currentEndOdometer = currentEntry.odometerReading ? 
            currentEntry.odometerReading + currentEntry.miles : null;
          const nextStartOdometer = nextEntry.odometerReading;
          
          // Missing odometer readings in chain
          if (!currentEntry.odometerReading || !nextEntry.odometerReading) {
            issues.push({
              id: `missing-odometer-${dateStr}-${i}`,
              type: 'missing_odometer',
              severity: 'high',
              title: 'Missing Odometer Readings in Trip Chain',
              description: `Trip chain on ${new Date(dateStr).toLocaleDateString()} missing odometer readings`,
              suggestion: 'Add odometer readings to ensure accurate mileage calculation',
              affectedEntries: [currentEntry.id, nextEntry.id],
              date: new Date(dateStr)
            });
          }
          // Inconsistent odometer readings
          else if (currentEndOdometer && nextStartOdometer && 
                   Math.abs(currentEndOdometer - nextStartOdometer) > 5) {
            issues.push({
              id: `inconsistent-odometer-${dateStr}-${i}`,
              type: 'missing_odometer',
              severity: 'medium',
              title: 'Inconsistent Odometer Readings',
              description: `Odometer readings don't align between chained trips (${Math.abs(currentEndOdometer - nextStartOdometer).toFixed(1)} mile difference)`,
              suggestion: 'Verify odometer readings are accurate and sequential',
              affectedEntries: [currentEntry.id, nextEntry.id],
              date: new Date(dateStr)
            });
          }
        }
      }
    });
    
    return issues;
  }
  
  /**
   * Check for incomplete cost center hours
   */
  private static checkIncompleteCostCenterHours(
    timeTracking: TimeTracking[], 
    employee: Employee
  ): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    if (!employee.costCenters || employee.costCenters.length === 0) {
      return issues;
    }
    
    // Group time tracking by date
    const timeByDate = this.groupTimeTrackingByDate(timeTracking);
    
    Object.entries(timeByDate).forEach(([dateStr, entries]) => {
      const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
      const costCenterHours = entries
        .filter(entry => employee.costCenters?.includes(entry.category))
        .reduce((sum, entry) => sum + entry.hours, 0);
      
      // Check if cost center hours are missing
      if (costCenterHours === 0 && totalHours > 0) {
        issues.push({
          id: `missing-cost-center-${dateStr}`,
          type: 'incomplete_hours',
          severity: 'high',
          title: 'Missing Cost Center Hours',
          description: `${totalHours} hours logged but no cost center hours specified`,
          suggestion: 'Add cost center hours for proper expense allocation',
          date: new Date(dateStr),
          category: 'Cost Center Hours'
        });
      }
      
      // Check if cost center hours seem incomplete
      if (costCenterHours > 0 && costCenterHours < totalHours * 0.5) {
        issues.push({
          id: `incomplete-cost-center-${dateStr}`,
          type: 'incomplete_hours',
          severity: 'medium',
          title: 'Incomplete Cost Center Hours',
          description: `Only ${costCenterHours} of ${totalHours} hours allocated to cost centers`,
          suggestion: 'Consider allocating more hours to cost centers',
          date: new Date(dateStr),
          category: 'Cost Center Hours'
        });
      }
    });
    
    return issues;
  }
  
  /**
   * Check for missing receipts for expenses
   */
  private static checkMissingReceipts(
    mileageEntries: MileageEntry[], 
    receipts: Receipt[]
  ): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    // Group entries by date
    const entriesByDate = this.groupEntriesByDate(mileageEntries);
    const receiptsByDate = this.groupReceiptsByDate(receipts);
    
    Object.entries(entriesByDate).forEach(([dateStr, entries]) => {
      const dayReceipts = receiptsByDate[dateStr] || [];
      const totalMileage = entries.reduce((sum, entry) => sum + entry.miles, 0);
      const totalReceiptAmount = dayReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
      
      // High mileage day with no receipts
      if (totalMileage > 100 && dayReceipts.length === 0) {
        issues.push({
          id: `missing-receipts-${dateStr}`,
          type: 'missing_receipt',
          severity: 'medium',
          title: 'Missing Receipts for High Mileage Day',
          description: `${totalMileage.toFixed(1)} miles driven but no receipts submitted`,
          suggestion: 'Consider adding receipts for meals, parking, or other expenses',
          date: new Date(dateStr),
          category: 'Receipts'
        });
      }
      
      // Check for unusual expense patterns
      if (totalMileage > 200 && totalReceiptAmount < 20) {
        issues.push({
          id: `low-receipts-${dateStr}`,
          type: 'missing_receipt',
          severity: 'low',
          title: 'Low Receipt Amount for High Mileage',
          description: `${totalMileage.toFixed(1)} miles with only $${totalReceiptAmount.toFixed(2)} in receipts`,
          suggestion: 'Verify all expenses are captured',
          date: new Date(dateStr),
          category: 'Receipts'
        });
      }
    });
    
    return issues;
  }
  
  /**
   * Check for unusual gaps in daily entries
   */
  private static checkUnusualGaps(
    mileageEntries: MileageEntry[], 
    timeTracking: TimeTracking[]
  ): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    // Get all dates with activity
    const mileageDates = new Set(mileageEntries.map(entry => entry.date.toDateString()));
    const timeDates = new Set(timeTracking.map(entry => entry.date.toDateString()));
    const allDates = new Set([...mileageDates, ...timeDates]);
    
    // Find gaps in activity
    const sortedDates = Array.from(allDates).sort();
    
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const currentDate = new Date(sortedDates[i]);
      const nextDate = new Date(sortedDates[i + 1]);
      const daysDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Gap of more than 3 days during work week
      if (daysDiff > 3) {
        const isWorkWeek = currentDate.getDay() >= 1 && currentDate.getDay() <= 5;
        
        if (isWorkWeek) {
          issues.push({
            id: `gap-${sortedDates[i]}-${sortedDates[i + 1]}`,
            type: 'gap_detection',
            severity: 'low',
            title: 'Unusual Gap in Activity',
            description: `${daysDiff} days gap between ${currentDate.toLocaleDateString()} and ${nextDate.toLocaleDateString()}`,
            suggestion: 'Verify no entries were missed during this period',
            date: currentDate,
            category: 'Activity Gaps'
          });
        }
      }
    }
    
    return issues;
  }
  
  /**
   * Check for missing trip purposes
   */
  private static checkMissingPurposes(mileageEntries: MileageEntry[]): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    const entriesWithoutPurpose = mileageEntries.filter(entry => 
      !entry.purpose || entry.purpose.trim() === ''
    );
    
    if (entriesWithoutPurpose.length > 0) {
      issues.push({
        id: 'missing-purposes',
        type: 'missing_purpose',
        severity: 'high',
        title: 'Missing Trip Purposes',
        description: `${entriesWithoutPurpose.length} trips without purpose specified`,
        suggestion: 'Add purpose for each trip to ensure proper expense categorization',
        affectedEntries: entriesWithoutPurpose.map(entry => entry.id),
        category: 'Trip Purposes'
      });
    }
    
    return issues;
  }
  
  /**
   * Check for incomplete route information
   */
  private static checkIncompleteRoutes(mileageEntries: MileageEntry[]): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    const incompleteRoutes = mileageEntries.filter(entry => 
      !entry.startLocation || !entry.endLocation ||
      entry.startLocation.trim() === '' || entry.endLocation.trim() === ''
    );
    
    if (incompleteRoutes.length > 0) {
      issues.push({
        id: 'incomplete-routes',
        type: 'incomplete_route',
        severity: 'critical',
        title: 'Incomplete Route Information',
        description: `${incompleteRoutes.length} trips with missing start or end locations`,
        suggestion: 'Complete route information for accurate mileage tracking',
        affectedEntries: incompleteRoutes.map(entry => entry.id),
        category: 'Route Information'
      });
    }
    
    return issues;
  }
  
  /**
   * Calculate overall completeness score
   */
  private static calculateCompletenessScore(
    issues: CompletenessIssue[], 
    mileageCount: number, 
    receiptCount: number
  ): number {
    if (mileageCount === 0 && receiptCount === 0) {
      return 0; // No data
    }
    
    let score = 100;
    
    // Deduct points based on issue severity
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    });
    
    return Math.max(0, score);
  }
  
  /**
   * Generate recommendations based on issues
   */
  private static generateRecommendations(issues: CompletenessIssue[]): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');
    
    if (criticalIssues.length > 0) {
      recommendations.push('🚨 Address critical issues before submitting report');
    }
    
    if (highIssues.length > 0) {
      recommendations.push('⚠️ Review high-priority issues for accuracy');
    }
    
    const missingOdometer = issues.filter(issue => issue.type === 'missing_odometer');
    if (missingOdometer.length > 0) {
      recommendations.push('📊 Add odometer readings for accurate mileage calculation');
    }
    
    const missingReceipts = issues.filter(issue => issue.type === 'missing_receipt');
    if (missingReceipts.length > 0) {
      recommendations.push('🧾 Consider adding receipts for expenses');
    }
    
    const incompleteHours = issues.filter(issue => issue.type === 'incomplete_hours');
    if (incompleteHours.length > 0) {
      recommendations.push('⏰ Complete cost center hour allocations');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ Report looks complete and ready for submission!');
    }
    
    return recommendations;
  }
  
  // Helper methods
  
  private static groupEntriesByDate(entries: MileageEntry[]): Record<string, MileageEntry[]> {
    const grouped: Record<string, MileageEntry[]> = {};
    
    entries.forEach(entry => {
      const dateStr = entry.date.toDateString();
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(entry);
    });
    
    return grouped;
  }
  
  private static groupReceiptsByDate(receipts: Receipt[]): Record<string, Receipt[]> {
    const grouped: Record<string, Receipt[]> = {};
    
    receipts.forEach(receipt => {
      const dateStr = receipt.date.toDateString();
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(receipt);
    });
    
    return grouped;
  }
  
  private static groupTimeTrackingByDate(entries: TimeTracking[]): Record<string, TimeTracking[]> {
    const grouped: Record<string, TimeTracking[]> = {};
    
    entries.forEach(entry => {
      const dateStr = entry.date.toDateString();
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(entry);
    });
    
    return grouped;
  }
}

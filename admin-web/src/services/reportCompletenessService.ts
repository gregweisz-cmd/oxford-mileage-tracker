import { MileageEntry, Receipt, TimeTracking, Employee } from '../types';
import { debugLog, debugWarn } from '../config/debug';

export interface CompletenessIssue {
  id: string;
  type: 'missing_odometer' | 'incomplete_hours' | 'missing_receipt' | 'gap_detection' | 'missing_purpose' | 'incomplete_route' | 'missing_receipt_image' | 'missing_employee_signature' | 'missing_supervisor_signature' | 'missing_employee_acknowledgment' | 'missing_supervisor_acknowledgment';
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
    debugLog('🔍 ReportCompleteness: Analyzing report for', { employeeId, month, year });
    
    try {
      // Get all data for the month from the backend API
      debugLog('🔍 ReportCompleteness: Fetching data from APIs...');
      
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
      const [mileageResponse, receiptsResponse, timeTrackingResponse, employeeResponse, expenseReportResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/mileage-entries?employeeId=${employeeId}&month=${month}&year=${year}`),
        fetch(`${API_BASE_URL}/api/receipts?employeeId=${employeeId}&month=${month}&year=${year}`),
        fetch(`${API_BASE_URL}/api/time-tracking?employeeId=${employeeId}&month=${month}&year=${year}`),
        fetch(`${API_BASE_URL}/api/employees/${employeeId}`),
        fetch(`${API_BASE_URL}/api/expense-reports/${employeeId}/${month}/${year}`).catch(() => null) // Get expense report if it exists
      ]);

      debugLog('🔍 ReportCompleteness: API responses received:', {
        mileageStatus: mileageResponse.status,
        receiptsStatus: receiptsResponse.status,
        timeTrackingStatus: timeTrackingResponse.status,
        employeeStatus: employeeResponse.status
      });

      if (!mileageResponse.ok) {
        throw new Error(`Mileage API failed: ${mileageResponse.status} ${mileageResponse.statusText}`);
      }
      if (!receiptsResponse.ok) {
        throw new Error(`Receipts API failed: ${receiptsResponse.status} ${receiptsResponse.statusText}`);
      }
      if (!timeTrackingResponse.ok) {
        throw new Error(`Time tracking API failed: ${timeTrackingResponse.status} ${timeTrackingResponse.statusText}`);
      }
      if (!employeeResponse.ok) {
        throw new Error(`Employee API failed: ${employeeResponse.status} ${employeeResponse.statusText}`);
      }

      const mileageEntries: MileageEntry[] = await mileageResponse.json();
      const receipts: Receipt[] = await receiptsResponse.json();
      const timeTracking: TimeTracking[] = await timeTrackingResponse.json();
      const employee: Employee = await employeeResponse.json();
      
      // Get expense report data if it exists (for signatures and checkboxes)
      let expenseReport: any = null;
      if (expenseReportResponse && expenseReportResponse.ok) {
        try {
          expenseReport = await expenseReportResponse.json();
        } catch (e) {
          debugWarn('Could not parse expense report:', e);
        }
      }
      const reportData = expenseReport?.reportData || {};
      
      debugLog('🔍 ReportCompleteness: Data loaded:', {
        mileageCount: mileageEntries.length,
        receiptsCount: receipts.length,
        timeTrackingCount: timeTracking.length,
        employeeName: employee?.name,
        hasExpenseReport: !!expenseReport
      });
      
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      const issues: CompletenessIssue[] = [];
      
      // Run all completeness checks
      issues.push(...this.checkMissingOdometerReadings(mileageEntries));
      issues.push(...this.checkIncompleteCostCenterHours(timeTracking, employee));
      issues.push(...this.checkMissingReceipts(mileageEntries, receipts));
      issues.push(...this.checkReceiptImages(receipts, month, year)); // Check that all receipts have images (mandatory), exclude Per Diem
      issues.push(...this.checkEmployeeSignatureAndAcknowledgment(reportData)); // Check employee signature and checkbox (mandatory)
      issues.push(...this.checkSupervisorSignatureAndAcknowledgment(reportData, employee)); // Check supervisor signature and checkbox (mandatory, only if employee is supervisor)
      issues.push(...this.checkUnusualGaps(mileageEntries, timeTracking));
      issues.push(...this.checkMissingWorkDays(mileageEntries, timeTracking, month, year));
      issues.push(...this.checkBurnoutPrevention(timeTracking, month, year));
      issues.push(...this.checkMissingPurposes(mileageEntries));
      issues.push(...this.checkIncompleteRoutes(mileageEntries));
      
      // Calculate overall score
      const overallScore = this.calculateCompletenessScore(issues, mileageEntries.length, receipts.length);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(issues);
      
      // Determine if ready for submission
      const criticalIssues = issues.filter(issue => issue.severity === 'critical');
      const highIssues = issues.filter(issue => issue.severity === 'high');
      // Block submission if there are mandatory requirements missing
      const missingReceiptImageIssues = issues.filter(issue => issue.type === 'missing_receipt_image');
      const missingEmployeeSignatureIssues = issues.filter(issue => issue.type === 'missing_employee_signature' || issue.type === 'missing_employee_acknowledgment');
      const missingSupervisorSignatureIssues = issues.filter(issue => issue.type === 'missing_supervisor_signature' || issue.type === 'missing_supervisor_acknowledgment');
      // Block submission if any mandatory requirements are missing
      const isReadyForSubmission = criticalIssues.length === 0 && 
                                    highIssues.length <= 1 && 
                                    missingReceiptImageIssues.length === 0 && 
                                    missingEmployeeSignatureIssues.length === 0 && 
                                    missingSupervisorSignatureIssues.length === 0;
      
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
   * Only checks "Working Hours" or "Regular Hours" - other categories (Holiday, PTO, STD/LTD, PFL/PFML, G&A) don't need cost centers
   */
  private static checkIncompleteCostCenterHours(
    timeTracking: TimeTracking[], 
    employee: Employee
  ): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    if (!employee.costCenters || employee.costCenters.length === 0) {
      return issues; // No cost centers assigned, skip check
    }
    
    // Categories that don't require cost center assignment
    const nonCostCenterCategories = ['Holiday', 'PTO', 'STD/LTD', 'PFL/PFML', 'G&A', 'Holiday Hours', 'PTO Hours', 'STD/LTD Hours', 'PFL/PFML Hours', 'G&A Hours'];
    
    // Group time tracking by date
    const timeByDate = this.groupTimeTrackingByDate(timeTracking);
    
    Object.entries(timeByDate).forEach(([dateStr, entries]) => {
      // Filter to only "Working Hours" or "Regular Hours" entries (these need cost centers)
      const workingHoursEntries = entries.filter(entry => {
        const category = entry.category || '';
        return category === 'Working Hours' || category === 'Regular Hours';
      });
      
      if (workingHoursEntries.length === 0) {
        return; // No working hours entries, skip check
      }
      
      const totalWorkingHours = workingHoursEntries.reduce((sum, entry) => sum + entry.hours, 0);
      
      // Check if entries have costCenter assigned (not category in costCenters list)
      const entriesWithCostCenter = workingHoursEntries.filter(entry => 
        entry.costCenter && entry.costCenter.trim() !== '' && 
        employee.costCenters?.includes(entry.costCenter)
      );
      
      const costCenterHours = entriesWithCostCenter.reduce((sum, entry) => sum + entry.hours, 0);
      
      // Check if cost center hours are missing for working hours
      if (costCenterHours === 0 && totalWorkingHours > 0) {
        issues.push({
          id: `missing-cost-center-${dateStr}`,
          type: 'incomplete_hours',
          severity: 'high',
          title: 'Missing Cost Center Hours',
          description: `${totalWorkingHours} working hours logged but no cost center assigned`,
          suggestion: 'Assign a cost center to working hours entries for proper expense allocation',
          date: new Date(dateStr),
          category: 'Cost Center Hours'
        });
      }
      
      // Check if cost center hours seem incomplete (less than 50% of working hours)
      if (costCenterHours > 0 && costCenterHours < totalWorkingHours * 0.5) {
        issues.push({
          id: `incomplete-cost-center-${dateStr}`,
          type: 'incomplete_hours',
          severity: 'medium',
          title: 'Incomplete Cost Center Hours',
          description: `Only ${costCenterHours} of ${totalWorkingHours} working hours allocated to cost centers`,
          suggestion: 'Consider allocating more working hours to cost centers',
          date: new Date(dateStr),
          category: 'Cost Center Hours'
        });
      }
    });
    
    return issues;
  }
  
  /**
   * Check for missing receipts for expenses
   * Excludes Per Diem receipts as they are not mandatory
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
      // Filter out Per Diem receipts (they are not mandatory)
      const dayReceipts = (receiptsByDate[dateStr] || []).filter(receipt => 
        !receipt.category || receipt.category.toLowerCase() !== 'per diem'
      );
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
   * Check that all receipts have images (mandatory requirement)
   * Excludes Per Diem receipts as they are not mandatory
   */
  private static checkReceiptImages(receipts: Receipt[], month: number, year: number): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    if (receipts.length === 0) {
      return issues; // No receipts to check
    }
    
    // Filter to only receipts for the current month/year and exclude Per Diem
    const relevantReceipts = receipts.filter(receipt => {
      const receiptDate = receipt.date instanceof Date ? receipt.date : new Date(receipt.date);
      const receiptMonth = receiptDate.getMonth() + 1;
      const receiptYear = receiptDate.getFullYear();
      
      // Only check receipts for the current month/year
      if (receiptMonth !== month || receiptYear !== year) {
        return false;
      }
      
      // Exclude Per Diem receipts (they are not mandatory)
      if (receipt.category && receipt.category.toLowerCase() === 'per diem') {
        return false;
      }
      
      return true;
    });
    
    if (relevantReceipts.length === 0) {
      return issues; // No relevant receipts to check
    }
    
    // Find receipts without images
    const receiptsWithoutImages = relevantReceipts.filter(receipt => 
      !receipt.imageUri || receipt.imageUri.trim() === ''
    );
    
    if (receiptsWithoutImages.length > 0) {
      // Group by date for better reporting
      const receiptsByDate = this.groupReceiptsByDate(receiptsWithoutImages);
      
      Object.entries(receiptsByDate).forEach(([dateStr, receipts]) => {
        const date = new Date(dateStr);
        const receiptCount = receipts.length;
        const receiptList = receipts.map(r => {
          const vendor = r.vendor || 'Unknown Vendor';
          const amount = r.amount ? `$${r.amount.toFixed(2)}` : 'Amount unknown';
          return `${vendor} (${amount})`;
        }).join(', ');
        
        issues.push({
          id: `missing-receipt-images-${dateStr}`,
          type: 'missing_receipt_image',
          severity: 'critical', // Critical - images are mandatory
          title: 'Missing Receipt Images (Mandatory)',
          description: `${receiptCount} receipt${receiptCount > 1 ? 's' : ''} on ${date.toLocaleDateString()} ${receiptCount > 1 ? 'do not have' : 'does not have'} images: ${receiptList}`,
          suggestion: 'Upload images for all receipts. Receipt images are mandatory for submission.',
          affectedEntries: receipts.map(r => r.id),
          date: date,
          category: 'Receipt Images'
        });
      });
      
      // Also add a summary issue if there are multiple dates affected
      if (Object.keys(receiptsByDate).length > 1) {
        issues.unshift({
          id: 'missing-receipt-images-summary',
          type: 'missing_receipt_image',
          severity: 'critical',
          title: 'Missing Receipt Images (Mandatory)',
          description: `${receiptsWithoutImages.length} receipt${receiptsWithoutImages.length > 1 ? 's' : ''} across ${Object.keys(receiptsByDate).length} day${Object.keys(receiptsByDate).length > 1 ? 's' : ''} do not have images. Receipt images are mandatory.`,
          suggestion: 'Upload images for all receipts before submitting your report. All receipts must have images.',
          affectedEntries: receiptsWithoutImages.map(r => r.id),
          category: 'Receipt Images'
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Check that employee has signed and acknowledged certification (mandatory requirement)
   */
  private static checkEmployeeSignatureAndAcknowledgment(reportData: any): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    const employeeSignature = reportData.employeeSignature;
    const employeeCertificationAcknowledged = reportData.employeeCertificationAcknowledged;
    
    // Employee signature is mandatory
    if (!employeeSignature || employeeSignature.trim() === '') {
      issues.push({
        id: 'missing-employee-signature',
        type: 'missing_employee_signature',
        severity: 'critical', // Critical - mandatory requirement
        title: 'Missing Employee Signature (Mandatory)',
        description: 'Employee signature is required before submitting the report. Please upload your signature using the "Signature Capture" button on the Approval Cover Sheet.',
        suggestion: 'Upload your employee signature using the "Signature Capture" button. This is mandatory for submission.',
        category: 'Signatures'
      });
    }
    
    // Employee acknowledgment checkbox is mandatory
    if (!employeeCertificationAcknowledged) {
      issues.push({
        id: 'missing-employee-acknowledgment',
        type: 'missing_employee_acknowledgment',
        severity: 'critical', // Critical - mandatory requirement
        title: 'Missing Employee Certification Acknowledgment (Mandatory)',
        description: 'You must check the employee acknowledgment box on the Approval Cover Sheet to certify the report.',
        suggestion: 'Check the employee acknowledgment checkbox on the Approval Cover Sheet. This is mandatory for submission.',
        category: 'Certification'
      });
    }
    
    return issues;
  }
  
  /**
   * Check that supervisor has signed and acknowledged certification (mandatory requirement only if employee is a supervisor)
   */
  private static checkSupervisorSignatureAndAcknowledgment(reportData: any, employee: Employee): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    // Only check supervisor requirements if the employee is actually a supervisor
    // Check both role and position to determine if they are a supervisor
    const isSupervisor = employee.role?.toLowerCase() === 'supervisor' || 
                         employee.position?.toLowerCase().includes('supervisor') ||
                         employee.position?.toLowerCase().includes('director') ||
                         employee.position?.toLowerCase().includes('manager');
    
    if (!isSupervisor) {
      // Employee is not a supervisor, so supervisor certification is not required
      return issues;
    }
    
    const supervisorSignature = reportData.supervisorSignature;
    const supervisorCertificationAcknowledged = reportData.supervisorCertificationAcknowledged;
    
    // If supervisor acknowledgment is expected but missing
    if (supervisorCertificationAcknowledged !== undefined && !supervisorCertificationAcknowledged) {
      issues.push({
        id: 'missing-supervisor-acknowledgment',
        type: 'missing_supervisor_acknowledgment',
        severity: 'critical', // Critical - mandatory requirement
        title: 'Missing Supervisor Certification Acknowledgment (Mandatory)',
        description: 'Supervisor must check the acknowledgment box on the Approval Cover Sheet to certify the report.',
        suggestion: 'Supervisor must check the supervisor acknowledgment checkbox on the Approval Cover Sheet. This is mandatory for submission.',
        category: 'Certification'
      });
    }
    
    // If supervisor signature is expected but missing
    if ((supervisorCertificationAcknowledged === true || supervisorSignature) && (!supervisorSignature || supervisorSignature.trim() === '')) {
      issues.push({
        id: 'missing-supervisor-signature',
        type: 'missing_supervisor_signature',
        severity: 'critical', // Critical - mandatory requirement
        title: 'Missing Supervisor Signature (Mandatory)',
        description: 'Supervisor signature is required. Please upload supervisor signature using the supervisor signature capture on the Approval Cover Sheet.',
        suggestion: 'Supervisor must upload their signature. This is mandatory for submission.',
        category: 'Signatures'
      });
    }
    
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
    const mileageDates = new Set(mileageEntries.map(entry => {
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
      return date.toDateString();
    }));
    const timeDates = new Set(timeTracking.map(entry => {
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
      return date.toDateString();
    }));
    const allDates = new Set(Array.from(mileageDates).concat(Array.from(timeDates)));
    
    // Check for insufficient activity in the month
    const totalActivityDays = allDates.size;
    if (totalActivityDays < 5) { // Less than 5 days of activity
      issues.push({
        id: 'insufficient-activity',
        type: 'gap_detection',
        severity: 'high',
        title: 'Insufficient Activity',
        description: `Only ${totalActivityDays} day${totalActivityDays === 1 ? '' : 's'} of activity recorded this month`,
        suggestion: 'Verify all work days are properly recorded with mileage, receipts, or time tracking',
        category: 'Activity Coverage'
      });
    }
    
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
   * Check for missing work days in the month
   */
  private static checkMissingWorkDays(
    mileageEntries: MileageEntry[], 
    timeTracking: TimeTracking[],
    month: number,
    year: number
  ): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    // Get all dates with activity
    const mileageDates = new Set(mileageEntries.map(entry => {
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
      return date.toDateString();
    }));
    const timeDates = new Set(timeTracking.map(entry => {
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
      return date.toDateString();
    }));
    const allActivityDates = new Set(Array.from(mileageDates).concat(Array.from(timeDates)));
    
    // Calculate work days in the month (Monday-Friday)
    const daysInMonth = new Date(year, month, 0).getDate();
    const workDaysInMonth: string[] = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      // Monday = 1, Friday = 5
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workDaysInMonth.push(date.toDateString());
      }
    }
    
    // Find missing work days
    const missingWorkDays = workDaysInMonth.filter(workDay => !allActivityDates.has(workDay));
    
    // Only flag if there are significant gaps (more than 2 consecutive work days missing)
    if (missingWorkDays.length > 0) {
      // Check for consecutive missing days
      const consecutiveMissingDays = this.findConsecutiveMissingDays(missingWorkDays);
      const significantGaps = consecutiveMissingDays.filter(gap => gap.length > 2);
      
      if (significantGaps.length > 0) {
        const totalMissingDays = missingWorkDays.length;
        const totalWorkDays = workDaysInMonth.length;
        const coveragePercentage = ((totalWorkDays - totalMissingDays) / totalWorkDays) * 100;
        
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (coveragePercentage < 30) severity = 'critical';
        else if (coveragePercentage < 50) severity = 'high';
        else if (coveragePercentage < 70) severity = 'medium';
        
        issues.push({
          id: 'missing-work-days',
          type: 'gap_detection',
          severity: severity,
          title: 'Significant Work Day Gaps',
          description: `${totalMissingDays} of ${totalWorkDays} work days have no recorded activity. ${significantGaps.length} gap${significantGaps.length === 1 ? '' : 's'} of 3+ consecutive days detected.`,
          suggestion: 'Verify if these are planned days off or if entries are missing. Consider adding "Time Off" entries for planned days off.',
          category: 'Work Day Coverage'
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Check for burnout prevention - excessive work hours
   */
  private static checkBurnoutPrevention(
    timeTracking: TimeTracking[],
    month: number,
    year: number
  ): CompletenessIssue[] {
    const issues: CompletenessIssue[] = [];
    
    // Group time tracking by week
    const weeklyHours: { [weekKey: string]: number } = {};
    
    timeTracking.forEach(entry => {
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const weekKey = this.getWeekKey(date);
      weeklyHours[weekKey] = (weeklyHours[weekKey] || 0) + entry.hours;
    });
    
    // Check each week for excessive hours (50+ hours threshold)
    Object.entries(weeklyHours).forEach(([weekKey, totalHours]) => {
      if (totalHours >= 50) {
        const weekNumber = weekKey.split('-')[1];
        const weekStart = this.getWeekStartDate(weekKey);
        
        issues.push({
          id: `burnout-week-${weekKey}`,
          type: 'gap_detection',
          severity: 'high',
          title: '⚠️ Weekly Hours Alert - 50+ Hours',
          description: `Week ${weekNumber} (${weekStart.toLocaleDateString()}): ${totalHours.toFixed(1)} hours logged - exceeds 50 hour threshold. Employee may be overworking.`,
          suggestion: 'Please check in with this employee to ensure they are not overworking',
          date: weekStart,
          category: 'Work-Life Balance'
        });
      }
    });
    
    return issues;
  }
  
  /**
   * Helper method to find consecutive missing days
   */
  private static findConsecutiveMissingDays(missingDays: string[]): string[][] {
    if (missingDays.length === 0) return [];
    
    const sortedDays = missingDays.sort();
    const consecutiveGroups: string[][] = [];
    let currentGroup: string[] = [sortedDays[0]];
    
    for (let i = 1; i < sortedDays.length; i++) {
      const currentDate = new Date(sortedDays[i]);
      const previousDate = new Date(sortedDays[i - 1]);
      const daysDiff = Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day
        currentGroup.push(sortedDays[i]);
      } else {
        // Gap found, start new group
        consecutiveGroups.push(currentGroup);
        currentGroup = [sortedDays[i]];
      }
    }
    
    // Add the last group
    consecutiveGroups.push(currentGroup);
    
    return consecutiveGroups;
  }
  
  /**
   * Helper method to get week key (year-week format)
   */
  private static getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const weekNumber = this.getWeekNumber(date);
    return `${year}-${weekNumber}`;
  }
  
  /**
   * Helper method to get week number (Sunday-based weeks)
   */
  private static getWeekNumber(date: Date): number {
    // Get the start of the year
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    
    // Calculate the start of the first week (first Sunday of the year)
    const firstSunday = new Date(firstDayOfYear);
    const firstDayOfYearDay = firstDayOfYear.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // If the first day of the year is not Sunday, find the first Sunday
    if (firstDayOfYearDay !== 0) {
      firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfYearDay));
    }
    
    // Calculate the number of weeks between the first Sunday and the given date
    const timeDiff = date.getTime() - firstSunday.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysDiff / 7) + 1;
    
    return weekNumber;
  }
  
  /**
   * Helper method to get week start date from week key (Sunday-based weeks)
   */
  private static getWeekStartDate(weekKey: string): Date {
    const [year, weekNumber] = weekKey.split('-').map(Number);
    
    // Get the start of the year
    const firstDayOfYear = new Date(year, 0, 1);
    
    // Calculate the start of the first week (first Sunday of the year)
    const firstSunday = new Date(firstDayOfYear);
    const firstDayOfYearDay = firstDayOfYear.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // If the first day of the year is not Sunday, find the first Sunday
    if (firstDayOfYearDay !== 0) {
      firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfYearDay));
    }
    
    // Calculate the start date of the specified week
    const weekStart = new Date(firstSunday);
    weekStart.setDate(firstSunday.getDate() + (weekNumber - 1) * 7);
    
    return weekStart;
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
    
    const missingReceiptImages = issues.filter(issue => issue.type === 'missing_receipt_image');
    if (missingReceiptImages.length > 0) {
      recommendations.push('📷 UPLOAD IMAGES FOR ALL RECEIPTS - This is mandatory for submission');
    }
    
    const missingEmployeeSignature = issues.filter(issue => issue.type === 'missing_employee_signature' || issue.type === 'missing_employee_acknowledgment');
    if (missingEmployeeSignature.length > 0) {
      recommendations.push('✍️ COMPLETE EMPLOYEE SIGNATURE AND ACKNOWLEDGMENT - Check the employee acknowledgment box and upload your signature on the Approval Cover Sheet. This is mandatory for submission.');
    }
    
    const missingSupervisorSignature = issues.filter(issue => issue.type === 'missing_supervisor_signature' || issue.type === 'missing_supervisor_acknowledgment');
    if (missingSupervisorSignature.length > 0) {
      recommendations.push('✍️ COMPLETE SUPERVISOR SIGNATURE AND ACKNOWLEDGMENT - Check the supervisor acknowledgment box and upload supervisor signature on the Approval Cover Sheet. This is mandatory for submission.');
    }
    
    const insufficientActivity = issues.filter(issue => issue.id === 'insufficient-activity');
    if (insufficientActivity.length > 0) {
      recommendations.push('📅 Add more activity entries to cover work days');
    }
    
    const missingWorkDays = issues.filter(issue => issue.id === 'missing-work-days');
    if (missingWorkDays.length > 0) {
      recommendations.push('📊 Complete missing work day entries');
    }
    
    const burnoutIssues = issues.filter(issue => issue.id.startsWith('burnout-week-'));
    if (burnoutIssues.length > 0) {
      recommendations.push('📊 Weekly hours exceed 40 hour threshold');
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
      // Handle both Date objects and date strings
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const dateStr = date.toDateString();
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
      // Handle both Date objects and date strings
      const date = receipt.date instanceof Date ? receipt.date : new Date(receipt.date);
      const dateStr = date.toDateString();
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
      // Handle both Date objects and date strings
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const dateStr = date.toDateString();
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(entry);
    });
    
    return grouped;
  }
}

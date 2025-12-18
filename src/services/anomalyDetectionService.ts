import { DatabaseService } from './database';
import { MileageEntry, Receipt, TimeTracking } from '../types';

export interface AnomalyAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'mileage' | 'expense' | 'policy' | 'budget' | 'pattern';
  timestamp: Date;
  dismissed?: boolean;
  actionRequired?: boolean;
  suggestedAction?: string;
}

export interface UserBehaviorBaseline {
  averageDailyMiles: number;
  maxDailyMiles: number;
  averageTripMiles: number;
  maxTripMiles: number;
  averageDailyExpenses: number;
  maxDailyExpenses: number;
  averageReceiptAmount: number;
  maxReceiptAmount: number;
  typicalTripPurposes: string[];
  commonRoutes: Array<{ route: string; frequency: number }>;
  monthlyMileagePattern: number[];
  monthlyExpensePattern: number[];
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  confidence: number; // 0-1
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction?: string;
}

export class AnomalyDetectionService {
  private static baselines: Map<string, UserBehaviorBaseline> = new Map();
  private static alerts: AnomalyAlert[] = [];

  /**
   * Initialize behavior baselines for an employee
   */
  static async initializeBaselines(employeeId: string): Promise<UserBehaviorBaseline> {
    console.log('🔍 AnomalyDetection: Initializing baselines for employee:', employeeId);
    
    try {
      // Get historical data (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const mileageEntries = await DatabaseService.getMileageEntries(employeeId);
      const receipts = await DatabaseService.getReceipts(employeeId);
      const timeTracking = await DatabaseService.getTimeTrackingEntries(employeeId);
      
      // Filter to last 6 months
      const recentMileage = mileageEntries.filter(entry => entry.date >= sixMonthsAgo);
      const recentReceipts = receipts.filter(receipt => receipt.date >= sixMonthsAgo);
      const recentTimeTracking = timeTracking.filter(entry => entry.date >= sixMonthsAgo);
      
      const baseline = this.calculateBaseline(recentMileage, recentReceipts, recentTimeTracking);
      this.baselines.set(employeeId, baseline);
      
      console.log('✅ AnomalyDetection: Baselines calculated:', {
        averageDailyMiles: baseline.averageDailyMiles,
        maxDailyMiles: baseline.maxDailyMiles,
        averageTripMiles: baseline.averageTripMiles,
        averageDailyExpenses: baseline.averageDailyExpenses
      });
      
      return baseline;
    } catch (error) {
      console.error('❌ AnomalyDetection: Error initializing baselines:', error);
      return this.getDefaultBaseline();
    }
  }

  /**
   * Detect anomalies in a new mileage entry
   */
  static async detectMileageAnomaly(
    employeeId: string, 
    newEntry: MileageEntry
  ): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];
    
    try {
      console.log('🔍 AnomalyDetection: Starting mileage anomaly detection for entry:', {
        entryId: newEntry.id,
        miles: newEntry.miles,
        startLocation: newEntry.startLocation,
        endLocation: newEntry.endLocation
      });
      
      const baseline = await this.getBaseline(employeeId);
      
      console.log('🔍 AnomalyDetection: Baseline data:', {
        averageDailyMiles: baseline.averageDailyMiles,
        maxDailyMiles: baseline.maxDailyMiles,
        averageTripMiles: baseline.averageTripMiles,
        maxTripMiles: baseline.maxTripMiles
      });
      
      // Check daily mileage anomaly
      const dailyMileageResult = this.checkDailyMileageAnomaly(employeeId, newEntry, baseline);
      if (dailyMileageResult.isAnomaly) {
        results.push(dailyMileageResult);
      }
      
      // Check single trip anomaly
      const tripMileageResult = this.checkTripMileageAnomaly(newEntry, baseline);
      if (tripMileageResult.isAnomaly) {
        results.push(tripMileageResult);
      }
      
      // Check duplicate trip anomaly
      const duplicateResult = await this.checkDuplicateTripAnomaly(employeeId, newEntry);
      if (duplicateResult.isAnomaly) {
        results.push(duplicateResult);
      }
      
      // Check unusual route anomaly
      const routeResult = this.checkUnusualRouteAnomaly(newEntry, baseline);
      if (routeResult.isAnomaly) {
        results.push(routeResult);
      }
      
      console.log('🔍 AnomalyDetection: Mileage anomaly check completed:', {
        entryId: newEntry.id,
        anomaliesFound: results.length,
        results: results.map(r => ({ reason: r.reason, severity: r.severity }))
      });
      
    } catch (error) {
      console.error('❌ AnomalyDetection: Error detecting mileage anomaly:', error);
    }
    
    return results;
  }

  /**
   * Detect anomalies in a new receipt
   */
  static async detectReceiptAnomaly(
    employeeId: string, 
    newReceipt: Receipt
  ): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];
    
    try {
      const baseline = await this.getBaseline(employeeId);
      
      // Check amount anomaly
      const amountResult = this.checkReceiptAmountAnomaly(newReceipt, baseline);
      if (amountResult.isAnomaly) {
        results.push(amountResult);
      }
      
      // Check daily expense anomaly
      const dailyExpenseResult = await this.checkDailyExpenseAnomaly(employeeId, newReceipt, baseline);
      if (dailyExpenseResult.isAnomaly) {
        results.push(dailyExpenseResult);
      }
      
      // Check vendor anomaly
      const vendorResult = this.checkVendorAnomaly(newReceipt, baseline);
      if (vendorResult.isAnomaly) {
        results.push(vendorResult);
      }
      
      console.log('🔍 AnomalyDetection: Receipt anomaly check completed:', {
        receiptId: newReceipt.id,
        anomaliesFound: results.length,
        results: results.map(r => ({ reason: r.reason, severity: r.severity }))
      });
      
    } catch (error) {
      console.error('❌ AnomalyDetection: Error detecting receipt anomaly:', error);
    }
    
    return results;
  }

  /**
   * Detect anomalies in time tracking data (including burnout prevention)
   */
  static async detectTimeTrackingAnomaly(
    employeeId: string, 
    newTimeTracking: TimeTracking
  ): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];
    
    try {
      console.log('🔍 AnomalyDetection: Starting time tracking anomaly detection for entry:', {
        entryId: newTimeTracking.id,
        hours: newTimeTracking.hours,
        category: newTimeTracking.category
      });
      
      // Check for burnout prevention (weekly hours > 40)
      const burnoutResult = await this.checkBurnoutPrevention(employeeId, newTimeTracking);
      if (burnoutResult.isAnomaly) {
        results.push(burnoutResult);
      }
      
      // Check for unusually high daily hours
      const highHoursResult = this.checkHighDailyHours(newTimeTracking);
      if (highHoursResult.isAnomaly) {
        results.push(highHoursResult);
      }
      
      console.log('🔍 AnomalyDetection: Time tracking anomaly check completed:', {
        entryId: newTimeTracking.id,
        anomaliesFound: results.length,
        results: results.map(r => ({ reason: r.reason, severity: r.severity }))
      });
      
    } catch (error) {
      console.error('❌ AnomalyDetection: Error detecting time tracking anomaly:', error);
    }
    
    return results;
  }

  /**
   * Detect policy violations
   */
  static async detectPolicyViolations(
    employeeId: string,
    mileageEntries: MileageEntry[],
    receipts: Receipt[]
  ): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];
    
    try {
      // Check per diem limits
      const perDiemResult = this.checkPerDiemLimits(receipts);
      if (perDiemResult.isAnomaly) {
        results.push(perDiemResult);
      }
      
      // Check monthly mileage limits
      const monthlyMileageResult = this.checkMonthlyMileageLimits(mileageEntries);
      if (monthlyMileageResult.isAnomaly) {
        results.push(monthlyMileageResult);
      }
      
      // Check expense categorization
      const categorizationResult = this.checkExpenseCategorization(receipts);
      if (categorizationResult.isAnomaly) {
        results.push(categorizationResult);
      }
      
    } catch (error) {
      console.error('❌ AnomalyDetection: Error detecting policy violations:', error);
    }
    
    return results;
  }

  /**
   * Generate smart alerts from anomaly results
   */
  static generateAlerts(
    employeeId: string,
    anomalies: AnomalyDetectionResult[],
    context: 'mileage' | 'receipt' | 'policy' | 'monthly' | 'time_tracking'
  ): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];
    
    anomalies.forEach((anomaly, index) => {
      const alert: AnomalyAlert = {
        id: `${employeeId}-${context}-${Date.now()}-${index}`,
        type: this.getAlertType(anomaly.severity),
        title: this.getAlertTitle(anomaly, context),
        message: anomaly.reason,
        severity: anomaly.severity,
        category: this.getAlertCategory(context),
        timestamp: new Date(),
        dismissed: false,
        actionRequired: anomaly.severity === 'high' || anomaly.severity === 'critical',
        suggestedAction: anomaly.suggestedAction
      };
      
      alerts.push(alert);
    });
    
    // Store alerts
    this.alerts.push(...alerts);
    
    console.log('🚨 AnomalyDetection: Generated alerts:', alerts.length);
    
    return alerts;
  }

  /**
   * Get active alerts for an employee
   */
  static getActiveAlerts(employeeId: string): AnomalyAlert[] {
    return this.alerts.filter(alert => 
      alert.id.startsWith(employeeId) && 
      !alert.dismissed
    );
  }

  /**
   * Dismiss an alert
   */
  static dismissAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.dismissed = true;
      console.log('✅ AnomalyDetection: Alert dismissed:', alertId);
    }
  }

  // Private helper methods

  private static async getBaseline(employeeId: string): Promise<UserBehaviorBaseline> {
    let baseline = this.baselines.get(employeeId);
    if (!baseline) {
      baseline = await this.initializeBaselines(employeeId);
    }
    return baseline;
  }

  private static calculateBaseline(
    mileageEntries: MileageEntry[],
    receipts: Receipt[],
    timeTracking: TimeTracking[]
  ): UserBehaviorBaseline {
    // If no historical data, use default baseline
    if (mileageEntries.length === 0 && receipts.length === 0) {
      console.log('🔍 AnomalyDetection: No historical data, using default baseline');
      return this.getDefaultBaseline();
    }

    // Calculate daily mileage patterns
    const dailyMileage = this.groupByDay(mileageEntries);
    const dailyMileageValues = Object.values(dailyMileage).map(entries => 
      entries.reduce((sum, entry) => sum + entry.miles, 0)
    );
    
    // Calculate trip patterns
    const tripMileageValues = mileageEntries.map(entry => entry.miles);
    
    // Calculate expense patterns
    const dailyExpenses = this.groupReceiptsByDay(receipts);
    const dailyExpenseValues = Object.values(dailyExpenses).map(receipts => 
      receipts.reduce((sum, receipt) => sum + receipt.amount, 0)
    );
    
    const receiptAmounts = receipts.map(receipt => receipt.amount);
    
    // Calculate route patterns
    const routeFrequency = this.calculateRouteFrequency(mileageEntries);
    
    // Calculate purpose patterns
    const purposeFrequency = this.calculatePurposeFrequency(mileageEntries);
    
    // Use default values if no data available
    const averageDailyMiles = dailyMileageValues.length > 0 ? this.calculateAverage(dailyMileageValues) : 50;
    const maxDailyMiles = dailyMileageValues.length > 0 ? Math.max(...dailyMileageValues) : 200;
    const averageTripMiles = tripMileageValues.length > 0 ? this.calculateAverage(tripMileageValues) : 25;
    const maxTripMiles = tripMileageValues.length > 0 ? Math.max(...tripMileageValues) : 150;
    const averageDailyExpenses = dailyExpenseValues.length > 0 ? this.calculateAverage(dailyExpenseValues) : 30;
    const maxDailyExpenses = dailyExpenseValues.length > 0 ? Math.max(...dailyExpenseValues) : 150;
    const averageReceiptAmount = receiptAmounts.length > 0 ? this.calculateAverage(receiptAmounts) : 25;
    const maxReceiptAmount = receiptAmounts.length > 0 ? Math.max(...receiptAmounts) : 200;
    
    return {
      averageDailyMiles,
      maxDailyMiles,
      averageTripMiles,
      maxTripMiles,
      averageDailyExpenses,
      maxDailyExpenses,
      averageReceiptAmount,
      maxReceiptAmount,
      typicalTripPurposes: purposeFrequency.slice(0, 5).map(p => p.purpose),
      commonRoutes: routeFrequency.slice(0, 5),
      monthlyMileagePattern: this.calculateMonthlyPattern(mileageEntries),
      monthlyExpensePattern: this.calculateMonthlyPattern(receipts)
    };
  }

  private static checkDailyMileageAnomaly(
    employeeId: string,
    newEntry: MileageEntry,
    baseline: UserBehaviorBaseline
  ): AnomalyDetectionResult {
    // Get today's existing mileage
    const today = new Date(newEntry.date);
    today.setHours(0, 0, 0, 0);
    
    // This would need to be implemented to get today's mileage
    // For now, we'll use a simplified check
    const todayMileage = newEntry.miles; // Simplified - would need to sum all today's entries
    
    const threshold = baseline.averageDailyMiles * 2; // 2x average
    const criticalThreshold = baseline.maxDailyMiles * 1.5; // 1.5x historical max
    
    if (todayMileage > criticalThreshold) {
      return {
        isAnomaly: true,
        confidence: 0.9,
        reason: `Unusually high daily mileage: ${todayMileage.toFixed(1)} miles (max recorded: ${baseline.maxDailyMiles.toFixed(1)} miles)`,
        severity: 'critical',
        suggestedAction: 'Verify all trips are legitimate business travel'
      };
    } else if (todayMileage > threshold) {
      return {
        isAnomaly: true,
        confidence: 0.7,
        reason: `High daily mileage: ${todayMileage.toFixed(1)} miles (average: ${baseline.averageDailyMiles.toFixed(1)} miles)`,
        severity: 'medium',
        suggestedAction: 'Double-check trip accuracy'
      };
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  private static checkTripMileageAnomaly(
    newEntry: MileageEntry,
    baseline: UserBehaviorBaseline
  ): AnomalyDetectionResult {
    const threshold = baseline.averageTripMiles * 3; // 3x average trip
    const criticalThreshold = baseline.maxTripMiles * 1.2; // 1.2x historical max
    
    console.log('🔍 AnomalyDetection: Trip mileage check:', {
      entryMiles: newEntry.miles,
      averageTripMiles: baseline.averageTripMiles,
      maxTripMiles: baseline.maxTripMiles,
      threshold: threshold,
      criticalThreshold: criticalThreshold,
      isAboveThreshold: newEntry.miles > threshold,
      isAboveCritical: newEntry.miles > criticalThreshold
    });
    
    if (newEntry.miles > criticalThreshold) {
      return {
        isAnomaly: true,
        confidence: 0.8,
        reason: `Unusually long trip: ${newEntry.miles.toFixed(1)} miles (max recorded: ${baseline.maxTripMiles.toFixed(1)} miles)`,
        severity: 'high',
        suggestedAction: 'Verify route and purpose are correct'
      };
    } else if (newEntry.miles > threshold) {
      return {
        isAnomaly: true,
        confidence: 0.6,
        reason: `Long trip: ${newEntry.miles.toFixed(1)} miles (average: ${baseline.averageTripMiles.toFixed(1)} miles)`,
        severity: 'medium',
        suggestedAction: 'Confirm trip details'
      };
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  private static async checkDuplicateTripAnomaly(
    employeeId: string,
    newEntry: MileageEntry
  ): Promise<AnomalyDetectionResult> {
    try {
      // Get recent entries (last 7 days), excluding the new entry itself
      const recentEntries = await DatabaseService.getMileageEntries(employeeId);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recent = recentEntries.filter(entry => {
        const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
        return entryDate >= sevenDaysAgo && entry.id !== newEntry.id; // Exclude the new entry
      });
      
      // Check for potential duplicates with smarter logic
      const potentialDuplicates = recent.filter(entry => {
        // Must be on the same date to be a true duplicate
        const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
        const newEntryDate = newEntry.date instanceof Date ? newEntry.date : new Date(newEntry.date);
        const sameDate = entryDate.toDateString() === newEntryDate.toDateString();
        
        // Must have very similar details
        const sameRoute = entry.startLocation === newEntry.startLocation && 
                         entry.endLocation === newEntry.endLocation;
        const similarMiles = Math.abs(entry.miles - newEntry.miles) < 2; // Within 2 miles (stricter)
        const samePurpose = entry.purpose === newEntry.purpose;
        
        // Must be created within a short time window (not trip chaining)
        // Only check time if both entries have createdAt timestamps
        let withinShortTime = true; // Default to true if no timestamps available
        if (entry.createdAt && newEntry.createdAt) {
          const entryTime = entry.createdAt instanceof Date ? entry.createdAt : new Date(entry.createdAt);
          const newEntryTime = newEntry.createdAt instanceof Date ? newEntry.createdAt : new Date(newEntry.createdAt);
          const timeDiff = Math.abs(entryTime.getTime() - newEntryTime.getTime());
          withinShortTime = timeDiff < 30 * 60 * 1000; // Within 30 minutes
        }
        
        return sameDate && sameRoute && similarMiles && samePurpose && withinShortTime;
      });
      
      // Only flag if we find 2+ potential duplicates (indicating repeated mistakes)
      if (potentialDuplicates.length >= 2) {
        return {
          isAnomaly: true,
          confidence: 0.9,
          reason: `Potential duplicate entries detected: ${potentialDuplicates.length + 1} very similar trips on ${newEntry.date.toLocaleDateString()}`,
          severity: 'high',
          suggestedAction: 'Review entries - these appear to be duplicates'
        };
      }
      
      // Check for trips that are suspiciously similar but not exact duplicates
      const suspiciousTrips = recent.filter(entry => {
        const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
        const newEntryDate = newEntry.date instanceof Date ? newEntry.date : new Date(newEntry.date);
        const sameDate = entryDate.toDateString() === newEntryDate.toDateString();
        const sameRoute = entry.startLocation === newEntry.startLocation && 
                         entry.endLocation === newEntry.endLocation;
        const similarMiles = Math.abs(entry.miles - newEntry.miles) < 5;
        const samePurpose = entry.purpose === newEntry.purpose;
        
        return sameDate && sameRoute && similarMiles && samePurpose;
      });
      
      // Flag if we find 1+ suspicious trips (could be accidental duplicate)
      // Only warn if there's actually a different trip, not just the one we created
      if (suspiciousTrips.length >= 1) {
        return {
          isAnomaly: true,
          confidence: 0.6,
          reason: `Similar trip found on ${newEntry.date.toLocaleDateString()}: ${suspiciousTrips[0].miles.toFixed(1)} miles`,
          severity: 'low',
          suggestedAction: 'Verify this is not a duplicate entry'
        };
      }
      
    } catch (error) {
      console.error('Error checking duplicate trip:', error);
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  private static checkUnusualRouteAnomaly(
    newEntry: MileageEntry,
    baseline: UserBehaviorBaseline
  ): AnomalyDetectionResult {
    const route = `${newEntry.startLocation} → ${newEntry.endLocation}`;
    const isKnownRoute = baseline.commonRoutes.some(r => r.route === route);
    
    if (!isKnownRoute && newEntry.miles > baseline.averageTripMiles) {
      return {
        isAnomaly: true,
        confidence: 0.5,
        reason: `New route detected: ${route}`,
        severity: 'low',
        suggestedAction: 'Save this route for future reference'
      };
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  private static checkReceiptAmountAnomaly(
    newReceipt: Receipt,
    baseline: UserBehaviorBaseline
  ): AnomalyDetectionResult {
    const threshold = baseline.averageReceiptAmount * 3; // 3x average
    const criticalThreshold = baseline.maxReceiptAmount * 1.5; // 1.5x historical max
    
    if (newReceipt.amount > criticalThreshold) {
      return {
        isAnomaly: true,
        confidence: 0.8,
        reason: `Unusually high receipt: $${newReceipt.amount.toFixed(2)} (max recorded: $${baseline.maxReceiptAmount.toFixed(2)})`,
        severity: 'high',
        suggestedAction: 'Verify receipt amount and vendor'
      };
    } else if (newReceipt.amount > threshold) {
      return {
        isAnomaly: true,
        confidence: 0.6,
        reason: `High receipt amount: $${newReceipt.amount.toFixed(2)} (average: $${baseline.averageReceiptAmount.toFixed(2)})`,
        severity: 'medium',
        suggestedAction: 'Double-check receipt details'
      };
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  private static async checkDailyExpenseAnomaly(
    employeeId: string,
    newReceipt: Receipt,
    baseline: UserBehaviorBaseline
  ): Promise<AnomalyDetectionResult> {
    // This would need to be implemented to get today's expenses
    // For now, simplified check
    const todayExpenses = newReceipt.amount; // Simplified
    
    const threshold = baseline.averageDailyExpenses * 2;
    const criticalThreshold = baseline.maxDailyExpenses * 1.5;
    
    if (todayExpenses > criticalThreshold) {
      return {
        isAnomaly: true,
        confidence: 0.8,
        reason: `Unusually high daily expenses: $${todayExpenses.toFixed(2)} (max recorded: $${baseline.maxDailyExpenses.toFixed(2)})`,
        severity: 'high',
        suggestedAction: 'Review all expenses for today'
      };
    } else if (todayExpenses > threshold) {
      return {
        isAnomaly: true,
        confidence: 0.6,
        reason: `High daily expenses: $${todayExpenses.toFixed(2)} (average: $${baseline.averageDailyExpenses.toFixed(2)})`,
        severity: 'medium',
        suggestedAction: 'Verify expense legitimacy'
      };
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  private static checkVendorAnomaly(
    newReceipt: Receipt,
    baseline: UserBehaviorBaseline
  ): AnomalyDetectionResult {
    // This would need vendor frequency analysis
    // For now, simplified check for unusual vendors
    const commonVendors = ['Shell', 'Exxon', 'BP', 'Walmart', 'Target', 'Office Depot'];
    const isCommonVendor = commonVendors.some(vendor => 
      newReceipt.vendor.toLowerCase().includes(vendor.toLowerCase())
    );
    
    if (!isCommonVendor && newReceipt.amount > baseline.averageReceiptAmount * 2) {
      return {
        isAnomaly: true,
        confidence: 0.4,
        reason: `Unusual vendor: ${newReceipt.vendor}`,
        severity: 'low',
        suggestedAction: 'Verify vendor legitimacy'
      };
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  private static checkPerDiemLimits(receipts: Receipt[]): AnomalyDetectionResult {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyPerDiem = receipts
      .filter(receipt => 
        receipt.date.getMonth() === currentMonth &&
        receipt.date.getFullYear() === currentYear &&
        receipt.category === 'Per Diem'
      )
      .reduce((sum, receipt) => sum + receipt.amount, 0);
    
    const monthlyLimit = 350; // $350/month limit
    
    if (monthlyPerDiem > monthlyLimit) {
      return {
        isAnomaly: true,
        confidence: 1.0,
        reason: `Per diem limit exceeded: $${monthlyPerDiem.toFixed(2)} (limit: $${monthlyLimit})`,
        severity: 'critical',
        suggestedAction: 'Review per diem claims - limit exceeded'
      };
    } else if (monthlyPerDiem > monthlyLimit * 0.9) {
      return {
        isAnomaly: true,
        confidence: 0.8,
        reason: `Per diem approaching limit: $${monthlyPerDiem.toFixed(2)} (limit: $${monthlyLimit})`,
        severity: 'medium',
        suggestedAction: 'Monitor per diem spending'
      };
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  private static checkMonthlyMileageLimits(mileageEntries: MileageEntry[]): AnomalyDetectionResult {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyMileage = mileageEntries
      .filter(entry => 
        entry.date.getMonth() === currentMonth &&
        entry.date.getFullYear() === currentYear
      )
      .reduce((sum, entry) => sum + entry.miles, 0);
    
    const monthlyLimit = 2000; // 2000 miles/month limit
    
    if (monthlyMileage > monthlyLimit) {
      return {
        isAnomaly: true,
        confidence: 1.0,
        reason: `Monthly mileage limit exceeded: ${monthlyMileage.toFixed(1)} miles (limit: ${monthlyLimit})`,
        severity: 'critical',
        suggestedAction: 'Review mileage claims - limit exceeded'
      };
    } else if (monthlyMileage > monthlyLimit * 0.9) {
      return {
        isAnomaly: true,
        confidence: 0.8,
        reason: `Monthly mileage approaching limit: ${monthlyMileage.toFixed(1)} miles (limit: ${monthlyLimit})`,
        severity: 'medium',
        suggestedAction: 'Monitor mileage spending'
      };
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  private static checkExpenseCategorization(receipts: Receipt[]): AnomalyDetectionResult {
    const uncategorizedReceipts = receipts.filter(receipt => 
      !receipt.category || receipt.category === 'Uncategorized'
    );
    
    if (uncategorizedReceipts.length > 0) {
      return {
        isAnomaly: true,
        confidence: 0.7,
        reason: `${uncategorizedReceipts.length} receipts need categorization`,
        severity: 'medium',
        suggestedAction: 'Categorize receipts for accurate reporting'
      };
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  // Time tracking anomaly detection methods

  private static async checkBurnoutPrevention(
    employeeId: string, 
    newTimeTracking: TimeTracking
  ): Promise<AnomalyDetectionResult> {
    try {
      // Get all time tracking entries for the current week
      const allTimeTracking = await DatabaseService.getTimeTrackingEntries(employeeId);
      const currentWeekStart = this.getWeekStartDate(newTimeTracking.date);
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
      
      // Filter entries for current week
      const weekEntries = allTimeTracking.filter(entry => {
        const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
        return entryDate >= currentWeekStart && entryDate <= currentWeekEnd;
      });
      
      // Calculate total hours for the week
      const totalWeeklyHours = weekEntries.reduce((sum, entry) => sum + entry.hours, 0);
      
      // Check if this week exceeds 50 hours (updated threshold)
      if (totalWeeklyHours >= 50) {
        const weekNumber = this.getWeekNumber(newTimeTracking.date);
        const weekStart = this.getWeekStartDate(newTimeTracking.date);
        
        return {
          isAnomaly: true,
          confidence: 0.9,
          reason: `⚠️ Weekly Hours Alert: Week ${weekNumber} (${weekStart.toLocaleDateString()}): ${totalWeeklyHours.toFixed(1)} hours logged - exceeds 50 hour threshold. Employee may be overworking.`,
          severity: 'high',
          suggestedAction: 'Please check in with this employee to ensure they are not overworking'
        };
      }
      
    } catch (error) {
      console.error('Error checking burnout prevention:', error);
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  private static checkHighDailyHours(newTimeTracking: TimeTracking): AnomalyDetectionResult {
    // Flag if daily hours exceed 12 (unusual)
    if (newTimeTracking.hours > 12) {
      return {
        isAnomaly: true,
        confidence: 0.7,
        reason: `High daily hours: ${newTimeTracking.hours.toFixed(1)} hours logged`,
        severity: 'medium',
        suggestedAction: 'Daily hours exceed 12 hours'
      };
    }
    
    // Flag if daily hours exceed 10 (caution)
    if (newTimeTracking.hours > 10) {
      return {
        isAnomaly: true,
        confidence: 0.5,
        reason: `Long work day: ${newTimeTracking.hours.toFixed(1)} hours logged`,
        severity: 'low',
        suggestedAction: 'Daily hours exceed 10 hours'
      };
    }
    
    return { isAnomaly: false, confidence: 0, reason: '', severity: 'low' };
  }

  // Helper methods for week calculations

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

  private static getWeekStartDate(date: Date): Date {
    // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = date.getDay();
    
    // Calculate days to subtract to get to Sunday (start of week)
    const daysToSubtract = dayOfWeek;
    
    // Create a new date for the start of the week (Sunday)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - daysToSubtract);
    
    // Set time to start of day (00:00:00)
    weekStart.setHours(0, 0, 0, 0);
    
    return weekStart;
  }

  // Utility methods

  private static groupByDay(entries: MileageEntry[]): Record<string, MileageEntry[]> {
    const grouped: Record<string, MileageEntry[]> = {};
    
    entries.forEach(entry => {
      const dayKey = entry.date.toISOString().split('T')[0];
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(entry);
    });
    
    return grouped;
  }

  private static groupReceiptsByDay(receipts: Receipt[]): Record<string, Receipt[]> {
    const grouped: Record<string, Receipt[]> = {};
    
    receipts.forEach(receipt => {
      const dayKey = receipt.date.toISOString().split('T')[0];
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(receipt);
    });
    
    return grouped;
  }

  private static calculateRouteFrequency(entries: MileageEntry[]): Array<{ route: string; frequency: number }> {
    const routeCount: Record<string, number> = {};
    
    entries.forEach(entry => {
      const route = `${entry.startLocation} → ${entry.endLocation}`;
      routeCount[route] = (routeCount[route] || 0) + 1;
    });
    
    return Object.entries(routeCount)
      .map(([route, frequency]) => ({ route, frequency }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  private static calculatePurposeFrequency(entries: MileageEntry[]): Array<{ purpose: string; frequency: number }> {
    const purposeCount: Record<string, number> = {};
    
    entries.forEach(entry => {
      purposeCount[entry.purpose] = (purposeCount[entry.purpose] || 0) + 1;
    });
    
    return Object.entries(purposeCount)
      .map(([purpose, frequency]) => ({ purpose, frequency }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  private static calculateMonthlyPattern(entries: Array<{ date: Date }>): number[] {
    const monthlyTotals = new Array(12).fill(0);
    
    entries.forEach(entry => {
      const month = entry.date.getMonth();
      monthlyTotals[month]++;
    });
    
    return monthlyTotals;
  }

  private static calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private static getDefaultBaseline(): UserBehaviorBaseline {
    return {
      averageDailyMiles: 50,
      maxDailyMiles: 200,
      averageTripMiles: 25,
      maxTripMiles: 150,
      averageDailyExpenses: 30,
      maxDailyExpenses: 150,
      averageReceiptAmount: 25,
      maxReceiptAmount: 200,
      typicalTripPurposes: ['Client visit', 'Meeting', 'Training'],
      commonRoutes: [],
      monthlyMileagePattern: new Array(12).fill(0),
      monthlyExpensePattern: new Array(12).fill(0)
    };
  }

  private static getAlertType(severity: string): 'info' | 'warning' | 'error' | 'success' {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'info';
    }
  }

  private static getAlertTitle(anomaly: AnomalyDetectionResult, context: string): string {
    const severity = anomaly.severity.toUpperCase();
    const contextMap: { [key: string]: string } = {
      'mileage': 'Mileage Alert',
      'receipt': 'Expense Alert',
      'policy': 'Policy Alert',
      'monthly': 'Monthly Alert',
      'time_tracking': 'Time Tracking Alert'
    };
    
    return `${severity}: ${contextMap[context] || 'Anomaly Alert'}`;
  }

  private static getAlertCategory(context: string): 'mileage' | 'expense' | 'policy' | 'budget' | 'pattern' {
    switch (context) {
      case 'mileage': return 'mileage';
      case 'receipt': return 'expense';
      case 'policy': return 'policy';
      case 'monthly': return 'budget';
      case 'time_tracking': return 'pattern';
      default: return 'pattern';
    }
  }
}

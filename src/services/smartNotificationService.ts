import { DatabaseService } from './database';
import { debugLog, debugWarn } from '../config/debug';

export interface SmartNotification {
  id: string;
  type: 'mileage' | 'receipt' | 'report' | 'per_diem' | 'report_status';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  timestamp: Date;
}

export class SmartNotificationService {
  /**
   * Check for contextual notifications based on current data
   */
  static async checkNotifications(
    employeeId: string,
    currentDate: Date = new Date()
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = [];

    try {
      // Check for missing receipts for large expenses
      const receiptNotification = await this.checkMissingReceipts(employeeId, currentDate);
      if (receiptNotification) {
        notifications.push(receiptNotification);
      }

      // Check for month-end report reminder
      const reportNotification = await this.checkMonthEndReminder(employeeId, currentDate);
      if (reportNotification) {
        notifications.push(reportNotification);
      }

      // Check for per diem eligibility
      const perDiemNotification = await this.checkPerDiemEligibility(employeeId, currentDate);
      if (perDiemNotification) {
        notifications.push(perDiemNotification);
      }

      // Check for pending report status
      const statusNotification = await this.checkReportStatus(employeeId, currentDate);
      if (statusNotification) {
        notifications.push(statusNotification);
      }

      debugLog(`📬 Generated ${notifications.length} smart notifications for employee ${employeeId}`);
      return notifications;
    } catch (error) {
      debugWarn('Error checking smart notifications:', error);
      return [];
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula (in miles)
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if user was 50+ miles away from base address overnight
   */
  private static async checkOvernightDistance(
    employeeId: string,
    currentDate: Date,
    baseLat?: number,
    baseLon?: number
  ): Promise<boolean> {
    try {
      // Need base address coordinates to calculate distance
      if (!baseLat || !baseLon) {
        return false;
      }

      // Check yesterday's entries (evening) and today's entries (morning)
      const yesterday = new Date(currentDate);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date(currentDate);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get entries from yesterday and today
      const yesterdayEntries = await DatabaseService.getMileageEntries(
        employeeId,
        yesterday,
        today
      );
      const todayEntries = await DatabaseService.getMileageEntries(
        employeeId,
        today,
        tomorrow
      );

      // Check yesterday's entries ending locations (evening/end of day)
      for (const entry of yesterdayEntries) {
        if (entry.endLocationDetails?.latitude && entry.endLocationDetails?.longitude) {
          const distance = this.calculateDistance(
            baseLat,
            baseLon,
            entry.endLocationDetails.latitude,
            entry.endLocationDetails.longitude
          );
          if (distance >= 50) {
            return true;
          }
        }
      }

      // Check today's entries starting locations (morning/start of day)
      for (const entry of todayEntries) {
        if (entry.startLocationDetails?.latitude && entry.startLocationDetails?.longitude) {
          const distance = this.calculateDistance(
            baseLat,
            baseLon,
            entry.startLocationDetails.latitude,
            entry.startLocationDetails.longitude
          );
          if (distance >= 50) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      debugWarn('Error checking overnight distance:', error);
      return false;
    }
  }

  /**
   * Check for large expenses without receipts
   */
  private static async checkMissingReceipts(
    employeeId: string,
    currentDate: Date
  ): Promise<SmartNotification | null> {
    try {
      // Get receipts from the last 7 days
      const sevenDaysAgo = new Date(currentDate);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const receipts = await DatabaseService.getReceipts(employeeId, sevenDaysAgo, currentDate);

      // Check if there are any large expenses (> $50) without images
      const missingReceipts = receipts.filter(
        receipt => receipt.amount > 50 && (!receipt.imageUri || receipt.imageUri === '')
      );

      if (missingReceipts.length > 0) {
        const totalMissing = missingReceipts.reduce((sum, r) => sum + r.amount, 0);
        return {
          id: `receipt_${currentDate.toISOString().split('T')[0]}`,
          type: 'receipt',
          priority: 'high',
          title: 'Receipt photos needed',
          message: `You have $${totalMissing.toFixed(2)} in expenses without receipt photos. Add photos to ensure proper reimbursement.`,
          actionLabel: 'Add Receipts',
          actionRoute: 'Receipts',
          timestamp: currentDate,
        };
      }

      return null;
    } catch (error) {
      debugWarn('Error checking missing receipts:', error);
      return null;
    }
  }

  /**
   * Check if month is ending soon and remind to review report
   */
  private static async checkMonthEndReminder(
    employeeId: string,
    currentDate: Date
  ): Promise<SmartNotification | null> {
    try {
      const dayOfMonth = currentDate.getDate();
      const daysInMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      ).getDate();
      const daysRemaining = daysInMonth - dayOfMonth;

      // Remind user 3 days before month end
      if (daysRemaining <= 3 && daysRemaining > 0) {
        const monthName = currentDate.toLocaleString('default', { month: 'long' });
        const year = currentDate.getFullYear();

        // Check if report is already submitted
        const monthlyReports = await DatabaseService.getMonthlyReports(employeeId);
        const currentMonthReport = monthlyReports.find(
          report =>
            report.month === currentDate.getMonth() + 1 && report.year === currentDate.getFullYear()
        );

        if (!currentMonthReport || currentMonthReport.status === 'draft') {
          return {
            id: `report_reminder_${currentDate.getMonth()}_${currentDate.getFullYear()}`,
            type: 'report',
            priority: 'high',
            title: 'Month ending soon - review your report',
            message: `Only ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} left in ${monthName}. Review and submit your expense report soon from the web portal.`,
            timestamp: currentDate,
          };
        }
      }

      return null;
    } catch (error) {
      debugWarn('Error checking month end reminder:', error);
      return null;
    }
  }

  /**
   * Check for per diem eligibility today
   */
  private static async checkPerDiemEligibility(
    employeeId: string,
    currentDate: Date
  ): Promise<SmartNotification | null> {
    try {
      // Get employee to access base address
      const employee = await DatabaseService.getEmployeeById(employeeId);
      if (!employee || !employee.baseAddress) {
        return null;
      }

      // Get today's mileage and time tracking
      const today = new Date(currentDate);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mileageEntries = await DatabaseService.getMileageEntries(employeeId, today, tomorrow);
      const timeEntries = await DatabaseService.getTimeTrackingEntries(employeeId, today, tomorrow);

      // Calculate total miles for today
      const totalMiles = mileageEntries.reduce((sum, entry) => sum + (entry.miles || 0), 0);

      // Calculate total hours for today (TimeTracking uses hours field directly)
      const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);

      // Try to get base address coordinates from saved addresses
      let baseLat: number | undefined;
      let baseLon: number | undefined;
      try {
        const savedAddresses = await DatabaseService.getSavedAddresses(employeeId);
        const baseAddressMatch = savedAddresses.find(
          addr => addr.address.toLowerCase() === employee.baseAddress.toLowerCase()
        );
        if (baseAddressMatch?.latitude && baseAddressMatch?.longitude) {
          baseLat = baseAddressMatch.latitude;
          baseLon = baseAddressMatch.longitude;
        }
      } catch (error) {
        // If we can't get saved addresses, continue without coordinates
        debugWarn('Could not get saved addresses for base address coordinates:', error);
      }

      // Check for overnight distance (50+ miles from base)
      const isOvernight = baseLat && baseLon 
        ? await this.checkOvernightDistance(employeeId, currentDate, baseLat, baseLon)
        : false;

      // Check if user might be eligible for per diem
      // Eligible if: 8+ hours AND (100+ miles OR overnight stay 50+ miles from base)
      const isEligible = totalHours >= 8 && (totalMiles >= 100 || isOvernight);

      if (isEligible) {
        // Check if per diem already claimed for today
        const receipts = await DatabaseService.getReceipts(employeeId, today, tomorrow);
        const hasPerDiemReceipt = receipts.some(
          receipt =>
            receipt.category === 'Per Diem' &&
            new Date(receipt.date).toDateString() === currentDate.toDateString()
        );

        if (!hasPerDiemReceipt) {
          let message = `You've worked ${totalHours.toFixed(1)} hours`;
          if (totalMiles >= 100) {
            message += ` and driven ${totalMiles.toFixed(1)} miles today`;
          }
          if (isOvernight) {
            message += ` and were 50+ miles away from base address overnight`;
          }
          message += `. You may be eligible for per diem.`;

          return {
            id: `per_diem_${currentDate.toISOString().split('T')[0]}`,
            type: 'per_diem',
            priority: 'medium',
            title: 'Per Diem eligible today',
            message: message,
            actionLabel: 'Add Per Diem',
            actionRoute: 'Receipts',
            timestamp: currentDate,
          };
        }
      }

      return null;
    } catch (error) {
      debugWarn('Error checking per diem eligibility:', error);
      return null;
    }
  }

  /**
   * Check for pending report approval status
   */
  private static async checkReportStatus(
    employeeId: string,
    currentDate: Date
  ): Promise<SmartNotification | null> {
    try {
      const monthlyReports = await DatabaseService.getMonthlyReports(employeeId);

      // Check for reports pending approval (submitted but not yet approved)
      const pendingReports = monthlyReports.filter(report => report.status === 'submitted');

      if (pendingReports.length > 0) {
        const mostRecent = pendingReports.sort((a, b) => {
          const dateA = new Date(`${a.year}-${a.month}-01`);
          const dateB = new Date(`${b.year}-${b.month}-01`);
          return dateB.getTime() - dateA.getTime();
        })[0];

        const monthName = new Date(mostRecent.year, mostRecent.month - 1, 1).toLocaleString(
          'default',
          { month: 'long' }
        );

        return {
          id: `report_status_${mostRecent.month}_${mostRecent.year}`,
          type: 'report_status',
          priority: 'low',
          title: 'Report pending supervisor approval',
          message: `Your ${monthName} ${mostRecent.year} expense report is awaiting supervisor approval. Track approval status from the web portal.`,
          timestamp: currentDate,
        };
      }

      return null;
    } catch (error) {
      debugWarn('Error checking report status:', error);
      return null;
    }
  }
}

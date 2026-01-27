/**
 * Biweekly Report Service
 * Handles biweekly report submission and approval workflow (month-based: 1-15, 16-end)
 */

import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';

export interface BiweeklyReport {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  periodNumber: number; // 1 or 2 (first half or second half)
  startDate: string;
  endDate: string;
  totalMiles: number;
  totalExpenses: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_revision';
  submittedAt?: string;
  submittedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BiweeklyPeriod {
  periodNumber: number;
  month: number;
  year: number;
  startDate: Date;
  endDate: Date;
  label: string;
}

export class BiweeklyReportService {
  /**
   * Get the first half period (1-15) of a month
   */
  static getFirstHalfPeriod(month: number, year: number): BiweeklyPeriod {
    return {
      periodNumber: 1,
      month,
      year,
      startDate: new Date(year, month - 1, 1),
      endDate: new Date(year, month - 1, 15),
      label: 'First Half'
    };
  }

  /**
   * Get the second half period (16-end) of a month
   */
  static getSecondHalfPeriod(month: number, year: number): BiweeklyPeriod {
    const lastDay = new Date(year, month, 0).getDate();
    return {
      periodNumber: 2,
      month,
      year,
      startDate: new Date(year, month - 1, 16),
      endDate: new Date(year, month - 1, lastDay),
      label: 'Second Half'
    };
  }

  /**
   * Get the current biweekly period based on today's date
   */
  static getCurrentBiweeklyPeriod(): BiweeklyPeriod {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    if (day <= 15) {
      return this.getFirstHalfPeriod(month, year);
    } else {
      return this.getSecondHalfPeriod(month, year);
    }
  }

  /**
   * Get all biweekly periods for a given month
   */
  static getBiweeklyPeriodsForMonth(month: number, year: number): BiweeklyPeriod[] {
    return [
      this.getFirstHalfPeriod(month, year),
      this.getSecondHalfPeriod(month, year)
    ];
  }

  /**
   * Format biweekly period label for display
   */
  static formatPeriodLabel(period: BiweeklyPeriod): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${period.label} of ${monthNames[period.month - 1]} ${period.year}`;
  }

  /**
   * Format biweekly period date range for display
   */
  static formatPeriodDateRange(period: BiweeklyPeriod): string {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const month = monthNames[period.month - 1];
    const startDay = period.startDate.getDate();
    const endDay = period.endDate.getDate();
    return `${month} ${startDay}-${endDay}, ${period.year}`;
  }

  /**
   * Get biweekly report for a specific period
   */
  static async getBiweeklyReport(
    employeeId: string,
    year: number,
    month: number,
    period: number
  ): Promise<BiweeklyReport | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/biweekly-reports/employee/${employeeId}/${year}/${month}/${period}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      return data || null;
    } catch (error) {
      console.error('❌ BiweeklyReport: Error fetching biweekly report:', error);
      return null;
    }
  }

  /**
   * Get all biweekly reports for an employee
   */
  static async getBiweeklyReports(
    employeeId: string,
    status?: string
  ): Promise<BiweeklyReport[]> {
    try {
      let url = `${API_BASE_URL}/biweekly-reports?employeeId=${employeeId}`;
      if (status) {
        url += `&status=${status}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ BiweeklyReport: Error fetching biweekly reports:', error);
      return [];
    }
  }

  /**
   * Create or update a biweekly report
   */
  static async saveReport(
    report: Partial<BiweeklyReport>
  ): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/biweekly-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ BiweeklyReport: Report saved:', data.id);
      return { success: true, reportId: data.id };
    } catch (error: any) {
      console.error('❌ BiweeklyReport: Error saving report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Submit a biweekly report for approval
   */
  static async submitForApproval(
    reportId: string,
    submittedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`📤 BiweeklyReport: Submitting report ${reportId} for approval`);
      
      const response = await fetch(
        `${API_BASE_URL}/biweekly-reports/${reportId}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ submittedBy }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      console.log('✅ BiweeklyReport: Report submitted successfully');
      return { success: true };
    } catch (error: any) {
      console.error('❌ BiweeklyReport: Error submitting report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Approve a biweekly report (supervisor only)
   */
  static async approveReport(
    reportId: string,
    approvedBy: string,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/biweekly-reports/${reportId}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ approvedBy, comments }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ BiweeklyReport: Error approving report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reject a biweekly report (supervisor only)
   */
  static async rejectReport(
    reportId: string,
    rejectedBy: string,
    rejectionReason: string,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/biweekly-reports/${reportId}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rejectedBy, rejectionReason, comments }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ BiweeklyReport: Error rejecting report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Request revision on a biweekly report (supervisor only)
   */
  static async requestRevision(
    reportId: string,
    reviewedBy: string,
    comments: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/biweekly-reports/${reportId}/request-revision`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reviewedBy, comments }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ BiweeklyReport: Error requesting revision:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get pending biweekly reports for a supervisor
   */
  static async getPendingReportsForSupervisor(
    supervisorId: string
  ): Promise<BiweeklyReport[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/biweekly-reports/supervisor/${supervisorId}/pending`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ BiweeklyReport: Error fetching pending reports:', error);
      return [];
    }
  }

  /**
   * Delete a biweekly report
   */
  static async deleteReport(reportId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/biweekly-reports/${reportId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ BiweeklyReport: Error deleting report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate totals for a biweekly period
   */
  static async calculatePeriodTotals(
    employeeId: string,
    period: BiweeklyPeriod
  ): Promise<{ totalMiles: number; totalExpenses: number }> {
    try {
      // This would query the local database for all entries in the period
      // For now, returning placeholder values
      // TODO: Implement actual calculation from mileage_entries and receipts
      return {
        totalMiles: 0,
        totalExpenses: 0
      };
    } catch (error) {
      console.error('❌ BiweeklyReport: Error calculating period totals:', error);
      return { totalMiles: 0, totalExpenses: 0 };
    }
  }

  /**
   * Get status badge configuration
   */
  static getStatusBadge(status: string): {
    color: string;
    icon: string;
    label: string;
  } {
    switch (status) {
      case 'draft':
        return {
          color: '#9E9E9E',
          icon: 'edit',
          label: 'Draft',
        };
      case 'submitted':
        return {
          color: '#2196F3',
          icon: 'send',
          label: 'Submitted',
        };
      case 'approved':
        return {
          color: '#4CAF50',
          icon: 'check-circle',
          label: 'Approved',
        };
      case 'rejected':
        return {
          color: '#f44336',
          icon: 'cancel',
          label: 'Rejected',
        };
      case 'needs_revision':
        return {
          color: '#FF9800',
          icon: 'edit',
          label: 'Needs Revision',
        };
      default:
        return {
          color: '#9E9E9E',
          icon: 'help',
          label: 'Unknown',
        };
    }
  }
}

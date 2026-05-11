/**
 * Monthly Report Service
 * Handles monthly report submission and approval workflow
 */

import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';

export interface MonthlyReport {
  id: string;
  employeeId: string;
  month: number;
  year: number;
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

export class MonthlyReportService {
  /**
   * Get monthly report for specific employee/month/year
   */
  static async getMonthlyReport(
    employeeId: string,
    year: number,
    month: number
  ): Promise<MonthlyReport | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/monthly-reports?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      return data || null;
    } catch (error) {
      console.error('❌ MonthlyReport: Error fetching monthly report:', error);
      return null;
    }
  }

  /**
   * Get all monthly reports for an employee
   */
  static async getEmployeeReports(
    employeeId: string,
    status?: string
  ): Promise<MonthlyReport[]> {
    try {
      let url = `${API_BASE_URL}/monthly-reports?employeeId=${employeeId}`;
      if (status) {
        url += `&status=${status}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ MonthlyReport: Error fetching employee reports:', error);
      return [];
    }
  }

  /**
   * Create or update monthly report
   */
  static async saveMonthlyReport(
    report: Partial<MonthlyReport>
  ): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/expense-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: report.employeeId,
          month: report.month,
          year: report.year,
          status: report.status || 'draft',
          reportData: (report as any).reportData || {
            totalMiles: report.totalMiles || 0,
            totalExpenses: report.totalExpenses || 0,
            comments: report.comments || '',
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ MonthlyReport: Report saved:', data.id);
      return { success: true, reportId: data.id };
    } catch (error: any) {
      console.error('❌ MonthlyReport: Error saving report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Submit monthly report for approval
   */
  static async submitForApproval(
    reportId: string,
    submittedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`📤 MonthlyReport: Submitting report ${reportId} for approval`);
      
      const response = await fetch(
        `${API_BASE_URL}/expense-reports/${reportId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'submitted', submittedBy }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      console.log('✅ MonthlyReport: Report submitted successfully');
      return { success: true };
    } catch (error: any) {
      console.error('❌ MonthlyReport: Error submitting report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Approve monthly report (supervisor only)
   */
  static async approveReport(
    reportId: string,
    approvedBy: string,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/expense-reports/${reportId}/approval`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'approve', approverId: approvedBy, comments }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ MonthlyReport: Error approving report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reject monthly report (supervisor only)
   */
  static async rejectReport(
    reportId: string,
    rejectedBy: string,
    rejectionReason: string,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/expense-reports/${reportId}/approval`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'reject',
            approverId: rejectedBy,
            comments: comments || rejectionReason,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ MonthlyReport: Error rejecting report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Request revision on monthly report (supervisor only)
   */
  static async requestRevision(
    reportId: string,
    reviewedBy: string,
    comments: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/expense-reports/${reportId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'needs_revision', reviewedBy, comments }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ MonthlyReport: Error requesting revision:', error);
      return { success: false, error: error.message };
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


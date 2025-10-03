import { DatabaseService } from './database';

export interface ReportStatus {
  id: string;
  reportId: string;
  employeeId: string;
  status: 'pending' | 'approved' | 'needs_revision' | 'rejected';
  supervisorId?: string;
  supervisorName?: string;
  comments?: string;
  submittedAt: Date;
  reviewedAt?: Date;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportApproval {
  reportId: string;
  employeeId: string;
  supervisorId: string;
  supervisorName: string;
  action: 'approve' | 'reject' | 'request_revision';
  comments?: string;
  timestamp: Date;
}

export interface SupervisorNotification {
  id: string;
  type: 'report_submitted' | 'report_approved' | 'report_rejected' | 'report_needs_revision';
  employeeId: string;
  employeeName: string;
  supervisorId: string;
  reportId: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface StaffNotification {
  id: string;
  type: 'report_approved' | 'report_rejected' | 'report_needs_revision' | 'supervisor_message';
  employeeId: string;
  supervisorId: string;
  supervisorName: string;
  reportId?: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export class ReportApprovalService {
  /**
   * Submit a report for supervisor review
   */
  static async submitReportForApproval(
    reportId: string,
    employeeId: string,
    supervisorId: string
  ): Promise<ReportStatus> {
    try {
      console.log('📋 ReportApproval: Submitting report for approval:', { reportId, employeeId, supervisorId });

      const reportStatus: ReportStatus = {
        id: `status-${Date.now()}`,
        reportId,
        employeeId,
        status: 'pending',
        supervisorId,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save report status to database
      await DatabaseService.createReportStatus(reportStatus);

      // Create notification for supervisor
      await this.createSupervisorNotification({
        type: 'report_submitted',
        employeeId,
        employeeName: 'Unknown Employee', // TODO: Get actual employee name
        supervisorId,
        reportId,
        message: `New report submitted for review`,
        isRead: false
      });

      console.log('📋 ReportApproval: Report submitted successfully');
      return reportStatus;

    } catch (error) {
      console.error('❌ ReportApproval: Error submitting report:', error);
      throw error;
    }
  }

  /**
   * Approve a report
   */
  static async approveReport(
    reportId: string,
    supervisorId: string,
    supervisorName: string,
    comments?: string
  ): Promise<ReportApproval> {
    try {
      console.log('✅ ReportApproval: Approving report:', { reportId, supervisorId });

      // Get report status
      const reportStatus = await DatabaseService.getReportStatus(reportId);
      if (!reportStatus) {
        throw new Error('Report status not found');
      }

      // Update report status
      const updatedStatus: ReportStatus = {
        ...reportStatus,
        status: 'approved',
        supervisorId,
        supervisorName,
        comments,
        reviewedAt: new Date(),
        approvedAt: new Date(),
        updatedAt: new Date()
      };

      await DatabaseService.updateReportStatusByReportId(reportId, updatedStatus);

      // Create approval record
      const approval: ReportApproval = {
        reportId,
        employeeId: reportStatus.employeeId,
        supervisorId,
        supervisorName,
        action: 'approve',
        comments,
        timestamp: new Date()
      };

      await DatabaseService.createReportApproval(approval);

      // Create notifications
      await this.createStaffNotification({
        type: 'report_approved',
        employeeId: reportStatus.employeeId,
        supervisorId,
        supervisorName,
        reportId,
        message: `Your report has been approved${comments ? `: ${comments}` : ''}`,
        isRead: false
      });

      await this.createSupervisorNotification({
        type: 'report_approved',
        employeeId: reportStatus.employeeId,
        employeeName: 'Unknown Employee', // TODO: Get actual employee name
        supervisorId,
        reportId,
        message: `Report approved successfully`,
        isRead: false
      });

      console.log('✅ ReportApproval: Report approved successfully');
      return approval;

    } catch (error) {
      console.error('❌ ReportApproval: Error approving report:', error);
      throw error;
    }
  }

  /**
   * Reject a report
   */
  static async rejectReport(
    reportId: string,
    supervisorId: string,
    supervisorName: string,
    comments: string
  ): Promise<ReportApproval> {
    try {
      console.log('❌ ReportApproval: Rejecting report:', { reportId, supervisorId });

      // Get report status
      const reportStatus = await DatabaseService.getReportStatus(reportId);
      if (!reportStatus) {
        throw new Error('Report status not found');
      }

      // Update report status
      const updatedStatus: ReportStatus = {
        ...reportStatus,
        status: 'rejected',
        supervisorId,
        supervisorName,
        comments,
        reviewedAt: new Date(),
        updatedAt: new Date()
      };

      await DatabaseService.updateReportStatusByReportId(reportId, updatedStatus);

      // Create rejection record
      const approval: ReportApproval = {
        reportId,
        employeeId: reportStatus.employeeId,
        supervisorId,
        supervisorName,
        action: 'reject',
        comments,
        timestamp: new Date()
      };

      await DatabaseService.createReportApproval(approval);

      // Create notifications
      await this.createStaffNotification({
        type: 'report_rejected',
        employeeId: reportStatus.employeeId,
        supervisorId,
        supervisorName,
        reportId,
        message: `Your report was rejected: ${comments}`,
        isRead: false
      });

      await this.createSupervisorNotification({
        type: 'report_rejected',
        employeeId: reportStatus.employeeId,
        employeeName: 'Unknown Employee', // TODO: Get actual employee name
        supervisorId,
        reportId,
        message: `Report rejected`,
        isRead: false
      });

      console.log('❌ ReportApproval: Report rejected successfully');
      return approval;

    } catch (error) {
      console.error('❌ ReportApproval: Error rejecting report:', error);
      throw error;
    }
  }

  /**
   * Request report revision
   */
  static async requestRevision(
    reportId: string,
    supervisorId: string,
    supervisorName: string,
    comments: string
  ): Promise<ReportApproval> {
    try {
      console.log('🔄 ReportApproval: Requesting revision:', { reportId, supervisorId });

      // Get report status
      const reportStatus = await DatabaseService.getReportStatus(reportId);
      if (!reportStatus) {
        throw new Error('Report status not found');
      }

      // Update report status
      const updatedStatus: ReportStatus = {
        ...reportStatus,
        status: 'needs_revision',
        supervisorId,
        supervisorName,
        comments,
        reviewedAt: new Date(),
        updatedAt: new Date()
      };

      await DatabaseService.updateReportStatusByReportId(reportId, updatedStatus);

      // Create revision request record
      const approval: ReportApproval = {
        reportId,
        employeeId: reportStatus.employeeId,
        supervisorId,
        supervisorName,
        action: 'request_revision',
        comments,
        timestamp: new Date()
      };

      await DatabaseService.createReportApproval(approval);

      // Create notifications
      await this.createStaffNotification({
        type: 'report_needs_revision',
        employeeId: reportStatus.employeeId,
        supervisorId,
        supervisorName,
        reportId,
        message: `Your report needs revision: ${comments}`,
        isRead: false
      });

      await this.createSupervisorNotification({
        type: 'report_needs_revision',
        employeeId: reportStatus.employeeId,
        employeeName: 'Unknown Employee', // TODO: Get actual employee name
        supervisorId,
        reportId,
        message: `Revision requested`,
        isRead: false
      });

      console.log('🔄 ReportApproval: Revision requested successfully');
      return approval;

    } catch (error) {
      console.error('❌ ReportApproval: Error requesting revision:', error);
      throw error;
    }
  }

  /**
   * Get pending reports for a supervisor
   */
  static async getPendingReports(supervisorId: string): Promise<ReportStatus[]> {
    try {
      console.log('📋 ReportApproval: Getting pending reports for supervisor:', supervisorId);

      const reportStatuses = await DatabaseService.getReportStatuses();
      const pendingReports = reportStatuses.filter((status: ReportStatus) => 
        status.supervisorId === supervisorId && status.status === 'pending'
      );

      // Sort by submission date (oldest first)
      pendingReports.sort((a: ReportStatus, b: ReportStatus) => a.submittedAt.getTime() - b.submittedAt.getTime());

      console.log('📋 ReportApproval: Found pending reports:', pendingReports.length);
      return pendingReports;

    } catch (error) {
      console.error('❌ ReportApproval: Error getting pending reports:', error);
      return [];
    }
  }

  /**
   * Get report history for a supervisor
   */
  static async getReportHistory(supervisorId: string, limit: number = 50): Promise<ReportStatus[]> {
    try {
      console.log('📋 ReportApproval: Getting report history for supervisor:', supervisorId);

      const reportStatuses = await DatabaseService.getReportStatuses();
      const supervisorReports = reportStatuses.filter((status: ReportStatus) => 
        status.supervisorId === supervisorId
      );

      // Sort by review date (newest first)
      supervisorReports.sort((a: ReportStatus, b: ReportStatus) => {
        const dateA = a.reviewedAt || a.submittedAt;
        const dateB = b.reviewedAt || b.submittedAt;
        return dateB.getTime() - dateA.getTime();
      });

      console.log('📋 ReportApproval: Found report history:', supervisorReports.length);
      return supervisorReports.slice(0, limit);

    } catch (error) {
      console.error('❌ ReportApproval: Error getting report history:', error);
      return [];
    }
  }

  /**
   * Get reports for an employee
   */
  static async getEmployeeReports(employeeId: string): Promise<ReportStatus[]> {
    try {
      console.log('📋 ReportApproval: Getting reports for employee:', employeeId);

      const reportStatuses = await DatabaseService.getReportStatuses();
      const employeeReports = reportStatuses.filter((status: ReportStatus) => 
        status.employeeId === employeeId
      );

      // Sort by submission date (newest first)
      employeeReports.sort((a: ReportStatus, b: ReportStatus) => b.submittedAt.getTime() - a.submittedAt.getTime());

      console.log('📋 ReportApproval: Found employee reports:', employeeReports.length);
      return employeeReports;

    } catch (error) {
      console.error('❌ ReportApproval: Error getting employee reports:', error);
      return [];
    }
  }

  /**
   * Create supervisor notification
   */
  private static async createSupervisorNotification(notification: Omit<SupervisorNotification, 'id' | 'createdAt'>): Promise<void> {
    try {
      const fullNotification: SupervisorNotification = {
        id: `supervisor-notif-${Date.now()}`,
        ...notification,
        createdAt: new Date()
      };

      await DatabaseService.createSupervisorNotification(fullNotification);
    } catch (error) {
      console.error('❌ ReportApproval: Error creating supervisor notification:', error);
    }
  }

  /**
   * Create staff notification
   */
  private static async createStaffNotification(notification: Omit<StaffNotification, 'id' | 'createdAt'>): Promise<void> {
    try {
      const fullNotification: StaffNotification = {
        id: `staff-notif-${Date.now()}`,
        ...notification,
        createdAt: new Date()
      };

      await DatabaseService.createStaffNotification(fullNotification);
    } catch (error) {
      console.error('❌ ReportApproval: Error creating staff notification:', error);
    }
  }

  /**
   * Get supervisor notifications
   */
  static async getSupervisorNotifications(supervisorId: string): Promise<SupervisorNotification[]> {
    try {
      const notifications = await DatabaseService.getSupervisorNotifications(supervisorId);
      return notifications.sort((a: SupervisorNotification, b: SupervisorNotification) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('❌ ReportApproval: Error getting supervisor notifications:', error);
      return [];
    }
  }

  /**
   * Get staff notifications
   */
  static async getStaffNotifications(employeeId: string): Promise<StaffNotification[]> {
    try {
      const notifications = await DatabaseService.getStaffNotifications(employeeId);
      return notifications.sort((a: StaffNotification, b: StaffNotification) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('❌ ReportApproval: Error getting staff notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationAsRead(notificationId: string, type: 'supervisor' | 'staff'): Promise<void> {
    try {
      if (type === 'supervisor') {
        await DatabaseService.markSupervisorNotificationAsRead(notificationId);
      } else {
        await DatabaseService.markStaffNotificationAsRead(notificationId);
      }
    } catch (error) {
      console.error('❌ ReportApproval: Error marking notification as read:', error);
    }
  }

  /**
   * Send message to staff member
   */
  static async sendMessageToStaff(
    employeeId: string,
    supervisorId: string,
    supervisorName: string,
    message: string
  ): Promise<void> {
    try {
      console.log('💬 ReportApproval: Sending message to staff:', { employeeId, supervisorId });

      await this.createStaffNotification({
        type: 'supervisor_message',
        employeeId,
        supervisorId,
        supervisorName,
        message,
        isRead: false
      });

      console.log('💬 ReportApproval: Message sent successfully');
    } catch (error) {
      console.error('❌ ReportApproval: Error sending message:', error);
      throw error;
    }
  }

  /**
   * Get report approval history
   */
  static async getReportApprovalHistory(reportId: string): Promise<ReportApproval[]> {
    try {
      const approvals = await DatabaseService.getReportApprovals(reportId);
      return approvals.sort((a: ReportApproval, b: ReportApproval) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('❌ ReportApproval: Error getting approval history:', error);
      return [];
    }
  }
}

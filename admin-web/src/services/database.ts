// Database Service - Mock database operations for web portal
export class DatabaseService {
  // Mock data storage
  private static reportStatuses: any[] = [];
  private static reportApprovals: any[] = [];
  private static supervisorNotifications: any[] = [];
  private static staffNotifications: any[] = [];

  // Report Status operations
  static async getReportStatuses(): Promise<any[]> {
    return this.reportStatuses;
  }

  static async getReportStatus(reportId: string): Promise<any | null> {
    return this.reportStatuses.find(rs => rs.reportId === reportId) || null;
  }

  static async createReportStatus(data: any): Promise<any> {
    const reportStatus = {
      id: `rs_${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.reportStatuses.push(reportStatus);
    return reportStatus;
  }

  static async updateReportStatus(id: string, data: any): Promise<any> {
    const index = this.reportStatuses.findIndex(rs => rs.id === id);
    if (index !== -1) {
      this.reportStatuses[index] = {
        ...this.reportStatuses[index],
        ...data,
        updatedAt: new Date()
      };
      return this.reportStatuses[index];
    }
    throw new Error('Report status not found');
  }

  static async updateReportStatusByReportId(reportId: string, data: any): Promise<any> {
    const index = this.reportStatuses.findIndex(rs => rs.reportId === reportId);
    if (index !== -1) {
      this.reportStatuses[index] = {
        ...this.reportStatuses[index],
        ...data,
        updatedAt: new Date()
      };
      return this.reportStatuses[index];
    }
    throw new Error('Report status not found');
  }

  // Report Approval operations
  static async getReportApprovals(reportId: string): Promise<any[]> {
    return this.reportApprovals.filter(ra => ra.reportId === reportId);
  }

  static async createReportApproval(data: any): Promise<any> {
    const approval = {
      id: `ra_${Date.now()}`,
      ...data,
      timestamp: new Date()
    };
    this.reportApprovals.push(approval);
    return approval;
  }

  // Supervisor Notification operations
  static async getSupervisorNotifications(supervisorId: string): Promise<any[]> {
    return this.supervisorNotifications.filter(n => n.supervisorId === supervisorId);
  }

  static async createSupervisorNotification(data: any): Promise<any> {
    const notification = {
      id: `sn_${Date.now()}`,
      ...data,
      createdAt: new Date()
    };
    this.supervisorNotifications.push(notification);
    return notification;
  }

  static async updateSupervisorNotification(id: string, data: any): Promise<any> {
    const index = this.supervisorNotifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.supervisorNotifications[index] = {
        ...this.supervisorNotifications[index],
        ...data
      };
      return this.supervisorNotifications[index];
    }
    throw new Error('Supervisor notification not found');
  }

  // Staff Notification operations
  static async getStaffNotifications(employeeId: string): Promise<any[]> {
    return this.staffNotifications.filter(n => n.employeeId === employeeId);
  }

  static async createStaffNotification(data: any): Promise<any> {
    const notification = {
      id: `stn_${Date.now()}`,
      ...data,
      createdAt: new Date()
    };
    this.staffNotifications.push(notification);
    return notification;
  }

  static async updateStaffNotification(id: string, data: any): Promise<any> {
    const index = this.staffNotifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.staffNotifications[index] = {
        ...this.staffNotifications[index],
        ...data
      };
      return this.staffNotifications[index];
    }
    throw new Error('Staff notification not found');
  }

  static async markSupervisorNotificationAsRead(notificationId: string): Promise<void> {
    const index = this.supervisorNotifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      this.supervisorNotifications[index].isRead = true;
    }
  }

  static async markStaffNotificationAsRead(notificationId: string): Promise<void> {
    const index = this.staffNotifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      this.staffNotifications[index].isRead = true;
    }
  }

  // Utility methods
  static async clearAllData(): Promise<void> {
    this.reportStatuses = [];
    this.reportApprovals = [];
    this.supervisorNotifications = [];
    this.staffNotifications = [];
  }
}

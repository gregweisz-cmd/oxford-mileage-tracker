import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MonthlyReport, MileageEntry, Employee } from '../types';

export interface SlackConfig {
  webhookUrl: string;
  channel: string;
  botToken?: string;
}

export class SlackService {
  private static config: SlackConfig | null = null;

  static setConfig(config: SlackConfig): void {
    this.config = config;
  }

  static getConfig(): SlackConfig | null {
    return this.config;
  }

  static async exportMonthlyReportToSlack(
    report: MonthlyReport,
    entries: MileageEntry[],
    employee: Employee
  ): Promise<boolean> {
    if (!this.config) {
      throw new Error('Slack configuration not set');
    }

    try {
      // Generate CSV content
      const csvContent = this.generateCSVContent(report, entries, employee);
      
      // Create temporary file
      const fileName = `oh-staff-mileage-${employee.name.replace(/\s+/g, '-')}-${report.year}-${report.month.toString().padStart(2, '0')}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Prepare Slack message
      const message = this.generateSlackMessage(report, employee);
      
      // Upload file to Slack
      const formData = new FormData();
      formData.append('token', this.config.botToken || '');
      formData.append('channels', this.config.channel);
      formData.append('initial_comment', message);
      formData.append('file', {
        uri: fileUri,
        type: 'text/csv',
        name: fileName,
      } as any);

      const response = await fetch('https://slack.com/api/files.upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const result = await response.json();
      
      // Clean up temporary file
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
      
      return result.ok;
    } catch (error) {
      console.error('Error exporting to Slack:', error);
      return false;
    }
  }

  static async shareReportLocally(
    report: MonthlyReport,
    entries: MileageEntry[],
    employee: Employee
  ): Promise<void> {
    try {
      // Generate CSV content
      const csvContent = this.generateCSVContent(report, entries, employee);
      
      // Create file
      const fileName = `oh-staff-mileage-${employee.name.replace(/\s+/g, '-')}-${report.year}-${report.month.toString().padStart(2, '0')}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `OH Staff Tracker Mileage Report - ${employee.name}`,
        });
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      throw error;
    }
  }

  private static generateCSVContent(
    report: MonthlyReport,
    entries: MileageEntry[],
    employee: Employee
  ): string {
    const headers = [
      'Date',
      'Start Location',
      'End Location',
      'Purpose',
      'Miles',
      'Notes'
    ];

    const csvRows = [headers.join(',')];

    entries.forEach(entry => {
      const row = [
        entry.date.toLocaleDateString(),
        `"${entry.startLocation}"`,
        `"${entry.endLocation}"`,
        `"${entry.purpose}"`,
        entry.miles.toString(),
        `"${entry.notes || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    // Add summary row
    csvRows.push('');
    csvRows.push('SUMMARY');
    csvRows.push(`Employee,${employee.name}`);
    csvRows.push(`Month,${report.month}/${report.year}`);
    csvRows.push(`Total Miles,${report.totalMiles}`);
    csvRows.push(`Total Entries,${entries.length}`);

    return csvRows.join('\n');
  }

  private static generateSlackMessage(report: MonthlyReport, employee: Employee): string {
    const monthName = new Date(report.year, report.month - 1).toLocaleString('default', { month: 'long' });
    
    return `📊 *OH Staff Tracker Mileage Report*\n` +
           `👤 Employee: ${employee.name}\n` +
           `📅 Period: ${monthName} ${report.year}\n` +
           `🛣️ Total Miles: ${report.totalMiles}\n` +
           `📋 Status: ${report.status.toUpperCase()}\n\n` +
           `Please find the detailed CSV report attached.`;
  }

  static async testSlackConnection(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.botToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      return result.ok;
    } catch (error) {
      console.error('Error testing Slack connection:', error);
      return false;
    }
  }
}

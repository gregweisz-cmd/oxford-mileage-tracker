import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Receipt, Employee } from '../types';

export class PdfService {
  static async generateMonthlyReceiptsPdf(
    receipts: Receipt[],
    employee: Employee,
    month: number,
    year: number
  ): Promise<string> {
    try {
      console.log('Starting PDF generation...');
      console.log('Receipts count:', receipts.length);
      console.log('Employee:', employee.name);
      
      // Validate inputs
      if (!receipts || receipts.length === 0) {
        throw new Error('No receipts provided for PDF generation');
      }
      
      if (!employee || !employee.name) {
        throw new Error('Invalid employee data provided');
      }
      
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      
      // Calculate totals
      const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
      const categoryTotals = receipts.reduce((totals, receipt) => {
        totals[receipt.category] = (totals[receipt.category] || 0) + receipt.amount;
        return totals;
      }, {} as Record<string, number>);
      
      console.log('Calculated totals:', { totalAmount, categoryTotals });

    // Generate HTML content
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Oxford House Receipts - ${monthName} ${year}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #2196F3;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #2196F3;
              margin: 0;
              font-size: 24px;
            }
            .header h2 {
              color: #666;
              margin: 5px 0 0 0;
              font-size: 18px;
              font-weight: normal;
            }
            .employee-info {
              background-color: #f5f5f5;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .summary {
              background-color: #e3f2fd;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .summary h3 {
              margin: 0 0 10px 0;
              color: #2196F3;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .summary-item {
              text-align: center;
            }
            .summary-value {
              font-size: 24px;
              font-weight: bold;
              color: #2196F3;
            }
            .summary-label {
              font-size: 14px;
              color: #666;
            }
            .receipts-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .receipts-table th,
            .receipts-table td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: left;
            }
            .receipts-table th {
              background-color: #2196F3;
              color: white;
              font-weight: bold;
            }
            .receipts-table tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .amount {
              text-align: right;
              font-weight: bold;
            }
            .category {
              background-color: #e8f5e8;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 12px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
            .base-address {
              background-color: #fff3e0;
              padding: 10px;
              border-radius: 4px;
              margin: 10px 0;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>OH Staff Tracker Receipts Report</h1>
            <h2>${monthName} ${year}</h2>
          </div>

          <div class="employee-info">
            <strong>Employee:</strong> ${employee.name}<br>
            <strong>Position:</strong> ${employee.position}<br>
            <strong>Email:</strong> ${employee.email}<br>
            <strong>Phone:</strong> ${employee.phoneNumber || 'N/A'}
          </div>

          <div class="base-address">
            <strong>Base Address (BA):</strong> ${employee.baseAddress}
          </div>

          <div class="summary">
            <h3>Monthly Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-value">$${totalAmount.toFixed(2)}</div>
                <div class="summary-label">Total Amount</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${receipts.length}</div>
                <div class="summary-label">Total Receipts</div>
              </div>
            </div>
          </div>

          ${Object.keys(categoryTotals).length > 0 ? `
            <div class="summary">
              <h3>Category Breakdown</h3>
              ${Object.entries(categoryTotals).map(([category, amount]) => `
                <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                  <span>${category}:</span>
                  <span><strong>$${amount.toFixed(2)}</strong></span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <table class="receipts-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vendor</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${receipts.map(receipt => `
                <tr>
                  <td>${receipt.date.toLocaleDateString()}</td>
                  <td>${receipt.vendor}</td>
                  <td>${receipt.description}</td>
                  <td><span class="category">${receipt.category}</span></td>
                  <td class="amount">$${receipt.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p>OH Staff Tracker</p>
          </div>
        </body>
      </html>
    `;

      console.log('Generating PDF with HTML content...');
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html });
      console.log('PDF generated at:', uri);
      
      // Move to documents directory with proper name
      const fileName = `oh-staff-receipts-${employee.name.replace(/\s+/g, '-')}-${year}-${month.toString().padStart(2, '0')}.pdf`;
      const newUri = FileSystem.documentDirectory + fileName;
      
      console.log('Moving PDF to:', newUri);
      
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });

      console.log('PDF generation completed successfully');
      return newUri;
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('printToFileAsync')) {
          throw new Error('Failed to generate PDF file. Please check if the device supports PDF generation.');
        } else if (error.message.includes('moveAsync')) {
          throw new Error('Failed to save PDF file. Please check file system permissions.');
        } else {
          throw new Error(`PDF generation failed: ${error.message}`);
        }
      }
      
      throw new Error('Unknown error occurred during PDF generation');
    }
  }

  static async shareReceiptsPdf(pdfUri: string, employee: Employee, month: number, year: number): Promise<void> {
    try {
      console.log('Sharing PDF:', pdfUri);
      
      if (await Sharing.isAvailableAsync()) {
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `OH Staff Tracker Receipts - ${employee.name} - ${monthName} ${year}`,
        });
        console.log('PDF shared successfully');
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      throw error;
    }
  }

  /**
   * Test PDF generation with minimal data
   */
  static async testPdfGeneration(): Promise<boolean> {
    try {
      console.log('Testing PDF generation...');
      
      const testHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Test PDF</title>
          </head>
          <body>
            <h1>Test PDF Generation</h1>
            <p>This is a test to verify PDF generation is working.</p>
            <p>Generated at: ${new Date().toLocaleString()}</p>
          </body>
        </html>
      `;
      
      const { uri } = await Print.printToFileAsync({ html: testHtml });
      console.log('Test PDF generated successfully at:', uri);
      
      return true;
    } catch (error) {
      console.error('Test PDF generation failed:', error);
      return false;
    }
  }
}

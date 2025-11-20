/**
 * Cost Center Import Service
 * Imports cost centers from Google Sheets and updates the database
 */

import { debugLog, debugError, debugWarn } from '../config/debug';

export class CostCenterImportService {
  private static readonly SHEET_ID = '1WByevxN6vlHQtWuDm8s3wxY72pYn-cn7aqeaCjQSxlk';
  private static readonly COST_CENTER_COLUMN = 'C';

  /**
   * Import cost centers from Google Sheet
   */
  static async importCostCenters(): Promise<string[]> {
    try {
      debugLog('📊 CostCenterImport: Starting cost center import from Google Sheet...');
      
      // Get data from Google Sheet
      const costCenters = await this.fetchCostCentersFromSheet();
      
      if (costCenters.length === 0) {
        debugLog('⚠️ CostCenterImport: No cost centers found in sheet');
        return [];
      }

      // Sort alphabetically
      const sortedCostCenters = costCenters.sort((a, b) => a.localeCompare(b));
      
      debugLog('✅ CostCenterImport: Successfully imported cost centers:', sortedCostCenters);
      
      return sortedCostCenters;
    } catch (error) {
      console.error('❌ CostCenterImport: Error importing cost centers:', error);
      throw error;
    }
  }

  /**
   * Fetch cost centers from Google Sheet
   */
  private static async fetchCostCentersFromSheet(): Promise<string[]> {
    try {
      // Use the public CSV export URL for the Google Sheet
      const csvUrl = `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=0`;
      
      debugLog('📊 CostCenterImport: Fetching data from:', csvUrl);
      
      const response = await fetch(csvUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sheet data: ${response.status} ${response.statusText}`);
      }
      
      const csvText = await response.text();
      debugLog('📊 CostCenterImport: Raw CSV data received, length:', csvText.length);
      
      // Parse CSV and extract column C
      const costCenters = this.parseCostCentersFromCSV(csvText);
      
      return costCenters;
    } catch (error) {
      console.error('❌ CostCenterImport: Error fetching from Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Parse cost centers from CSV text
   */
  private static parseCostCentersFromCSV(csvText: string): string[] {
    try {
      const lines = csvText.split('\n');
      const costCenters: string[] = [];
      
      // Find the index of column C (index 2)
      const columnIndex = 2; // Column C is index 2 (0-based)
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse CSV line (handle quoted values)
        const columns = this.parseCSVLine(line);
        
        if (columns.length > columnIndex) {
          const costCenter = columns[columnIndex].trim();
          
          // Skip empty values and header row
          if (costCenter && 
              costCenter.toLowerCase() !== 'cost center' && 
              costCenter.toLowerCase() !== 'cost centers' &&
              !costCenters.includes(costCenter)) {
            costCenters.push(costCenter);
          }
        }
      }
      
      debugLog('📊 CostCenterImport: Parsed cost centers:', costCenters);
      return costCenters;
    } catch (error) {
      console.error('❌ CostCenterImport: Error parsing CSV:', error);
      throw error;
    }
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  private static parseCSVLine(line: string): string[] {
    const columns: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        columns.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last column
    columns.push(current);
    
    return columns;
  }

  /**
   * Update all employees with the imported cost centers
   */
  static async updateEmployeesWithCostCenters(costCenters: string[]): Promise<void> {
    try {
      debugLog('📊 CostCenterImport: Updating employees with cost centers...');
      
      const { DatabaseService } = await import('./database');
      const employees = await DatabaseService.getEmployees();
      
      for (const employee of employees) {
        // Update employee with new cost centers list
        await DatabaseService.updateEmployee(employee.id, {
          costCenters: costCenters
        });
        
        debugLog(`✅ CostCenterImport: Updated employee ${employee.name} with ${costCenters.length} cost centers`);
      }
      
      debugLog('✅ CostCenterImport: Successfully updated all employees with cost centers');
    } catch (error) {
      console.error('❌ CostCenterImport: Error updating employees:', error);
      throw error;
    }
  }

  /**
   * Get cost centers from Google Sheet and update database
   */
  static async importAndUpdateCostCenters(): Promise<string[]> {
    try {
      debugLog('📊 CostCenterImport: Starting full import and update process...');
      
      // Import cost centers from Google Sheet
      const costCenters = await this.importCostCenters();
      
      if (costCenters.length === 0) {
        debugLog('⚠️ CostCenterImport: No cost centers to update');
        return [];
      }
      
      // Update all employees with the new cost centers
      await this.updateEmployeesWithCostCenters(costCenters);
      
      debugLog('✅ CostCenterImport: Full import and update process completed');
      return costCenters;
    } catch (error) {
      console.error('❌ CostCenterImport: Error in full import process:', error);
      throw error;
    }
  }
}

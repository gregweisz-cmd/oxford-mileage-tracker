import * as DocumentPicker from 'expo-document-picker';
import { OxfordHouse } from '../types';
import { DatabaseService } from './database';

export interface OxfordHouseImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  duplicates: number;
}

export class OxfordHouseImportService {
  /**
   * Pick a CSV file for Oxford House import
   */
  static async pickCsvFile(): Promise<DocumentPicker.DocumentPickerResult | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return null;
      }

      return result;
    } catch (error) {
      console.error('Error picking CSV file:', error);
      throw error;
    }
  }

  /**
   * Parse CSV content and extract Oxford House data
   */
  static parseCsvContent(csvContent: string): Partial<OxfordHouse>[] {
    const lines = csvContent.split('\n');
    const houses: Partial<OxfordHouse>[] = [];

    // Skip header row if it exists
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
      if (line.trim()) {
        const columns = this.parseCsvLine(line);
        
        if (columns.length >= 5) {
          const house: Partial<OxfordHouse> = {
            name: columns[0]?.trim() || '',
            address: columns[1]?.trim() || '',
            city: columns[2]?.trim() || '',
            state: columns[3]?.trim() || '',
            zipCode: columns[4]?.trim() || '',
            phoneNumber: columns[5]?.trim() || undefined,
          };

          // Only add if we have the required fields
          if (house.name && house.address && house.city && house.state && house.zipCode) {
            houses.push(house);
          }
        }
      }
    }

    return houses;
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  private static parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    result.push(current);

    return result;
  }

  /**
   * Import Oxford Houses from CSV file
   */
  static async importFromCsv(csvContent: string): Promise<OxfordHouseImportResult> {
    const result: OxfordHouseImportResult = {
      success: true,
      imported: 0,
      errors: [],
      duplicates: 0,
    };

    try {
      // Parse CSV content
      const housesData = this.parseCsvContent(csvContent);

      if (housesData.length === 0) {
        result.errors.push('No valid Oxford House data found in CSV file');
        result.success = false;
        return result;
      }

      // Get existing houses to check for duplicates
      const existingHouses = await DatabaseService.getOxfordHouses();
      const existingNames = new Set(existingHouses.map(h => h.name.toLowerCase()));

      // Import each house
      for (const houseData of housesData) {
        try {
          // Check for duplicates
          if (existingNames.has(houseData.name!.toLowerCase())) {
            result.duplicates++;
            continue;
          }

          // Create the house
          await DatabaseService.createOxfordHouse(houseData as Omit<OxfordHouse, 'id' | 'createdAt' | 'updatedAt'>);
          result.imported++;
        } catch (error) {
          result.errors.push(`Failed to import "${houseData.name}": ${error}`);
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Import failed: ${error}`);
    }

    return result;
  }

  /**
   * Import Oxford Houses from a picked file
   */
  static async importFromFile(): Promise<OxfordHouseImportResult> {
    try {
      // Pick CSV file
      const fileResult = await this.pickCsvFile();
      
      if (!fileResult) {
        return {
          success: false,
          imported: 0,
          errors: ['No file selected'],
          duplicates: 0,
        };
      }

      // Read file content
      const response = await fetch(fileResult.assets[0].uri);
      const csvContent = await response.text();

      // Import the data
      return await this.importFromCsv(csvContent);

    } catch (error) {
      return {
        success: false,
        imported: 0,
        errors: [`Import failed: ${error}`],
        duplicates: 0,
      };
    }
  }

  /**
   * Generate a sample CSV template
   */
  static generateSampleCsv(): string {
    return `Name,Address,City,State,ZipCode,PhoneNumber
Oxford House Charlotte,123 Main Street,Charlotte,NC,28202,(704) 555-0101
Oxford House Raleigh,456 Oak Avenue,Raleigh,NC,27601,(919) 555-0102
Oxford House Durham,789 Pine Street,Durham,NC,27701,(919) 555-0103
Oxford House Greensboro,321 Elm Street,Greensboro,NC,27401,(336) 555-0104
Oxford House Winston-Salem,654 Maple Drive,Winston-Salem,NC,27101,(336) 555-0105`;
  }

  /**
   * Validate CSV format
   */
  static validateCsvFormat(csvContent: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!csvContent.trim()) {
      errors.push('CSV file is empty');
      return { valid: false, errors };
    }

    const lines = csvContent.split('\n');
    
    if (lines.length < 2) {
      errors.push('CSV file must have at least a header row and one data row');
      return { valid: false, errors };
    }

    // Check header
    const header = lines[0].toLowerCase();
    const requiredColumns = ['name', 'address', 'city', 'state', 'zipcode'];
    
    for (const column of requiredColumns) {
      if (!header.includes(column)) {
        errors.push(`Missing required column: ${column}`);
      }
    }

    // Check data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const columns = this.parseCsvLine(line);
        if (columns.length < 5) {
          errors.push(`Row ${i + 1}: Insufficient columns (expected at least 5)`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}



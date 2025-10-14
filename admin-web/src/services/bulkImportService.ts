import { Employee } from '../types';

export interface BulkImportResult {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: number;
  errors: string[];
  createdEmployees: Employee[];
}

export interface EmployeeImportData {
  EMPLOYEE_ID: string;
  FULL_NAME: string;
  WORK_EMAIL: string;
  EMPLOYEE_TITLE: string;
  PHONE: string;
  COST_CENTER: string;
  ROLE_LEVEL?: string;
  SUPERVISOR_EMAIL?: string; // Email of the supervisor this employee reports to
}

export class BulkImportService {
  /**
   * Parse CSV data and convert to employee import format
   */
  static parseCSVData(csvText: string): EmployeeImportData[] {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const employees: EmployeeImportData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length >= 6) {
        employees.push({
          EMPLOYEE_ID: values[0] || '',
          FULL_NAME: values[1] || '',
          WORK_EMAIL: values[2] || '',
          EMPLOYEE_TITLE: values[3] || '',
          PHONE: values[4] || '',
          COST_CENTER: values[5] || '',
          ROLE_LEVEL: values[6] || '',
          SUPERVISOR_EMAIL: values[7] || ''
        });
      }
    }
    
    return employees;
  }

  /**
   * Generate password based on employee name
   */
  static generatePassword(fullName: string): string {
    const firstName = fullName.split(' ')[0];
    return `${firstName}welcome1`;
  }

  /**
   * Parse cost centers from the COST_CENTER field
   */
  static parseCostCenters(costCenterStr: string): string[] {
    if (!costCenterStr) return ['Program Services'];
    
    // Handle different formats like "IL / MN / WI" or "NC.F-SOR" or "Program Services"
    const centers = costCenterStr
      .split(/[\/,]/)
      .map(center => center.trim())
      .filter(center => center.length > 0)
      .map(center => {
        // Convert common formats to standard cost center codes
        if (center.includes('Program Services')) return 'Program Services';
        if (center.includes('Finance')) return 'Finance';
        if (center.includes('G&A')) return 'G&A';
        if (center.includes('Fundraising')) return 'Fundraising';
        
        // Handle state codes like "IL" -> "IL-STATE"
        if (center.match(/^[A-Z]{2}$/)) return `${center}-STATE`;
        
        // Handle complex codes like "NC.F-SOR" -> keep as is
        return center;
      });
    
    return centers.length > 0 ? centers : ['Program Services'];
  }

  /**
   * Convert import data to employee format
   */
  static convertToEmployee(importData: EmployeeImportData, existingEmployees: Employee[] = []): Omit<Employee, 'id' | 'createdAt' | 'updatedAt'> {
    const costCenters = this.parseCostCenters(importData.COST_CENTER);
    
    // Resolve supervisor email to supervisor ID
    let supervisorId: string | undefined;
    if (importData.SUPERVISOR_EMAIL) {
      const supervisor = existingEmployees.find(emp => emp.email === importData.SUPERVISOR_EMAIL);
      supervisorId = supervisor?.id;
    }
    
    return {
      name: importData.FULL_NAME,
      email: importData.WORK_EMAIL,
      password: this.generatePassword(importData.FULL_NAME),
      oxfordHouseId: importData.EMPLOYEE_ID,
      position: importData.EMPLOYEE_TITLE,
      phoneNumber: importData.PHONE,
      baseAddress: 'To be updated', // Default address that can be updated later
      costCenters: costCenters,
      selectedCostCenters: costCenters,
      defaultCostCenter: costCenters[0] || 'Program Services',
      supervisorId: supervisorId
    } as Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;
  }

  /**
   * Validate employee data
   */
  static validateEmployeeData(employeeData: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): string[] {
    const errors: string[] = [];
    
    if (!employeeData.name || employeeData.name.trim().length === 0) {
      errors.push('Name is required');
    }
    
    if (!employeeData.email || !employeeData.email.includes('@')) {
      errors.push('Valid email is required');
    }
    
    if (!(employeeData as any).password || (employeeData as any).password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }
    
    if (!(employeeData as any).oxfordHouseId || (employeeData as any).oxfordHouseId.trim().length === 0) {
      errors.push('Employee ID is required');
    }
    
    if (!employeeData.costCenters || employeeData.costCenters.length === 0) {
      errors.push('At least one cost center is required');
    }
    
    return errors;
  }

  /**
   * Process bulk import of employees
   */
  static async processBulkImport(
    csvText: string,
    createEmployeeFn: (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Employee>
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      success: false,
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      createdEmployees: []
    };

    try {
      // Parse CSV data
      const importData = this.parseCSVData(csvText);
      result.totalProcessed = importData.length;

      // Process each employee
      for (const data of importData) {
        try {
          // Convert to employee format
          const employeeData = this.convertToEmployee(data);
          
          // Validate data
          const validationErrors = this.validateEmployeeData(employeeData);
          if (validationErrors.length > 0) {
            result.failed++;
            result.errors.push(`${data.FULL_NAME}: ${validationErrors.join(', ')}`);
            continue;
          }

          // Create employee
          const createdEmployee = await createEmployeeFn(employeeData);
          result.createdEmployees.push(createdEmployee);
          result.successful++;
          
        } catch (error) {
          result.failed++;
          result.errors.push(`${data.FULL_NAME}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      result.success = result.failed === 0;
      
    } catch (error) {
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Generate CSV template for employee import
   */
  static generateCSVTemplate(): string {
    return `EMPLOYEE_ID,FULL_NAME,WORK_EMAIL,EMPLOYEE_TITLE,PHONE,COST_CENTER,ROLE_LEVEL,SUPERVISOR_EMAIL
5d60325822954e074a4cf6e1,AJ Dunaway,aj.dunaway@oxfordhouse.org,Regional Manager,17735909830,"IL-STATE, MN-STATE, WI-STATE",supervisor,
653fc7377ffe2633dcb88761,Aaron Torrance,aaron.torrance@oxfordhouse.org,Outreach Worker,14253875050,WA.KING,staff,aj.dunaway@oxfordhouse.org
5cfaed33c5929137a5d1f906,Aaron Vick,aaron.vick@oxfordhouse.org,Senior Outreach Coordinator,14054462751,OK-SUBG,staff,aj.dunaway@oxfordhouse.org`;
  }

  /**
   * Export existing employees to CSV format
   */
  static exportEmployeesToCSV(employees: Employee[]): string {
    const headers = 'EMPLOYEE_ID,FULL_NAME,WORK_EMAIL,EMPLOYEE_TITLE,PHONE,COST_CENTER,ROLE_LEVEL';
    const rows = employees.map(emp => {
      const costCenters = Array.isArray(emp.costCenters) ? emp.costCenters : 
                         (typeof emp.costCenters === 'string' ? JSON.parse(emp.costCenters) : []);
      return `${(emp as any).oxfordHouseId},"${emp.name}","${emp.email}","${(emp as any).position}","${(emp as any).phoneNumber}","${costCenters.join(', ')}",""`;
    });
    
    return [headers, ...rows].join('\n');
  }
}

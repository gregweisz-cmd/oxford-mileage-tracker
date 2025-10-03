import { DatabaseService } from './database';
import { Employee } from '../types';

export class TestDataService {
  static async createTestEmployees(): Promise<Employee[]> {
    const testEmployees: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Greg Weisz',
        email: 'greg.weisz@oxfordhouse.org',
        password: 'iitywim',
        oxfordHouseId: 'test-house-001',
        position: 'Manager',
        phoneNumber: '555-0123',
        baseAddress: '230 Wagner St Troutman, NC 28166',
        costCenters: ['PS-Unfunded']
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@oxfordhouse.org',
        password: 'password123',
        oxfordHouseId: 'test-house-002',
        position: 'Case Manager',
        phoneNumber: '555-0124',
        baseAddress: '123 Main St Charlotte, NC 28201',
        costCenters: ['CC001', 'CC002']
      },
      {
        name: 'Mike Rodriguez',
        email: 'mike.rodriguez@oxfordhouse.org',
        password: 'secure456',
        oxfordHouseId: 'test-house-003',
        position: 'House Manager',
        phoneNumber: '555-0125',
        baseAddress: '456 Oak Ave Raleigh, NC 27601',
        costCenters: ['CC003']
      },
      {
        name: 'Lisa Chen',
        email: 'lisa.chen@oxfordhouse.org',
        password: 'test789',
        oxfordHouseId: 'test-house-004',
        position: 'Administrative Assistant',
        phoneNumber: '555-0126',
        baseAddress: '789 Pine St Asheville, NC 28801',
        costCenters: ['CC001', 'CC004']
      }
    ];

    const createdEmployees: Employee[] = [];
    
    for (const employeeData of testEmployees) {
      try {
        // Check if employee already exists
        const existingEmployees = await DatabaseService.getEmployees();
        const exists = existingEmployees.some(emp => emp.email === employeeData.email);
        
        if (!exists) {
          const employee = await DatabaseService.createEmployee(employeeData);
          createdEmployees.push(employee);
          console.log('✅ Test employee created:', employee.name);
        } else {
          console.log('ℹ️ Test employee already exists:', employeeData.name);
        }
      } catch (error) {
        console.error('❌ Error creating test employee:', employeeData.name, error);
      }
    }

    return createdEmployees;
  }

  static async createTestOxfordHouse(): Promise<void> {
    try {
      await DatabaseService.createOxfordHouse({
        name: 'Test Oxford House',
        address: '123 Test St',
        city: 'Troutman',
        state: 'NC',
        zipCode: '28166',
        phoneNumber: '555-0123',
        managerId: undefined
      });
      console.log('✅ Test Oxford House created');
    } catch (error) {
      console.error('❌ Error creating test Oxford House:', error);
    }
  }

  static async initializeTestData(): Promise<void> {
    try {
      console.log('🚀 Initializing test data...');
      
      // Create test Oxford House first
      await this.createTestOxfordHouse();
      
      // Create test employees
      await this.createTestEmployees();
      
      console.log('✅ Test data initialization complete');
    } catch (error) {
      console.error('❌ Error initializing test data:', error);
      throw error;
    }
  }
}

// Data Sync Service - Handles data synchronization between mobile app and web portal
export class DataSyncService {
  private static readonly API_BASE_URL = 'http://localhost:3002/api';
  // Mock data for demonstration
  private static mockEmployees = [
    {
      id: 'emp1',
      name: 'John Doe',
      email: 'john.doe@company.com',
      position: 'Field Staff',
      phoneNumber: '555-0101',
      baseAddress: '123 Main St, City, State 12345',
      baseAddress2: '',
      costCenters: ['CC001'],
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'emp2', 
      name: 'Jane Smith',
      email: 'jane.smith@company.com',
      position: 'Supervisor',
      phoneNumber: '555-0102',
      baseAddress: '456 Oak Ave, City, State 12345',
      baseAddress2: '',
      costCenters: ['CC002'],
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'emp3',
      name: 'Greg Weisz',
      email: 'greg.weisz@company.com',
      position: 'Field Staff',
      phoneNumber: '555-0103',
      baseAddress: '789 Pine St, City, State 12345',
      baseAddress2: '',
      costCenters: ['CC001'],
      createdAt: '2024-01-01T00:00:00Z'
    }
  ];

  private static mockMileageEntries = [
    {
      id: 'mile1',
      employeeId: 'emp1',
      date: '2024-01-15',
      startLocation: 'Office',
      endLocation: 'Client Site A',
      purpose: 'Client Visit',
      miles: 25.5,
      hoursWorked: 2.5
    },
    {
      id: 'mile2',
      employeeId: 'emp1',
      date: '2024-01-16',
      startLocation: 'Client Site A',
      endLocation: 'Office',
      purpose: 'Return from Client Visit',
      miles: 25.5,
      hoursWorked: 2.5
    }
  ];

  private static mockReceipts = [
    {
      id: 'receipt1',
      employeeId: 'emp1',
      date: '2024-01-15',
      vendor: 'Gas Station',
      description: 'Fuel',
      category: 'Vehicle',
      amount: 45.50
    }
  ];

  private static mockTimeTracking = [
    {
      id: 'time1',
      employeeId: 'emp1',
      date: '2024-01-15',
      category: 'G&A Hours',
      hours: 8.0,
      description: 'Regular work hours'
    }
  ];

  static async getEmployees() {
    try {
      const response = await fetch(`${this.API_BASE_URL}/employees`);
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.warn('Failed to fetch employees from backend, using mock data');
        return this.mockEmployees;
      }
    } catch (error) {
      console.warn('Error fetching employees from backend, using mock data:', error);
      return this.mockEmployees;
    }
  }

  static async getMileageEntries() {
    try {
      const response = await fetch(`${this.API_BASE_URL}/mileage-entries`);
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.warn('Failed to fetch mileage entries from backend, using mock data');
        return this.mockMileageEntries;
      }
    } catch (error) {
      console.warn('Error fetching mileage entries from backend, using mock data:', error);
      return this.mockMileageEntries;
    }
  }

  static async getReceipts() {
    try {
      const response = await fetch(`${this.API_BASE_URL}/receipts`);
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.warn('Failed to fetch receipts from backend, using mock data');
        return this.mockReceipts;
      }
    } catch (error) {
      console.warn('Error fetching receipts from backend, using mock data:', error);
      return this.mockReceipts;
    }
  }

  static async getTimeTracking() {
    try {
      const response = await fetch(`${this.API_BASE_URL}/time-tracking`);
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.warn('Failed to fetch time tracking from backend, using mock data');
        return this.mockTimeTracking;
      }
    } catch (error) {
      console.warn('Error fetching time tracking from backend, using mock data:', error);
      return this.mockTimeTracking;
    }
  }

  static async exportData() {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          employees: this.mockEmployees,
          mileageEntries: this.mockMileageEntries,
          receipts: this.mockReceipts,
          timeTracking: this.mockTimeTracking,
          exportDate: new Date().toISOString()
        });
      }, 100);
    });
  }

  static async importData(data: any) {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        if (data.employees) {
          this.mockEmployees = data.employees;
        }
        if (data.mileageEntries) {
          this.mockMileageEntries = data.mileageEntries;
        }
        if (data.receipts) {
          this.mockReceipts = data.receipts;
        }
        if (data.timeTracking) {
          this.mockTimeTracking = data.timeTracking;
        }
        resolve(true);
      }, 100);
    });
  }
}

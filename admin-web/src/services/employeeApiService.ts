import { Employee } from '../types';

export interface BulkUpdateRequest {
  employeeIds: string[];
  updates: Partial<Employee>;
}

export interface BulkDeleteRequest {
  employeeIds: string[];
}

export interface BulkCreateRequest {
  employees: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>[];
}

export interface BulkOperationResult {
  success: boolean;
  updatedCount?: number;
  deletedCount?: number;
  totalProcessed?: number;
  successful?: number;
  failed?: number;
  errors?: string[];
  createdEmployees?: Employee[];
  message?: string;
}

export class EmployeeApiService {
  private static baseUrl = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api`
    : 'http://localhost:3002/api';

  static async getAllEmployees(skipCache: boolean = false): Promise<Employee[]> {
    const url = skipCache 
      ? `${this.baseUrl}/employees?_t=${Date.now()}` 
      : `${this.baseUrl}/employees`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch employees');
    }
    return response.json();
  }

  static async createEmployee(employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const response = await fetch(`${this.baseUrl}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(employee),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to create employee');
    }

    return response.json();
  }

  static async updateEmployee(id: string, employee: Partial<Employee>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/employees/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(employee),
      credentials: 'include'
    });

    if (!response.ok) {
      let errorMessage = 'Failed to update employee';
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = `Failed to update employee: ${errorData.error}`;
          if (errorData.details) {
            errorMessage += ` (${errorData.details})`;
          }
        }
      } catch (e) {
        // If we can't parse the error response, use the default message
      }
      throw new Error(errorMessage);
    }
  }

  static async deleteEmployee(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/employees/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to delete employee');
    }
  }

  static async bulkUpdateEmployees(request: BulkUpdateRequest): Promise<BulkOperationResult> {
    const response = await fetch(`${this.baseUrl}/employees/bulk-update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to bulk update employees');
    }

    return response.json();
  }

  static async bulkDeleteEmployees(request: BulkDeleteRequest): Promise<BulkOperationResult> {
    const response = await fetch(`${this.baseUrl}/employees/bulk-delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to bulk delete employees');
    }

    return response.json();
  }

  static async bulkCreateEmployees(request: BulkCreateRequest): Promise<BulkOperationResult> {
    const response = await fetch(`${this.baseUrl}/employees/bulk-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to bulk create employees');
    }

    return response.json();
  }
}

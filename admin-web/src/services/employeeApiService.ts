import { Employee } from '../types';
import { debugLog, debugError } from '../config/debug';
import { apiGet, apiPost, apiPut, apiDelete } from './rateLimitedApi';

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
      ? `/api/employees?_t=${Date.now()}` 
      : `/api/employees`;
    return apiGet<Employee[]>(url);
  }

  static async createEmployee(employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    return apiPost<Employee>('/api/employees', employee);
  }

  static async updateEmployee(id: string, employee: Partial<Employee>): Promise<void> {
    try {
      await apiPut(`/api/employees/${id}`, employee);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update employee';
      throw new Error(errorMessage);
    }
  }

  static async deleteEmployee(id: string): Promise<void> {
    await apiDelete(`/api/employees/${id}`);
  }

  static async bulkUpdateEmployees(request: BulkUpdateRequest): Promise<BulkOperationResult> {
    return apiPut<BulkOperationResult>('/api/employees/bulk-update', request);
  }

  static async bulkDeleteEmployees(request: BulkDeleteRequest): Promise<BulkOperationResult> {
    const { apiFetch } = await import('./rateLimitedApi');
    const response = await apiFetch('/api/employees/bulk-delete', {
      method: 'DELETE',
      body: JSON.stringify(request),
    });
    return response.json();
  }

  static async bulkCreateEmployees(request: BulkCreateRequest): Promise<BulkOperationResult> {
    return apiPost<BulkOperationResult>('/api/employees/bulk-create', request);
  }

  static async resetEmployeePassword(id: string, password: string): Promise<void> {
    await apiPut(`/api/employees/${id}/password`, { password });
  }

  static async archiveEmployee(id: string): Promise<void> {
    try {
      await apiPost(`/api/employees/${id}/archive`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to archive employee';
      throw new Error(errorMessage);
    }
  }

  static async restoreEmployee(id: string): Promise<void> {
    try {
      await apiPost(`/api/employees/${id}/restore`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore employee';
      throw new Error(errorMessage);
    }
  }

  static async getArchivedEmployees(): Promise<Employee[]> {
    debugLog('🌐 API: Fetching archived employees');
    
    try {
      const data = await apiGet<Employee[]>('/api/employees/archived');
      debugLog('🌐 API: Received archived employees:', Array.isArray(data) ? `${data.length} employees` : 'Invalid data format', data);
      return data;
    } catch (error) {
      debugError('❌ API: Error fetching archived employees:', error);
      throw error;
    }
  }
}

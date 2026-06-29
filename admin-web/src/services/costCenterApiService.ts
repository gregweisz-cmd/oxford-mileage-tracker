interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  enableGoogleMaps?: boolean;
  perDiemReceiptImageRequired?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CostCenterCreateData {
  code?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  enableGoogleMaps?: boolean;
  perDiemReceiptImageRequired?: boolean;
}

interface FinanceCostCenterAssignment {
  financeEmployeeId: string;
  financeEmployeeName: string;
  costCenters: string[];
}

interface FinanceCostCenterAssignmentResponse {
  financeEmployeeId: string;
  costCenters: string[];
  hasAnyAssignments: boolean;
}

export class CostCenterApiService {
  private static baseUrl = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api`
    : 'https://oxford-mileage-backend.onrender.com/api';

  static async getAllCostCenters(): Promise<CostCenter[]> {
    // Routed through the shared cached client (cost centers change rarely → long-TTL cache),
    // so repeat portal switches don't re-fetch the whole list.
    const { apiGet } = await import('./rateLimitedApi');
    return apiGet<CostCenter[]>('/api/cost-centers');
  }

  static async getCostCenterById(id: string): Promise<CostCenter> {
    const { apiGet } = await import('./rateLimitedApi');
    return apiGet<CostCenter>(`/api/cost-centers/${id}`);
  }

  static async createCostCenter(costCenter: CostCenterCreateData): Promise<CostCenter> {
    const response = await fetch(`${this.baseUrl}/cost-centers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(costCenter),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to create cost center');
    }

    return response.json();
  }

  static async updateCostCenter(id: string, costCenter: CostCenterCreateData): Promise<void> {
    const response = await fetch(`${this.baseUrl}/cost-centers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(costCenter),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to update cost center');
    }
  }

  static async deleteCostCenter(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/cost-centers/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to delete cost center');
    }
  }

  static async getFinanceAssignments(): Promise<FinanceCostCenterAssignment[]> {
    const { apiGet } = await import('./rateLimitedApi');
    return apiGet<FinanceCostCenterAssignment[]>('/api/finance-cost-center-assignments');
  }

  static async getFinanceAssignmentsForEmployee(financeEmployeeId: string): Promise<FinanceCostCenterAssignmentResponse> {
    const { apiGet } = await import('./rateLimitedApi');
    return apiGet<FinanceCostCenterAssignmentResponse>(`/api/finance-cost-center-assignments/${financeEmployeeId}`);
  }

  static async updateFinanceAssignments(financeEmployeeId: string, costCenters: string[]): Promise<FinanceCostCenterAssignmentResponse> {
    const response = await fetch(`${this.baseUrl}/finance-cost-center-assignments/${financeEmployeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costCenters }),
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to update finance cost center assignments');
    }
    return response.json();
  }
}

export type {
  CostCenter,
  CostCenterCreateData,
  FinanceCostCenterAssignment,
  FinanceCostCenterAssignmentResponse,
};


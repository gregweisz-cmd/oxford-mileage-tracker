interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CostCenterCreateData {
  code?: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export class CostCenterApiService {
  private static baseUrl = 'http://localhost:3002/api';

  static async getAllCostCenters(): Promise<CostCenter[]> {
    const response = await fetch(`${this.baseUrl}/cost-centers`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch cost centers');
    }
    return response.json();
  }

  static async getCostCenterById(id: string): Promise<CostCenter> {
    const response = await fetch(`${this.baseUrl}/cost-centers/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch cost center');
    }
    return response.json();
  }

  static async createCostCenter(costCenter: CostCenterCreateData): Promise<CostCenter> {
    const response = await fetch(`${this.baseUrl}/cost-centers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(costCenter),
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
    });

    if (!response.ok) {
      throw new Error('Failed to update cost center');
    }
  }

  static async deleteCostCenter(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/cost-centers/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete cost center');
    }
  }
}

export type { CostCenter, CostCenterCreateData };


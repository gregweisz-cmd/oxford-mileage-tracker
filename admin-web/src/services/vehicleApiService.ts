import { apiDelete, apiGet, apiPost, apiPut, rateLimitedApi } from './rateLimitedApi';

export interface Vehicle {
  id: string;
  employeeId: string;
  name: string;
  plateNumber?: string;
  startingOdometer: number;
  isDefault: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export const VehicleApiService = {
  async getVehicles(employeeId: string): Promise<Vehicle[]> {
    return apiGet<Vehicle[]>(`/api/vehicles?employeeId=${encodeURIComponent(employeeId)}`);
  },

  async createVehicle(employeeId: string, name: string, startingOdometer: number): Promise<void> {
    await apiPost('/api/vehicles', { employeeId, name, startingOdometer });
    rateLimitedApi.clearCacheFor('/api/vehicles');
  },

  async updateVehicle(
    id: string,
    payload: { employeeId: string; name?: string; startingOdometer?: number; isDefault?: boolean }
  ): Promise<void> {
    await apiPut(`/api/vehicles/${id}`, payload);
    rateLimitedApi.clearCacheFor('/api/vehicles');
  },

  async setDefaultVehicle(employeeId: string, id: string): Promise<void> {
    await apiPut(`/api/vehicles/${id}/default`, { employeeId });
    rateLimitedApi.clearCacheFor('/api/vehicles');
  },

  async deleteVehicle(employeeId: string, id: string): Promise<void> {
    await apiDelete(`/api/vehicles/${id}?employeeId=${encodeURIComponent(employeeId)}`);
    rateLimitedApi.clearCacheFor('/api/vehicles');
  },
};

import { FlockHouse, LocationDetails, OxfordHouse } from '../types';
import { DatabaseService } from './database';
import { OxfordHouseService } from './oxfordHouseService';
import { makeLocationDetails } from '../utils/locationSelection';

export type FlockHouseWithDetails = FlockHouse & {
  house: OxfordHouse | null;
};

export class FlockService {
  static async getFlockHouses(employeeId: string): Promise<FlockHouse[]> {
    return DatabaseService.getFlockHouses(employeeId);
  }

  static async getFlockHousesWithDetails(employeeId: string): Promise<FlockHouseWithDetails[]> {
    const entries = await this.getFlockHouses(employeeId);
    const withDetails: FlockHouseWithDetails[] = [];
    for (const entry of entries) {
      const house = await OxfordHouseService.getOxfordHouseById(entry.oxfordHouseId);
      withDetails.push({ ...entry, house });
    }
    return withDetails;
  }

  static async isInFlock(employeeId: string, oxfordHouseId: string): Promise<boolean> {
    const flock = await this.getFlockHouses(employeeId);
    return flock.some((entry) => entry.oxfordHouseId === oxfordHouseId);
  }

  static async addToFlock(employeeId: string, oxfordHouseId: string): Promise<FlockHouse | null> {
    const existing = await this.isInFlock(employeeId, oxfordHouseId);
    if (existing) return null;

    const flock = await this.getFlockHouses(employeeId);
    const nextOrder =
      flock.length > 0 ? Math.max(...flock.map((entry) => entry.sortOrder)) + 1 : 0;

    return DatabaseService.createFlockHouse({
      employeeId,
      oxfordHouseId,
      sortOrder: nextOrder,
    });
  }

  static async removeFromFlock(id: string): Promise<void> {
    await DatabaseService.deleteFlockHouse(id);
  }

  static async moveFlockHouse(
    employeeId: string,
    id: string,
    direction: 'up' | 'down'
  ): Promise<void> {
    const flock = await this.getFlockHouses(employeeId);
    const index = flock.findIndex((entry) => entry.id === id);
    if (index < 0) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= flock.length) return;

    const reordered = [...flock];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sortOrder !== i) {
        await DatabaseService.updateFlockHouse(reordered[i].id, { sortOrder: i });
      }
    }
  }

  static oxfordHouseToLocationDetails(house: OxfordHouse): LocationDetails {
    return makeLocationDetails({
      name: house.name,
      address: OxfordHouseService.formatHouseAddress(house),
      city: house.city,
      state: house.state,
      zipCode: house.zipCode,
      source: 'flock',
      sourceId: house.id,
    });
  }

  static async searchFlock(
    employeeId: string,
    query: string
  ): Promise<FlockHouseWithDetails[]> {
    const all = await this.getFlockHousesWithDetails(employeeId);
    const q = query.trim().toLowerCase();
    if (!q) return all;

    return all.filter((entry) => {
      const house = entry.house;
      if (!house) return false;
      const address = OxfordHouseService.formatHouseAddress(house);
      return (
        house.name.toLowerCase().includes(q) ||
        address.toLowerCase().includes(q) ||
        house.city.toLowerCase().includes(q) ||
        house.state.toLowerCase().includes(q)
      );
    });
  }
}

import { SavedAddress } from '../types';
import { DatabaseService } from './database';

export class SavedAddressService {
  static async getAllSavedAddresses(employeeId?: string): Promise<SavedAddress[]> {
    return await DatabaseService.getSavedAddresses(employeeId);
  }

  static async searchSavedAddresses(query: string, employeeId?: string): Promise<SavedAddress[]> {
    if (!query.trim()) {
      return await this.getAllSavedAddresses(employeeId);
    }

    const allAddresses = await this.getAllSavedAddresses(employeeId);
    const searchTerm = query.toLowerCase().trim();

    return allAddresses.filter(address => 
      address.name.toLowerCase().includes(searchTerm) ||
      address.address.toLowerCase().includes(searchTerm) ||
      (address.category && address.category.toLowerCase().includes(searchTerm))
    );
  }

  static async createSavedAddress(address: Omit<SavedAddress, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedAddress> {
    return await DatabaseService.createSavedAddress(address);
  }

  static async updateSavedAddress(id: string, updates: Partial<SavedAddress>): Promise<void> {
    return await DatabaseService.updateSavedAddress(id, updates);
  }

  static async deleteSavedAddress(id: string): Promise<void> {
    return await DatabaseService.deleteSavedAddress(id);
  }

  static formatAddressDisplay(address: SavedAddress): string {
    return `${address.name} - ${address.address}`;
  }

  static formatAddressForInput(address: SavedAddress): string {
    return `${address.name} - ${address.address}`;
  }
}



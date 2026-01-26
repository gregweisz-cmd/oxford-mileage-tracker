/**
 * BackendDataService
 * 
 * This service provides direct access to the backend API as the single source of truth.
 * All data operations (read/write) go directly to the backend, eliminating sync conflicts.
 * 
 * Local database is only used for:
 * - Offline caching (optional)
 * - User preferences
 * - Session management
 */

import { API_BASE_URL } from '../config/api';
import { Employee, MileageEntry, Receipt, TimeTracking, DailyDescription } from '../types';
import { UnifiedDayData } from './unifiedDataService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class BackendDataService {
  private static baseUrl = API_BASE_URL;

  /**
   * Generic fetch helper with error handling
   */
  private static async fetchFromBackend<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      // Parse dates from backend responses (convert YYYY-MM-DD strings to Date objects)
      if (Array.isArray(data)) {
        return data.map(item => this.parseDates(item));
      } else if (data && typeof data === 'object') {
        return this.parseDates(data);
      }
      
      return data;
    } catch (error) {
      console.error(`❌ BackendDataService: Error fetching ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Generic POST/PUT/DELETE helper
   */
  private static async writeToBackend<T>(
    endpoint: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body?: any
  ): Promise<T> {
    return this.fetchFromBackend<T>(endpoint, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // ===== EMPLOYEES =====

  static async getEmployees(): Promise<Employee[]> {
    return this.fetchFromBackend<Employee[]>('/api/employees');
  }

  static async getEmployee(employeeId: string): Promise<Employee> {
    return this.fetchFromBackend<Employee>(`/api/employees/${employeeId}`);
  }

  static async updateEmployee(employeeId: string, updates: Partial<Employee>): Promise<Employee> {
    return this.writeToBackend<Employee>(`/api/employees/${employeeId}`, 'PUT', updates);
  }

  // ===== MILEAGE ENTRIES =====

  static async getMileageEntries(
    employeeId?: string,
    month?: number,
    year?: number
  ): Promise<MileageEntry[]> {
    let endpoint = '/api/mileage-entries';
    const params = new URLSearchParams();
    
    if (employeeId) params.append('employeeId', employeeId);
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    return this.fetchFromBackend<MileageEntry[]>(endpoint);
  }

  static async getMileageEntry(entryId: string): Promise<MileageEntry> {
    return this.fetchFromBackend<MileageEntry>(`/api/mileage-entries/${entryId}`);
  }

  static async createMileageEntry(entry: Omit<MileageEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MileageEntry> {
    return this.writeToBackend<MileageEntry>('/api/mileage-entries', 'POST', entry);
  }

  static async updateMileageEntry(entryId: string, updates: Partial<MileageEntry>): Promise<MileageEntry> {
    return this.writeToBackend<MileageEntry>(`/api/mileage-entries/${entryId}`, 'PUT', updates);
  }

  static async deleteMileageEntry(entryId: string): Promise<void> {
    return this.writeToBackend<void>(`/api/mileage-entries/${entryId}`, 'DELETE');
  }

  // ===== RECEIPTS =====

  static async getReceipts(
    employeeId?: string,
    month?: number,
    year?: number
  ): Promise<Receipt[]> {
    let endpoint = '/api/receipts';
    const params = new URLSearchParams();
    
    if (employeeId) params.append('employeeId', employeeId);
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    return this.fetchFromBackend<Receipt[]>(endpoint);
  }

  static async getReceipt(receiptId: string): Promise<Receipt> {
    return this.fetchFromBackend<Receipt>(`/api/receipts/${receiptId}`);
  }

  static async createReceipt(receipt: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Receipt> {
    return this.writeToBackend<Receipt>('/api/receipts', 'POST', receipt);
  }

  static async updateReceipt(receiptId: string, updates: Partial<Receipt>): Promise<Receipt> {
    return this.writeToBackend<Receipt>(`/api/receipts/${receiptId}`, 'PUT', updates);
  }

  static async deleteReceipt(receiptId: string): Promise<void> {
    return this.writeToBackend<void>(`/api/receipts/${receiptId}`, 'DELETE');
  }

  // ===== TIME TRACKING =====

  static async getTimeTracking(
    employeeId?: string,
    month?: number,
    year?: number
  ): Promise<TimeTracking[]> {
    let endpoint = '/api/time-tracking';
    const params = new URLSearchParams();
    
    if (employeeId) params.append('employeeId', employeeId);
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    return this.fetchFromBackend<TimeTracking[]>(endpoint);
  }

  static async getTimeTrackingEntry(entryId: string): Promise<TimeTracking> {
    return this.fetchFromBackend<TimeTracking>(`/api/time-tracking/${entryId}`);
  }

  static async createTimeTracking(entry: Omit<TimeTracking, 'id' | 'createdAt' | 'updatedAt'>): Promise<TimeTracking> {
    // Ensure date is in YYYY-MM-DD format for backend
    const dateStr = this.toLocalDateKey(entry.date);
    return this.writeToBackend<TimeTracking>('/api/time-tracking', 'POST', {
      ...entry,
      date: dateStr
    });
  }

  static async updateTimeTracking(entryId: string, updates: Partial<TimeTracking>): Promise<TimeTracking> {
    // Ensure date is in YYYY-MM-DD format if provided
    const formattedUpdates = { ...updates };
    if (formattedUpdates.date) {
      formattedUpdates.date = this.toLocalDateKey(formattedUpdates.date as any) as any;
    }
    return this.writeToBackend<TimeTracking>(`/api/time-tracking/${entryId}`, 'PUT', formattedUpdates);
  }

  static async deleteTimeTracking(entryId: string): Promise<void> {
    return this.writeToBackend<void>(`/api/time-tracking/${entryId}`, 'DELETE');
  }

  // ===== DAILY DESCRIPTIONS =====

  static async getDailyDescriptions(
    employeeId?: string,
    month?: number,
    year?: number
  ): Promise<DailyDescription[]> {
    let endpoint = '/api/daily-descriptions';
    const params = new URLSearchParams();
    
    if (employeeId) params.append('employeeId', employeeId);
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    return this.fetchFromBackend<DailyDescription[]>(endpoint);
  }

  static async getDailyDescription(descriptionId: string): Promise<DailyDescription> {
    return this.fetchFromBackend<DailyDescription>(`/api/daily-descriptions/${descriptionId}`);
  }

  static async createDailyDescription(description: Omit<DailyDescription, 'id' | 'createdAt' | 'updatedAt'>): Promise<DailyDescription> {
    // Ensure date is in YYYY-MM-DD format for backend
    const dateStr = this.toLocalDateKey(description.date);
    return this.writeToBackend<DailyDescription>('/api/daily-descriptions', 'POST', {
      ...description,
      date: dateStr
    });
  }

  static async updateDailyDescription(descriptionId: string, updates: Partial<DailyDescription>): Promise<DailyDescription> {
    // Ensure date is in YYYY-MM-DD format if provided
    const formattedUpdates = { ...updates };
    if (formattedUpdates.date) {
      formattedUpdates.date = this.toLocalDateKey(formattedUpdates.date as any) as any;
    }
    return this.writeToBackend<DailyDescription>(`/api/daily-descriptions/${descriptionId}`, 'PUT', formattedUpdates);
  }

  static async deleteDailyDescription(descriptionId: string): Promise<void> {
    return this.writeToBackend<void>(`/api/daily-descriptions/${descriptionId}`, 'DELETE');
  }

  // ===== HELPER METHODS FOR UNIFIED DATA =====

  /**
   * Convert date to YYYY-MM-DD format (local timezone)
   */
  private static toLocalDateKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse date strings from backend responses to Date objects
   */
  private static parseDates(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    const parsed = { ...obj };
    
    // Convert date strings to Date objects
    if (parsed.date && typeof parsed.date === 'string') {
      // Handle YYYY-MM-DD format (parse as local date to avoid timezone issues)
      const [year, month, day] = parsed.date.split('-').map(Number);
      parsed.date = new Date(year, month - 1, day);
    }
    
    if (parsed.createdAt && typeof parsed.createdAt === 'string') {
      parsed.createdAt = new Date(parsed.createdAt);
    }
    
    if (parsed.updatedAt && typeof parsed.updatedAt === 'string') {
      parsed.updatedAt = new Date(parsed.updatedAt);
    }
    
    return parsed;
  }

  /**
   * Get unified month data directly from backend
   * This replaces UnifiedDataService.getMonthData() with backend-first approach
   */
  static async getMonthData(
    employeeId: string,
    month: number,
    year: number
  ): Promise<UnifiedDayData[]> {
    // Fetch all data from backend in parallel
    const [timeTrackingEntries, dailyDescriptions, mileageEntries, receipts] = await Promise.all([
      this.getTimeTracking(employeeId, month, year),
      this.getDailyDescriptions(employeeId, month, year),
      this.getMileageEntries(employeeId, month, year),
      this.getReceipts(employeeId, month, year)
    ]);

    // Group data by date
    const daysMap = new Map<string, {
      mileage: MileageEntry[];
      timeTracking: TimeTracking[];
      receipts: Receipt[];
      description?: string;
      dayOff?: boolean;
      dayOffType?: string;
    }>();

    // Initialize all days of the month
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateKey = this.toLocalDateKey(date);
      daysMap.set(dateKey, {
        mileage: [],
        timeTracking: [],
        receipts: []
      });
    }

    // Group entries by date
    mileageEntries.forEach(entry => {
      const dateKey = this.toLocalDateKey(entry.date);
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.mileage.push(entry);
      }
    });

    timeTrackingEntries.forEach(entry => {
      const dateKey = this.toLocalDateKey(entry.date);
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.timeTracking.push(entry);
      }
    });

    receipts.forEach(receipt => {
      const dateKey = this.toLocalDateKey(receipt.date);
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.receipts.push(receipt);
      }
    });

    // Add daily descriptions
    dailyDescriptions.forEach(description => {
      const dateKey = this.toLocalDateKey(description.date);
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.description = description.description;
        dayData.dayOff = description.dayOff;
        dayData.dayOffType = description.dayOffType;
      }
    });

    // Convert to UnifiedDayData format
    const days: UnifiedDayData[] = [];
    daysMap.forEach((dayData, dateKey) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = new Date(y, m - 1, d);

      // Calculate hours breakdown with deduplication
      const hoursBreakdown = {
        workingHours: 0,
        gahours: 0,
        holidayHours: 0,
        ptoHours: 0,
        stdLtdHours: 0,
        pflPfmlHours: 0
      };

      // IMPORTANT: For "Working Hours" entries, we need to handle cost center-specific entries
      // The web portal stores cost center hours as separate "Working Hours" entries with different costCenters
      // The mobile app aggregates them into a single "Working Hours" field
      // 
      // Strategy:
      // 1. For "Working Hours" entries WITH a costCenter: Sum them all into workingHours
      // 2. For "Working Hours" entries WITHOUT a costCenter: Add to workingHours
      // 3. For other categories: Sum normally (they don't have cost centers)
      
      // Deduplicate time tracking entries by category AND costCenter (keep most recent)
      // Use composite key: "category|costCenter" to handle both category-only and cost-center entries
      const entryMap = new Map<string, TimeTracking>();
      dayData.timeTracking.forEach(entry => {
        const category = entry.category || '';
        const costCenter = entry.costCenter || '';
        // Create composite key: category and costCenter together
        // This ensures entries with same category but different costCenters are kept separate
        const key = `${category}|${costCenter}`;
        const existing = entryMap.get(key);
        if (!existing || (entry.updatedAt && existing.updatedAt && 
            new Date(entry.updatedAt) > new Date(existing.updatedAt))) {
          entryMap.set(key, entry);
        }
      });

      // Process deduplicated entries
      // For "Working Hours", sum ALL entries (regardless of costCenter) since mobile app shows one field
      entryMap.forEach(entry => {
        switch (entry.category) {
          case 'Working Hours':
            // Sum all "Working Hours" entries together (including cost center-specific ones)
            // This matches how the mobile app displays a single "Working Hours" field
            hoursBreakdown.workingHours += entry.hours;
            break;
          case 'G&A Hours':
            hoursBreakdown.gahours += entry.hours;
            break;
          case 'Holiday Hours':
            hoursBreakdown.holidayHours += entry.hours;
            break;
          case 'PTO Hours':
            hoursBreakdown.ptoHours += entry.hours;
            break;
          case 'STD/LTD Hours':
            hoursBreakdown.stdLtdHours += entry.hours;
            break;
          case 'PFL/PFML Hours':
            hoursBreakdown.pflPfmlHours += entry.hours;
            break;
        }
      });

      const totalHours = Object.values(hoursBreakdown).reduce((sum, hours) => sum + hours, 0);
      const totalMiles = dayData.mileage.reduce((sum, entry) => sum + entry.miles, 0);
      const totalReceipts = dayData.receipts
        .filter(receipt => receipt.category !== 'Per Diem')
        .reduce((sum, receipt) => sum + receipt.amount, 0);

      days.push({
        date,
        employeeId,
        totalHours,
        hoursBreakdown,
        totalMiles,
        mileageEntries: dayData.mileage,
        totalReceipts,
        receipts: dayData.receipts,
        costCenter: dayData.timeTracking[0]?.costCenter || dayData.mileage[0]?.costCenter || '',
        notes: dayData.mileage[0]?.notes || '',
        description: dayData.description || '',
        dayOff: dayData.dayOff || false,
        dayOffType: dayData.dayOffType || undefined
      });
    });

    return days.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Update hours for a specific day - writes directly to backend
   */
  static async updateDayHours(
    employeeId: string,
    date: Date,
    hoursBreakdown: Partial<UnifiedDayData['hoursBreakdown']>,
    costCenter?: string
  ): Promise<void> {
    // Get existing entries for this day from backend
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const existingEntries = await this.getTimeTracking(employeeId, month, year);

    // Filter entries for this specific day - use multiple date comparison methods to catch all duplicates
    const dayStr = this.toLocalDateKey(date);
    const dayEntries = existingEntries.filter(entry => {
      const entryDayStr = this.toLocalDateKey(entry.date);
      // Also check if dates match by comparing year, month, day directly
      const entryDate = new Date(entry.date);
      const targetDate = new Date(date);
      const sameDay = entryDate.getFullYear() === targetDate.getFullYear() &&
                      entryDate.getMonth() === targetDate.getMonth() &&
                      entryDate.getDate() === targetDate.getDate();
      return entryDayStr === dayStr || sameDay;
    });

    // IMPORTANT: Handle "Working Hours" differently from other categories
    // - "Working Hours" on mobile app represents the TOTAL for all cost centers
    // - Web portal stores cost center hours as separate "Working Hours" entries with different costCenters
    // - When mobile app saves "Working Hours", it should replace ALL "Working Hours" entries (all cost centers)
    // - For other categories (G&A, Holiday, etc.), only delete entries for the selected costCenter
    const targetCostCenter = costCenter || '';
    
    // List of categories we might be updating
    const categoryMap: { [key: string]: string } = {
      'workingHours': 'Working Hours',
      'gahours': 'G&A Hours',
      'holidayHours': 'Holiday Hours',
      'ptoHours': 'PTO Hours',
      'stdLtdHours': 'STD/LTD Hours',
      'pflPfmlHours': 'PFL/PFML Hours'
    };
    
    // Determine which categories are being updated (have values in hoursBreakdown)
    const categoriesBeingUpdated = Object.keys(hoursBreakdown)
      .filter(key => hoursBreakdown[key as keyof typeof hoursBreakdown] !== undefined)
      .map(key => categoryMap[key] || key);
    
    // Check if "Working Hours" is being updated
    const isUpdatingWorkingHours = categoriesBeingUpdated.includes('Working Hours');
    
    // Filter entries to delete
    const entriesToDelete = dayEntries.filter(entry => {
      const entryCostCenter = entry.costCenter || '';
      const entryCategory = entry.category || '';
      
      // Special handling for "Working Hours":
      // - If updating "Working Hours", delete ALL "Working Hours" entries (all cost centers)
      // - This is because mobile app shows a single "Working Hours" field that represents the total
      if (isUpdatingWorkingHours && entryCategory === 'Working Hours') {
        return true; // Delete all "Working Hours" entries regardless of costCenter
      }
      
      // For other categories, only delete if costCenter matches
      if (targetCostCenter && categoriesBeingUpdated.includes(entryCategory)) {
        return entryCostCenter === targetCostCenter;
      }
      
      // If no costCenter specified, delete all entries for categories being updated (legacy behavior)
      if (!targetCostCenter && categoriesBeingUpdated.includes(entryCategory)) {
        return true;
      }
      
      return false;
    });

    // Delete matching entries
    console.log(`🗑️ BackendDataService: Deleting ${entriesToDelete.length} time tracking entries for ${dayStr} (costCenter: ${targetCostCenter || 'all'})`);
    for (const entry of entriesToDelete) {
      try {
        await this.deleteTimeTracking(entry.id);
        console.log(`✅ BackendDataService: Deleted entry ${entry.id} (${entry.category}, ${entry.costCenter || 'no costCenter'}, ${entry.hours} hours)`);
      } catch (error) {
        console.error(`❌ BackendDataService: Error deleting entry ${entry.id}:`, error);
        // Continue deleting other entries even if one fails
      }
    }

    // Create new entries for each category with hours > 0
    // Only create entries for the costCenter being updated
    const categories = [
      { key: 'workingHours', category: 'Working Hours' },
      { key: 'gahours', category: 'G&A Hours' },
      { key: 'holidayHours', category: 'Holiday Hours' },
      { key: 'ptoHours', category: 'PTO Hours' },
      { key: 'stdLtdHours', category: 'STD/LTD Hours' },
      { key: 'pflPfmlHours', category: 'PFL/PFML Hours' }
    ];

    let entriesCreated = 0;
    for (const { key, category } of categories) {
      const hours = hoursBreakdown[key as keyof typeof hoursBreakdown];
      // Only create if hours is explicitly set (not undefined) and > 0
      if (hours !== undefined && hours !== null && hours > 0) {
        // Special handling for "Working Hours":
        // - Mobile app's "Working Hours" represents total hours for the selected costCenter
        // - Create a single entry with the selected costCenter (replacing all previous cost center entries)
        // - For other categories, use the selected costCenter
        await this.createTimeTracking({
          employeeId,
          date,
          category: category as any,
          hours,
          description: '',
          costCenter: targetCostCenter
        });
        entriesCreated++;
        console.log(`✅ BackendDataService: Created ${category} entry: ${hours} hours (costCenter: ${targetCostCenter || 'none'})`);
      }
    }
    
    if (entriesCreated === 0) {
      console.log(`✅ BackendDataService: All hours cleared for ${dayStr} (costCenter: ${targetCostCenter || 'all'}) - no entries created`);
    }
  }

  /**
   * Update daily description - writes directly to backend
   */
  static async updateDayDescription(
    employeeId: string,
    date: Date,
    description: string,
    costCenter?: string,
    stayedOvernight?: boolean,
    dayOff?: boolean,
    dayOffType?: string
  ): Promise<void> {
    // Get existing description for this day
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const existingDescriptions = await this.getDailyDescriptions(employeeId, month, year);
    
    const dayStr = this.toLocalDateKey(date);
    const existing = existingDescriptions.find(desc => {
      const descDayStr = this.toLocalDateKey(desc.date);
      return descDayStr === dayStr;
    });

    const isEmpty = !description || description.trim() === '';

    // If empty and user is not setting it as a day off, delete it
    // This allows deletion even if the existing entry was previously a day off
    if (isEmpty && !dayOff) {
      if (existing) {
        await this.deleteDailyDescription(existing.id);
        return;
      }
      // If no existing entry and empty, nothing to do
      return;
    }

    // Update or create
    if (existing) {
      await this.updateDailyDescription(existing.id, {
        description,
        costCenter,
        stayedOvernight,
        dayOff: dayOff || false, // Explicitly set dayOff to false if not provided
        dayOffType: dayOff ? dayOffType : null // Clear dayOffType if not a day off
      });
    } else if (!isEmpty || dayOff) {
      await this.createDailyDescription({
        employeeId,
        date,
        description,
        costCenter,
        stayedOvernight,
        dayOff: dayOff || false,
        dayOffType: dayOff ? dayOffType : null
      });
    }
  }

  /**
   * Reset all hours for a specific month (set all to 0) - writes directly to backend
   */
  static async resetMonthHours(
    employeeId: string,
    month: number,
    year: number
  ): Promise<void> {
    // Get all time tracking entries for the month from backend
    const existingEntries = await this.getTimeTracking(employeeId, month, year);

    // Delete all entries from backend
    for (const entry of existingEntries) {
      await this.deleteTimeTracking(entry.id);
    }
  }
}

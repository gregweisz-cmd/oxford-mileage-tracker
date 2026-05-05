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
import { ApiSyncService } from './apiSyncService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class BackendDataService {
  private static baseUrl = API_BASE_URL;
  
  /** Timeout in ms for backend fetch — fail fast so app doesn't hang on Loading */
  private static readonly FETCH_TIMEOUT_MS = 15000;

  /**
   * Generic fetch helper with error handling and timeout
   */
  private static async fetchFromBackend<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      // Parse dates from backend responses (convert YYYY-MM-DD strings to Date objects)
      if (Array.isArray(data)) {
        return data.map(item => this.parseDates(item)) as T;
      } else if (data && typeof data === 'object') {
        return this.parseDates(data) as T;
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

  /** Backend employee id for API query/body (matches ApiSyncService / mileage push). */
  private static async apiEmployeeId(employeeId: string): Promise<string> {
    const resolved = await ApiSyncService.resolveBackendEmployeeId(employeeId);
    return resolved ?? employeeId;
  }

  // ===== EMPLOYEES =====

  static async getEmployees(): Promise<Employee[]> {
    return this.fetchFromBackend<Employee[]>('/employees');
  }

  static async getEmployee(employeeId: string): Promise<Employee> {
    const id = await this.apiEmployeeId(employeeId);
    return this.fetchFromBackend<Employee>(`/employees/${id}`);
  }

  static async updateEmployee(employeeId: string, updates: Partial<Employee>): Promise<Employee> {
    const id = await this.apiEmployeeId(employeeId);
    return this.writeToBackend<Employee>(`/employees/${id}`, 'PUT', updates);
  }

  // ===== MILEAGE ENTRIES =====

  static async getMileageEntries(
    employeeId?: string,
    month?: number,
    year?: number
  ): Promise<MileageEntry[]> {
    let endpoint = '/mileage-entries';
    const params = new URLSearchParams();
    
    if (employeeId) params.append('employeeId', await this.apiEmployeeId(employeeId));
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    return this.fetchFromBackend<MileageEntry[]>(endpoint);
  }

  static async getMileageEntry(entryId: string): Promise<MileageEntry> {
    return this.fetchFromBackend<MileageEntry>(`/mileage-entries/${entryId}`);
  }

  static async createMileageEntry(entry: Omit<MileageEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MileageEntry> {
    const employeeId = await this.apiEmployeeId(entry.employeeId);
    return this.writeToBackend<MileageEntry>('/mileage-entries', 'POST', { ...entry, employeeId });
  }

  static async updateMileageEntry(entryId: string, updates: Partial<MileageEntry>): Promise<MileageEntry> {
    return this.writeToBackend<MileageEntry>(`/mileage-entries/${entryId}`, 'PUT', updates);
  }

  static async deleteMileageEntry(entryId: string): Promise<void> {
    return this.writeToBackend<void>(`/mileage-entries/${entryId}`, 'DELETE');
  }

  // ===== RECEIPTS =====

  static async getReceipts(
    employeeId?: string,
    month?: number,
    year?: number
  ): Promise<Receipt[]> {
    let endpoint = '/receipts';
    const params = new URLSearchParams();
    
    if (employeeId) params.append('employeeId', await this.apiEmployeeId(employeeId));
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    return this.fetchFromBackend<Receipt[]>(endpoint);
  }

  static async getReceipt(receiptId: string): Promise<Receipt> {
    return this.fetchFromBackend<Receipt>(`/receipts/${receiptId}`);
  }

  static async createReceipt(receipt: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Receipt> {
    const employeeId = await this.apiEmployeeId(receipt.employeeId);
    return this.writeToBackend<Receipt>('/receipts', 'POST', { ...receipt, employeeId });
  }

  static async updateReceipt(receiptId: string, updates: Partial<Receipt>): Promise<Receipt> {
    return this.writeToBackend<Receipt>(`/receipts/${receiptId}`, 'PUT', updates);
  }

  static async deleteReceipt(receiptId: string): Promise<void> {
    return this.writeToBackend<void>(`/receipts/${receiptId}`, 'DELETE');
  }

  // ===== TIME TRACKING =====

  static async getTimeTracking(
    employeeId?: string,
    month?: number,
    year?: number
  ): Promise<TimeTracking[]> {
    let endpoint = '/time-tracking';
    const params = new URLSearchParams();
    
    if (employeeId) params.append('employeeId', await this.apiEmployeeId(employeeId));
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    return this.fetchFromBackend<TimeTracking[]>(endpoint);
  }

  static async getTimeTrackingEntry(entryId: string): Promise<TimeTracking> {
    return this.fetchFromBackend<TimeTracking>(`/time-tracking/${entryId}`);
  }

  static async createTimeTracking(entry: Omit<TimeTracking, 'id' | 'createdAt' | 'updatedAt'>): Promise<TimeTracking> {
    // Ensure date is in YYYY-MM-DD format for backend
    const dateStr = this.toLocalDateKey(entry.date);
    const employeeId = await this.apiEmployeeId(entry.employeeId);
    return this.writeToBackend<TimeTracking>('/time-tracking', 'POST', {
      ...entry,
      employeeId,
      date: dateStr
    });
  }

  static async updateTimeTracking(entryId: string, updates: Partial<TimeTracking>): Promise<TimeTracking> {
    // Ensure date is in YYYY-MM-DD format if provided
    const formattedUpdates = { ...updates };
    if (formattedUpdates.date) {
      formattedUpdates.date = this.toLocalDateKey(formattedUpdates.date as any) as any;
    }
    if (formattedUpdates.employeeId) {
      formattedUpdates.employeeId = await this.apiEmployeeId(formattedUpdates.employeeId as string);
    }
    return this.writeToBackend<TimeTracking>(`/time-tracking/${entryId}`, 'PUT', formattedUpdates);
  }

  static async deleteTimeTracking(entryId: string): Promise<void> {
    return this.writeToBackend<void>(`/time-tracking/${entryId}`, 'DELETE');
  }

  // ===== DAILY DESCRIPTIONS =====

  static async getDailyDescriptions(
    employeeId?: string,
    month?: number,
    year?: number
  ): Promise<DailyDescription[]> {
    let endpoint = '/daily-descriptions';
    const params = new URLSearchParams();
    
    if (employeeId) params.append('employeeId', await this.apiEmployeeId(employeeId));
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    return this.fetchFromBackend<DailyDescription[]>(endpoint);
  }

  static async getDailyDescription(descriptionId: string): Promise<DailyDescription> {
    return this.fetchFromBackend<DailyDescription>(`/daily-descriptions/${descriptionId}`);
  }

  static async createDailyDescription(description: Omit<DailyDescription, 'id' | 'createdAt' | 'updatedAt'>): Promise<DailyDescription> {
    // Ensure date is in YYYY-MM-DD format for backend
    const dateStr = this.toLocalDateKey(description.date);
    const employeeId = await this.apiEmployeeId(description.employeeId);
    return this.writeToBackend<DailyDescription>('/daily-descriptions', 'POST', {
      ...description,
      employeeId,
      date: dateStr
    });
  }

  static async updateDailyDescription(descriptionId: string, updates: Partial<DailyDescription>): Promise<DailyDescription> {
    // Ensure date is in YYYY-MM-DD format if provided
    const formattedUpdates = { ...updates };
    if (formattedUpdates.date) {
      formattedUpdates.date = this.toLocalDateKey(formattedUpdates.date as any) as any;
    }
    return this.writeToBackend<DailyDescription>(`/daily-descriptions/${descriptionId}`, 'PUT', formattedUpdates);
  }

  static async deleteDailyDescription(descriptionId: string): Promise<void> {
    return this.writeToBackend<void>(`/daily-descriptions/${descriptionId}`, 'DELETE');
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
    // Fetch all data from backend in parallel; use allSettled so one failing request
    // (e.g. mileage/receipts timeout on Android) doesn't zero out the whole dashboard.
    const [timeResult, descResult, mileageResult, receiptsResult] = await Promise.allSettled([
      this.getTimeTracking(employeeId, month, year),
      this.getDailyDescriptions(employeeId, month, year),
      this.getMileageEntries(employeeId, month, year),
      this.getReceipts(employeeId, month, year)
    ]);
    const timeTrackingEntries = timeResult.status === 'fulfilled' ? timeResult.value : [];
    const dailyDescriptions = descResult.status === 'fulfilled' ? descResult.value : [];
    const mileageEntries = mileageResult.status === 'fulfilled' ? mileageResult.value : [];
    const receipts = receiptsResult.status === 'fulfilled' ? receiptsResult.value : [];
    if (timeResult.status === 'rejected') console.warn('BackendDataService: getTimeTracking failed', timeResult.reason);
    if (descResult.status === 'rejected') console.warn('BackendDataService: getDailyDescriptions failed', descResult.reason);
    if (mileageResult.status === 'rejected') console.warn('BackendDataService: getMileageEntries failed', mileageResult.reason);
    if (receiptsResult.status === 'rejected') console.warn('BackendDataService: getReceipts failed', receiptsResult.reason);

    // Group data by date
    const daysMap = new Map<string, {
      mileage: MileageEntry[];
      timeTracking: TimeTracking[];
      receipts: Receipt[];
      description?: string;
      descriptionId?: string;
      stayedOvernight?: boolean;
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

    // Add daily descriptions (include id for reliable delete/update from mobile)
    dailyDescriptions.forEach(description => {
      const dateKey = this.toLocalDateKey(description.date);
      const dayData = daysMap.get(dateKey);
      if (dayData) {
        dayData.description = description.description;
        dayData.descriptionId = description.id;
        dayData.stayedOvernight = description.stayedOvernight;
        dayData.dayOff = description.dayOff;
        dayData.dayOffType = description.dayOffType;
      }
    });

    // Convert to UnifiedDayData format
    const days: UnifiedDayData[] = [];
    daysMap.forEach((dayData, dateKey) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = new Date(y, m - 1, d);

      const costCenterHours: Record<string, number> = {};
      const hoursBreakdown = {
        workingHours: 0,
        gahours: 0,
        holidayHours: 0,
        ptoHours: 0,
        stdLtdHours: 0,
        pflPfmlHours: 0
      };

      // Guard against duplicate backend rows for the same day/category/cost-center
      // by keeping only the latest updated record per key.
      const dedupedTimeEntries = (() => {
        const byKey = new Map<string, TimeTracking>();
        dayData.timeTracking.forEach((entry) => {
          const categoryKey = String(entry.category || '').trim().toLowerCase();
          const costCenterKey = String(entry.costCenter || '').trim().toLowerCase();
          const key = `${categoryKey}|${costCenterKey}`;
          const existing = byKey.get(key);
          if (!existing) {
            byKey.set(key, entry);
            return;
          }
          const existingUpdated = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const incomingUpdated = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
          if (incomingUpdated >= existingUpdated) {
            byKey.set(key, entry);
          }
        });
        return Array.from(byKey.values());
      })();

      dedupedTimeEntries.forEach(entry => {
        const category = (entry.category || '').trim();
        const cc = (entry.costCenter || '').trim();
        const isWorking = category === '' || category === 'Working Hours' || category === 'Regular Hours';
        if (isWorking && entry.hours > 0) {
          const key = cc || 'Unassigned';
          costCenterHours[key] = (costCenterHours[key] || 0) + entry.hours;
        }
      });
      hoursBreakdown.workingHours = Object.values(costCenterHours).reduce((s, h) => s + h, 0);

      const categoryMap = new Map<string, TimeTracking>();
      dedupedTimeEntries.forEach(entry => {
        const category = String(entry.category || '');
        const isWorking = category === '' || category === 'Working Hours' || category === 'Regular Hours';
        if (isWorking) return;
        const existing = categoryMap.get(category);
        if (!existing || (entry.updatedAt && existing.updatedAt && new Date(entry.updatedAt) > new Date(existing.updatedAt))) {
          categoryMap.set(category, entry);
        }
      });
      categoryMap.forEach(entry => {
        switch (entry.category) {
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

      const totalHours = hoursBreakdown.workingHours + Object.values(hoursBreakdown).slice(1).reduce((s, h) => s + h, 0);
      const totalMiles = dayData.mileage.reduce((sum, entry) => sum + entry.miles, 0);
      const totalReceipts = dayData.receipts
        .filter(receipt => receipt.category !== 'Per Diem')
        .reduce((sum, receipt) => sum + receipt.amount, 0);

      days.push({
        date,
        employeeId,
        totalHours,
        costCenterHours,
        hoursBreakdown,
        totalMiles,
        mileageEntries: dayData.mileage,
        totalReceipts,
        receipts: dayData.receipts,
        costCenter: dayData.timeTracking[0]?.costCenter || dayData.mileage[0]?.costCenter || '',
        notes: dayData.mileage[0]?.notes || '',
        description: dayData.description || '',
        descriptionId: dayData.descriptionId,
        stayedOvernight: dayData.stayedOvernight || false,
        dayOff: dayData.dayOff || false,
        dayOffType: dayData.dayOffType || undefined
      });
    });

    return days.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Update hours for a specific day - writes directly to backend.
   * Supports per-cost-center working hours (matches web portal) and category hours.
   */
  static async updateDayHours(
    employeeId: string,
    date: Date,
    options: {
      costCenterHours?: Record<string, number>;
      hoursBreakdown?: Partial<UnifiedDayData['hoursBreakdown']>;
      costCenter?: string;
    }
  ): Promise<void> {
    const { costCenterHours, hoursBreakdown = {}, costCenter: targetCostCenter = '' } = options;
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const dayStr = this.toLocalDateKey(date);
    const existingEntries = await this.getTimeTracking(employeeId, month, year);
    const dayEntries = existingEntries.filter(entry => {
      const entryDayStr = this.toLocalDateKey(entry.date);
      const entryDate = new Date(entry.date);
      const targetDate = new Date(date);
      const sameDay = entryDate.getFullYear() === targetDate.getFullYear() &&
                      entryDate.getMonth() === targetDate.getMonth() &&
                      entryDate.getDate() === targetDate.getDate();
      return entryDayStr === dayStr || sameDay;
    });

    type DesiredEntry = {
      category: string;
      costCenter: string;
      hours: number;
    };
    const desiredEntries: DesiredEntry[] = [];

    if (costCenterHours && Object.keys(costCenterHours).length > 0) {
      for (const [ccName, rawHours] of Object.entries(costCenterHours)) {
        const hours = Number(rawHours) || 0;
        if (hours > 0) {
          desiredEntries.push({
            category: 'Working Hours',
            costCenter: ccName === 'Unassigned' ? '' : ccName,
            hours,
          });
        }
      }
    } else if (hoursBreakdown.workingHours != null && hoursBreakdown.workingHours > 0) {
      desiredEntries.push({
        category: 'Working Hours',
        costCenter: targetCostCenter || '',
        hours: Number(hoursBreakdown.workingHours) || 0,
      });
    }

    const categories = [
      { key: 'gahours', category: 'G&A Hours' },
      { key: 'holidayHours', category: 'Holiday Hours' },
      { key: 'ptoHours', category: 'PTO Hours' },
      { key: 'stdLtdHours', category: 'STD/LTD Hours' },
      { key: 'pflPfmlHours', category: 'PFL/PFML Hours' }
    ];
    for (const { key, category } of categories) {
      const hours = hoursBreakdown[key as keyof typeof hoursBreakdown];
      if (hours != null && hours > 0) {
        desiredEntries.push({
          category,
          costCenter: '',
          hours: Number(hours) || 0,
        });
      }
    }

    const toKey = (category: string, costCenter: string): string =>
      `${(category || '').trim().toLowerCase()}|${(costCenter || '').trim().toLowerCase()}`;

    // Keep one existing row per (category, costCenter) key for update; delete duplicates.
    const existingByKey = new Map<string, TimeTracking>();
    const duplicateExisting: TimeTracking[] = [];
    for (const entry of dayEntries) {
      const key = toKey(entry.category || '', entry.costCenter || '');
      const current = existingByKey.get(key);
      if (!current) {
        existingByKey.set(key, entry);
        continue;
      }
      const currentUpdatedAt = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
      const entryUpdatedAt = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
      if (entryUpdatedAt > currentUpdatedAt) {
        duplicateExisting.push(current);
        existingByKey.set(key, entry);
      } else {
        duplicateExisting.push(entry);
      }
    }

    const desiredKeySet = new Set(desiredEntries.map(e => toKey(e.category, e.costCenter)));

    // Update existing matching rows and create missing rows.
    for (const desired of desiredEntries) {
      const key = toKey(desired.category, desired.costCenter);
      const existing = existingByKey.get(key);
      if (existing) {
        await this.updateTimeTracking(existing.id, {
          employeeId,
          date,
          category: desired.category as any,
          hours: desired.hours,
          description: '',
          costCenter: desired.costCenter,
        });
      } else {
        await this.createTimeTracking({
          employeeId,
          date,
          category: desired.category as any,
          hours: desired.hours,
          description: '',
          costCenter: desired.costCenter,
        });
      }
    }

    // Delete rows no longer needed and any duplicates.
    for (const entry of dayEntries) {
      const key = toKey(entry.category || '', entry.costCenter || '');
      if (!desiredKeySet.has(key)) {
        await this.deleteTimeTracking(entry.id);
      }
    }
    for (const duplicate of duplicateExisting) {
      await this.deleteTimeTracking(duplicate.id);
    }
  }

  /**
   * Update daily description - writes directly to backend
   * @param descriptionId If provided and we're deleting, use this id directly (avoids date-matching issues)
   */
  static async updateDayDescription(
    employeeId: string,
    date: Date,
    description: string,
    costCenter?: string,
    stayedOvernight?: boolean,
    dayOff?: boolean,
    dayOffType?: string,
    descriptionId?: string
  ): Promise<void> {
    const isEmpty = !description || description.trim() === '';

    // If empty and not day off, delete the row only when there is nothing else to persist.
    // "Stayed out of town" is stored on the same row; checkbox-only must upsert, not delete.
    const keepRowForOutOfTown = stayedOvernight === true;
    if (isEmpty && !dayOff && !keepRowForOutOfTown) {
      if (descriptionId) {
        await this.deleteDailyDescription(descriptionId);
        return;
      }
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const existingDescriptions = await this.getDailyDescriptions(employeeId, month, year);
      const dayStr = this.toLocalDateKey(date);
      const existing = existingDescriptions.find(desc => {
        const descDayStr = this.toLocalDateKey(desc.date);
        return descDayStr === dayStr;
      });
      if (existing) {
        await this.deleteDailyDescription(existing.id);
        return;
      }
      return;
    }

    // Get existing description for update/create
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const existingDescriptions = await this.getDailyDescriptions(employeeId, month, year);
    const dayStr = this.toLocalDateKey(date);
    const existing = existingDescriptions.find(desc => {
      const descDayStr = this.toLocalDateKey(desc.date);
      return descDayStr === dayStr;
    });

    // Update or create
    if (existing) {
      await this.updateDailyDescription(existing.id, {
        description,
        costCenter,
        stayedOvernight,
        dayOff: dayOff || false, // Explicitly set dayOff to false if not provided
        dayOffType: dayOff ? dayOffType : undefined // Clear dayOffType if not a day off
      });
    } else if (!isEmpty || dayOff || keepRowForOutOfTown) {
      await this.createDailyDescription({
        employeeId,
        date,
        description,
        costCenter,
        stayedOvernight,
        dayOff: dayOff || false,
        dayOffType: dayOff ? dayOffType : undefined
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

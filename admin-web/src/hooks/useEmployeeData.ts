/**
 * useEmployeeData Hook
 * Custom hook for loading employee data in the StaffPortal
 * 
 * Features:
 * - Centralized data loading
 * - Loading states
 * - Error handling
 * - Automatic refresh
 */

import { useState, useEffect, useCallback } from 'react';
import { DataSyncService } from '../services/dataSyncService';
import { Employee, MileageEntry, Receipt, TimeTracking } from '../types';

export interface EmployeeExpenseData {
  employeeId: string;
  name: string;
  month: string;
  year: number;
  dateCompleted: string;
  costCenters: string[];

  // Summary totals
  totalMiles: number;
  totalMileageAmount: number;
  totalReceipts: number;
  totalHours: number;

  // Daily travel data
  dailyEntries: DailyExpenseEntry[];

  // Receipt categories
  airRailBus: number;
  vehicleRentalFuel: number;
  parkingTolls: number;
  groundTransportation: number;
  hotelsAirbnb: number;
  perDiem: number;

  // Communication expenses
  phoneInternetFax: number;
  shippingPostage: number;
  printingCopying: number;

  // Other expenses
  officeSupplies: number;
  eesReceipt: number;
  meals: number;
  other: number;

  // Base address
  baseAddress: string;
  baseAddress2?: string;
}

export interface DailyExpenseEntry {
  day: number;
  date: string;
  description: string;
  hoursWorked: number;
  workingHours?: number;
  odometerStart: number;
  odometerEnd: number;
  milesTraveled: number;
  mileageAmount: number;
  airRailBus: number;
  vehicleRentalFuel: number;
  parkingTolls: number;
  groundTransportation: number;
  hotelsAirbnb: number;
  perDiem: number;
}

export interface ReceiptData {
  id: string;
  date: string;
  amount: number;
  vendor: string;
  description: string;
  category: string;
  imageUri?: string;
}

export interface UseEmployeeDataResult {
  employeeData: EmployeeExpenseData | null;
  receipts: ReceiptData[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to load and manage employee data
 */
export function useEmployeeData(
  employeeId: string,
  reportMonth: number,
  reportYear: number
): UseEmployeeDataResult {
  const [employeeData, setEmployeeData] = useState<EmployeeExpenseData | null>(null);
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load employee data
   */
  const loadData = useCallback(async () => {
    if (!employeeId || !reportMonth || !reportYear) {
      setError('Missing employee ID, month, or year');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel using DataSyncService
      const { employee, mileage, receipts: rawReceipts, timeTracking } = await DataSyncService.getEmployeeData(
        employeeId,
        reportMonth,
        reportYear
      );

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Process month names
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = monthNames[reportMonth - 1];

      // Get cost centers
      const costCenters = employee.selectedCostCenters && employee.selectedCostCenters.length > 0
        ? employee.selectedCostCenters
        : employee.costCenters || ['Program Services'];

      // Calculate days in month
      const daysInMonth = new Date(reportYear, reportMonth, 0).getDate();

      // Create daily entries
      const dailyEntries: DailyExpenseEntry[] = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const date = new Date(reportYear, reportMonth - 1, day);
        const dateStr = date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        });

        // Find entries for this day
        const dayMileage = mileage.filter(m => {
          const mDate = new Date(m.date);
          return mDate.getDate() === day;
        });

        const dayTimeTracking = timeTracking.filter(t => {
          const tDate = new Date(t.date);
          return tDate.getDate() === day;
        });

        // Calculate totals for this day
        const milesTraveled = dayMileage.reduce((sum, m) => sum + (m.miles || 0), 0);
        const hoursWorked = dayTimeTracking.reduce((sum, t) => sum + (t.hours || 0), 0);

        return {
          day,
          date: dateStr,
          description: hoursWorked > 0 ? 'Work day' : '', // Empty description for blank days
          hoursWorked,
          workingHours: hoursWorked,
          odometerStart: 0,
          odometerEnd: 0,
          milesTraveled,
          mileageAmount: milesTraveled * 0.445,
          airRailBus: 0,
          vehicleRentalFuel: 0,
          parkingTolls: 0,
          groundTransportation: 0,
          hotelsAirbnb: 0,
          perDiem: 0
        };
      });

      // Calculate totals
      const totalMiles = mileage.reduce((sum, m) => sum + (m.miles || 0), 0);
      const totalMileageAmount = totalMiles * 0.445;
      const totalReceipts = rawReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
      const totalHours = timeTracking.reduce((sum, t) => sum + (t.hours || 0), 0);

      // Create employee expense data
      const expenseData: EmployeeExpenseData = {
        employeeId: employee.id,
        name: employee.name,
        month: monthName,
        year: reportYear,
        dateCompleted: new Date(reportYear, reportMonth, 0).toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        }),
        costCenters,

        totalMiles,
        totalMileageAmount,
        totalReceipts,
        totalHours,

        dailyEntries,

        // All expenses default to 0 (can be updated from receipts)
        airRailBus: 0,
        vehicleRentalFuel: 0,
        parkingTolls: 0,
        groundTransportation: 0,
        hotelsAirbnb: 0,
        perDiem: 0,
        phoneInternetFax: totalReceipts, // Use receipts total for now
        shippingPostage: 0,
        printingCopying: 0,
        officeSupplies: 0,
        eesReceipt: 0,
        meals: 0,
        other: 0,

        baseAddress: employee.baseAddress || '230 Wagner St, Troutman, NC 28166',
        baseAddress2: employee.baseAddress2
      };

      // Process receipts
      const processedReceipts: ReceiptData[] = rawReceipts.map(receipt => ({
        id: receipt.id,
        date: new Date(receipt.date).toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        }),
        amount: receipt.amount,
        vendor: receipt.vendor,
        description: receipt.description || '',
        category: receipt.category,
        imageUri: receipt.imageUri
      }));

      setEmployeeData(expenseData);
      setReceipts(processedReceipts);
    } catch (err) {
      console.error('Error loading employee data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');

      // Create fallback data
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = monthNames[reportMonth - 1];
      const daysInMonth = new Date(reportYear, reportMonth, 0).getDate();

      const dailyEntries = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const date = new Date(reportYear, reportMonth - 1, day);
        const dateStr = date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        });

        return {
          day,
          date: dateStr,
          description: '', // Empty description for blank days
          hoursWorked: 0,
          workingHours: 0,
          odometerStart: 0,
          odometerEnd: 0,
          milesTraveled: 0,
          mileageAmount: 0,
          airRailBus: 0,
          vehicleRentalFuel: 0,
          parkingTolls: 0,
          groundTransportation: 0,
          hotelsAirbnb: 0,
          perDiem: 0
        };
      });

      const fallbackData: EmployeeExpenseData = {
        employeeId: employeeId,
        name: 'Unknown Employee',
        month: monthName,
        year: reportYear,
        dateCompleted: new Date(reportYear, reportMonth, 0).toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        }),
        costCenters: ['Program Services'],

        totalMiles: 0,
        totalMileageAmount: 0,
        totalReceipts: 0,
        totalHours: 0,

        dailyEntries,

        airRailBus: 0,
        vehicleRentalFuel: 0,
        parkingTolls: 0,
        groundTransportation: 0,
        hotelsAirbnb: 0,
        perDiem: 0,
        phoneInternetFax: 0,
        shippingPostage: 0,
        printingCopying: 0,
        officeSupplies: 0,
        eesReceipt: 0,
        meals: 0,
        other: 0,

        baseAddress: '230 Wagner St, Troutman, NC 28166',
        baseAddress2: ''
      };

      setEmployeeData(fallbackData);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, reportMonth, reportYear]);

  // Load data on mount or when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    employeeData,
    receipts,
    loading,
    error,
    refresh: loadData
  };
}

export default useEmployeeData;


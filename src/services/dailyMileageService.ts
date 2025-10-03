import { DatabaseService } from './database';
import { MileageEntry, DailyOdometerReading } from '../types';

export interface DailyMileageSummary {
  date: Date;
  startingOdometer: number;
  endingOdometer: number;
  totalMiles: number;
  tripCount: number;
  trips: MileageEntry[];
}

export class DailyMileageService {
  /**
   * Get daily mileage summaries for an employee within a date range
   */
  static async getDailyMileageSummaries(
    employeeId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<DailyMileageSummary[]> {
    try {
      // Get all mileage entries for the employee
      const allMileageEntries = await DatabaseService.getMileageEntries(employeeId);
      
      // Get all daily odometer readings for the employee
      const allOdometerReadings = await DatabaseService.getDailyOdometerReadings(employeeId);
      
      // Create a map to store daily summaries (key: YYYY-MM-DD)
      const summariesMap = new Map<string, DailyMileageSummary>();
      
      // Filter entries within the date range and group by day
      const filteredEntries = allMileageEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= startDate && entryDate <= endDate;
      });
      
      // Group mileage entries by date
      filteredEntries.forEach(entry => {
        const dateKey = entry.date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!summariesMap.has(dateKey)) {
          summariesMap.set(dateKey, {
            date: new Date(dateKey),
            startingOdometer: 0, // Will be populated later
            endingOdometer: 0,   // Will be populated later
            totalMiles: 0,
            tripCount: 0,
            trips: [],
          });
        }
        
        const summary = summariesMap.get(dateKey)!;
        summary.trips.push(entry);
        summary.totalMiles += entry.miles;
        summary.tripCount++;
      });
      
      // Sort trips within each day by creation time to determine order
      summariesMap.forEach(summary => {
        summary.trips.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        // Determine starting and ending odometer for the day
        const dailyOdometer = allOdometerReadings.find(
          reading => reading.employeeId === employeeId && 
          reading.date.toISOString().split('T')[0] === summary.date.toISOString().split('T')[0]
        );
        
        if (dailyOdometer) {
          summary.startingOdometer = dailyOdometer.odometerReading || 0;
        } else if (summary.trips.length > 0) {
          // Fallback: if no daily odometer reading, use the first trip's odometer
          summary.startingOdometer = summary.trips[0].odometerReading || 0;
        } else {
          // Default to 0 if no odometer data available
          summary.startingOdometer = 0;
        }
        
        if (summary.trips.length > 0) {
          const lastTrip = summary.trips[summary.trips.length - 1];
          summary.endingOdometer = (lastTrip.odometerReading || 0) + lastTrip.miles;
        } else {
          summary.endingOdometer = summary.startingOdometer;
        }
      });
      
      // Convert map to array and sort by date
      const summaries = Array.from(summariesMap.values()).sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
      
      return summaries;
    } catch (error) {
      console.error('Error getting daily mileage summaries:', error);
      throw error;
    }
  }
  
  /**
   * Get daily mileage summary for a specific date
   */
  static async getDailyMileageSummary(
    employeeId: string, 
    date: Date
  ): Promise<DailyMileageSummary | null> {
    try {
      const summaries = await this.getDailyMileageSummaries(
        employeeId, 
        date, 
        date
      );
      
      return summaries.length > 0 ? summaries[0] : null;
    } catch (error) {
      console.error('Error getting daily mileage summary:', error);
      throw error;
    }
  }
  
  /**
   * Calculate total miles for a date range
   */
  static async getTotalMilesForDateRange(
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const summaries = await this.getDailyMileageSummaries(employeeId, startDate, endDate);
      return summaries.reduce((total, summary) => total + summary.totalMiles, 0);
    } catch (error) {
      console.error('Error calculating total miles:', error);
      throw error;
    }
  }
  
  /**
   * Get trip count for a date range
   */
  static async getTripCountForDateRange(
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const summaries = await this.getDailyMileageSummaries(employeeId, startDate, endDate);
      return summaries.reduce((total, summary) => total + summary.tripCount, 0);
    } catch (error) {
      console.error('Error calculating trip count:', error);
      throw error;
    }
  }
  
  /**
   * Format daily summary for display
   */
  static formatDailySummary(summary: DailyMileageSummary): string {
    const dateStr = summary.date.toLocaleDateString();
    const odometerRange = `${summary.startingOdometer.toFixed(0)} - ${summary.endingOdometer.toFixed(0)}`;
    
    return `${dateStr}: ${summary.totalMiles.toFixed(1)} miles (${summary.tripCount} trips) - Odometer: ${odometerRange}`;
  }
  
  /**
   * Get activities for a specific day (used for expense reports)
   */
  static getActivitiesForDay(summary: DailyMileageSummary): string[] {
    return summary.trips.map(trip => {
      const startTime = trip.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${startTime} - ${trip.purpose} (${trip.miles.toFixed(1)} mi)`;
    });
  }
}
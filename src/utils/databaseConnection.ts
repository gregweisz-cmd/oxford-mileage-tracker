/**
 * Database Connection Utility
 * 
 * This utility provides a direct database connection to avoid circular dependencies
 * between services and the main DatabaseService.
 */

import * as SQLite from 'expo-sqlite';

let databaseInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabaseConnection(): Promise<SQLite.SQLiteDatabase> {
  if (!databaseInstance) {
    try {
      databaseInstance = await SQLite.openDatabaseAsync('oxford_tracker.db');
      console.log('🔗 Database connection established');
    } catch (error) {
      console.error('❌ Error opening database:', error);
      throw error;
    }
  }
  return databaseInstance;
}

export function closeDatabaseConnection(): void {
  if (databaseInstance) {
    databaseInstance.closeAsync();
    databaseInstance = null;
    console.log('🔗 Database connection closed');
  }
}

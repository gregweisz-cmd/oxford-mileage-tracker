/**
 * Shared SQLite connection for services that cannot import DatabaseService directly.
 * Must use the same singleton as database.ts — a second openDatabaseAsync on the same
 * file causes "database is locked" / finalizeAsync failures during login and sync.
 */

import type * as SQLite from 'expo-sqlite';

export async function getDatabaseConnection(): Promise<SQLite.SQLiteDatabase> {
  const { getSharedDatabase } = await import('../services/database');
  return getSharedDatabase();
}

/** Run a block of SQLite work on the shared connection through the global queue. */
export async function withDatabaseConnection<T>(
  operation: (database: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const { withDatabase } = await import('../services/database');
  return withDatabase(operation);
}

export async function closeDatabaseConnection(): Promise<void> {
  // No-op: connection lifecycle is owned by database.ts
}

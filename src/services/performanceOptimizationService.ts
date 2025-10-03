/**
 * Performance Optimization Service
 * 
 * This service handles caching, query optimization, and performance
 * monitoring to ensure the app runs smoothly on mobile devices.
 */

import { getDatabaseConnection } from '../utils/databaseConnection';

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number; // Estimated size in bytes
}

export interface QueryOptimization {
  id: string;
  queryType: string;
  averageExecutionTime: number;
  optimizationSuggestions: string[];
  indexesUsed: string[];
  lastOptimized: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataAccessPattern {
  id: string;
  userId: string;
  dataType: 'mileage' | 'receipts' | 'employees' | 'reports' | 'locations';
  accessFrequency: 'high' | 'medium' | 'low';
  accessTimes: Date[];
  averageAccessInterval: number; // in minutes
  preferredAccessTime: string; // HH:MM format
  cacheHitRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoadingStrategy {
  id: string;
  userId: string;
  strategyType: 'lazy' | 'eager' | 'hybrid' | 'on_demand';
  preloadThreshold: number; // milliseconds
  batchSize: number;
  maxConcurrentRequests: number;
  retryAttempts: number;
  timeout: number; // milliseconds
  performance: {
    averageLoadTime: number;
    successRate: number;
    cacheHitRate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class PerformanceOptimizationService {
  private static cache = new Map<string, CacheEntry>();
  private static isInitialized = false;
  private static readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize the performance optimization tables
   */
  static async initializeTables(): Promise<void> {
    if (this.isInitialized) return;

    const db = await getDatabaseConnection();

    // Create query_optimizations table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS query_optimizations (
        id TEXT PRIMARY KEY,
        query_type TEXT NOT NULL,
        average_execution_time REAL NOT NULL,
        optimization_suggestions TEXT DEFAULT '[]',
        indexes_used TEXT DEFAULT '[]',
        last_optimized TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Create data_access_patterns table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS data_access_patterns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        data_type TEXT NOT NULL,
        access_frequency TEXT DEFAULT 'medium',
        access_times TEXT DEFAULT '[]',
        average_access_interval REAL DEFAULT 0,
        preferred_access_time TEXT DEFAULT '09:00',
        cache_hit_rate REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, data_type)
      );
    `);

    // Create loading_strategies table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS loading_strategies (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        strategy_type TEXT DEFAULT 'hybrid',
        preload_threshold INTEGER DEFAULT 1000,
        batch_size INTEGER DEFAULT 20,
        max_concurrent_requests INTEGER DEFAULT 3,
        retry_attempts INTEGER DEFAULT 3,
        timeout INTEGER DEFAULT 30000,
        performance TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id)
      );
    `);

    this.isInitialized = true;
    console.log('✅ Performance Optimization tables initialized');
  }

  // Cache Management Methods
  static setCache<T>(key: string, data: T, ttl: number = this.DEFAULT_CACHE_TTL): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl);
    
    const cacheEntry: CacheEntry<T> = {
      key,
      data,
      timestamp: now,
      expiresAt,
      accessCount: 0,
      lastAccessed: now,
      size: this.estimateSize(data)
    };

    this.cache.set(key, cacheEntry);
    this.cleanupExpiredEntries();
    this.enforceCacheSizeLimit();
  }

  static getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    
    return entry.data;
  }

  static clearCache(pattern?: string): void {
    if (pattern) {
      // Clear entries matching pattern
      for (const [key] of this.cache) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  static getCacheStats(): {
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    mostAccessed: string[];
  } {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    
    const mostAccessed = entries
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5)
      .map(entry => entry.key);

    return {
      totalEntries: entries.length,
      totalSize,
      hitRate: totalAccesses > 0 ? entries.filter(e => e.accessCount > 0).length / entries.length : 0,
      mostAccessed
    };
  }

  private static estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate
    } catch {
      return 1024; // Default size if can't estimate
    }
  }

  private static cleanupExpiredEntries(): void {
    const now = new Date();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private static enforceCacheSizeLimit(): void {
    const stats = this.getCacheStats();
    if (stats.totalSize > this.MAX_CACHE_SIZE) {
      // Remove least recently used entries
      const entries = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
      
      let removedSize = 0;
      for (const [key, entry] of entries) {
        this.cache.delete(key);
        removedSize += entry.size;
        
        if (stats.totalSize - removedSize <= this.MAX_CACHE_SIZE * 0.8) {
          break; // Keep 80% of max size
        }
      }
    }
  }

  // Query Optimization Methods
  static async recordQueryPerformance(queryType: string, executionTime: number, indexesUsed: string[] = []): Promise<void> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();

    // Get existing optimization record
    const existing = await db.getFirstAsync(
      'SELECT * FROM query_optimizations WHERE query_type = ?',
      [queryType]
    );

    if (existing) {
      // Update existing record with weighted average
      const newAverageTime = (existing.average_execution_time + executionTime) / 2;
      await db.runAsync(`
        UPDATE query_optimizations SET
          average_execution_time = ?,
          indexes_used = ?,
          last_optimized = ?,
          updated_at = ?
        WHERE query_type = ?
      `, [
        newAverageTime,
        JSON.stringify(indexesUsed),
        now,
        now,
        queryType
      ]);
    } else {
      // Create new record
      const id = `query_opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.runAsync(`
        INSERT INTO query_optimizations (
          id, query_type, average_execution_time, optimization_suggestions,
          indexes_used, last_optimized, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        queryType,
        executionTime,
        JSON.stringify([]),
        JSON.stringify(indexesUsed),
        now,
        now,
        now
      ]);
    }

    // Generate optimization suggestions
    await this.generateOptimizationSuggestions(queryType, executionTime);
  }

  static async getQueryOptimizations(): Promise<QueryOptimization[]> {
    const db = await getDatabaseConnection();
    const results = await db.getAllAsync('SELECT * FROM query_optimizations ORDER BY average_execution_time DESC');

    return results.map((row: any) => ({
      id: row.id,
      queryType: row.query_type,
      averageExecutionTime: row.average_execution_time,
      optimizationSuggestions: JSON.parse(row.optimization_suggestions || '[]'),
      indexesUsed: JSON.parse(row.indexes_used || '[]'),
      lastOptimized: new Date(row.last_optimized),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  private static async generateOptimizationSuggestions(queryType: string, executionTime: number): Promise<void> {
    const db = await getDatabaseConnection();
    const suggestions: string[] = [];

    if (executionTime > 1000) { // More than 1 second
      suggestions.push('Consider adding database indexes for better performance');
    }
    
    if (executionTime > 500) { // More than 500ms
      suggestions.push('Consider implementing query result caching');
    }
    
    if (executionTime > 200) { // More than 200ms
      suggestions.push('Consider pagination for large result sets');
    }

    if (suggestions.length > 0) {
      await db.runAsync(`
        UPDATE query_optimizations SET
          optimization_suggestions = ?,
          updated_at = ?
        WHERE query_type = ?
      `, [
        JSON.stringify(suggestions),
        new Date().toISOString(),
        queryType
      ]);
    }
  }

  // Data Access Pattern Methods
  static async recordDataAccess(userId: string, dataType: string, accessTime: Date = new Date()): Promise<void> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();

    const existing = await db.getFirstAsync(
      'SELECT * FROM data_access_patterns WHERE user_id = ? AND data_type = ?',
      [userId, dataType]
    );

    if (existing) {
      // Update existing pattern
      const accessTimes = JSON.parse(existing.access_times || '[]');
      accessTimes.push(accessTime.toISOString());
      
      // Keep only last 100 access times
      const recentAccessTimes = accessTimes.slice(-100);
      const averageInterval = this.calculateAverageInterval(recentAccessTimes);
      const preferredTime = this.calculatePreferredAccessTime(recentAccessTimes);
      
      await db.runAsync(`
        UPDATE data_access_patterns SET
          access_times = ?,
          average_access_interval = ?,
          preferred_access_time = ?,
          access_frequency = ?,
          updated_at = ?
        WHERE user_id = ? AND data_type = ?
      `, [
        JSON.stringify(recentAccessTimes),
        averageInterval,
        preferredTime,
        this.calculateAccessFrequency(averageInterval),
        now,
        userId,
        dataType
      ]);
    } else {
      // Create new pattern
      const id = `access_pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.runAsync(`
        INSERT INTO data_access_patterns (
          id, user_id, data_type, access_frequency, access_times,
          average_access_interval, preferred_access_time, cache_hit_rate,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        userId,
        dataType,
        'medium',
        JSON.stringify([accessTime.toISOString()]),
        0,
        '09:00',
        0,
        now,
        now
      ]);
    }
  }

  static async getDataAccessPatterns(userId: string): Promise<DataAccessPattern[]> {
    const db = await getDatabaseConnection();
    const results = await db.getAllAsync(
      'SELECT * FROM data_access_patterns WHERE user_id = ? ORDER BY average_access_interval DESC',
      [userId]
    );

    return results.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      dataType: row.data_type,
      accessFrequency: row.access_frequency,
      accessTimes: JSON.parse(row.access_times || '[]').map((time: string) => new Date(time)),
      averageAccessInterval: row.average_access_interval,
      preferredAccessTime: row.preferred_access_time,
      cacheHitRate: row.cache_hit_rate,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  private static calculateAverageInterval(accessTimes: string[]): number {
    if (accessTimes.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < accessTimes.length; i++) {
      const prev = new Date(accessTimes[i - 1]).getTime();
      const curr = new Date(accessTimes[i]).getTime();
      intervals.push(curr - prev);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length / (1000 * 60); // Convert to minutes
  }

  private static calculatePreferredAccessTime(accessTimes: string[]): string {
    if (accessTimes.length === 0) return '09:00';
    
    const hours = accessTimes.map(time => new Date(time).getHours());
    const hourCounts = hours.reduce((counts, hour) => {
      counts[hour] = (counts[hour] || 0) + 1;
      return counts;
    }, {} as Record<number, number>);
    
    const mostCommonHour = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    return mostCommonHour ? `${mostCommonHour.padStart(2, '0')}:00` : '09:00';
  }

  private static calculateAccessFrequency(averageInterval: number): 'high' | 'medium' | 'low' {
    if (averageInterval < 30) return 'high'; // Less than 30 minutes
    if (averageInterval < 120) return 'medium'; // Less than 2 hours
    return 'low'; // More than 2 hours
  }

  // Loading Strategy Methods
  static async getOptimalLoadingStrategy(userId: string): Promise<LoadingStrategy> {
    const db = await getDatabaseConnection();
    const result = await db.getFirstAsync(
      'SELECT * FROM loading_strategies WHERE user_id = ?',
      [userId]
    );

    if (result) {
      return {
        id: result.id,
        userId: result.user_id,
        strategyType: result.strategy_type,
        preloadThreshold: result.preload_threshold,
        batchSize: result.batch_size,
        maxConcurrentRequests: result.max_concurrent_requests,
        retryAttempts: result.retry_attempts,
        timeout: result.timeout,
        performance: JSON.parse(result.performance || '{}'),
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at)
      };
    }

    // Return default strategy
    return {
      id: 'default_strategy',
      userId,
      strategyType: 'hybrid',
      preloadThreshold: 1000,
      batchSize: 20,
      maxConcurrentRequests: 3,
      retryAttempts: 3,
      timeout: 30000,
      performance: {
        averageLoadTime: 0,
        successRate: 100,
        cacheHitRate: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  static async updateLoadingStrategy(userId: string, strategy: Partial<LoadingStrategy>): Promise<LoadingStrategy> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();

    const existing = await this.getOptimalLoadingStrategy(userId);
    
    if (existing.id !== 'default_strategy') {
      // Update existing strategy
      await db.runAsync(`
        UPDATE loading_strategies SET
          strategy_type = COALESCE(?, strategy_type),
          preload_threshold = COALESCE(?, preload_threshold),
          batch_size = COALESCE(?, batch_size),
          max_concurrent_requests = COALESCE(?, max_concurrent_requests),
          retry_attempts = COALESCE(?, retry_attempts),
          timeout = COALESCE(?, timeout),
          performance = COALESCE(?, performance),
          updated_at = ?
        WHERE user_id = ?
      `, [
        strategy.strategyType || null,
        strategy.preloadThreshold || null,
        strategy.batchSize || null,
        strategy.maxConcurrentRequests || null,
        strategy.retryAttempts || null,
        strategy.timeout || null,
        strategy.performance ? JSON.stringify(strategy.performance) : null,
        now,
        userId
      ]);
    } else {
      // Create new strategy
      const id = `loading_strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.runAsync(`
        INSERT INTO loading_strategies (
          id, user_id, strategy_type, preload_threshold, batch_size,
          max_concurrent_requests, retry_attempts, timeout, performance,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        userId,
        strategy.strategyType || 'hybrid',
        strategy.preloadThreshold || 1000,
        strategy.batchSize || 20,
        strategy.maxConcurrentRequests || 3,
        strategy.retryAttempts || 3,
        strategy.timeout || 30000,
        JSON.stringify(strategy.performance || {}),
        now,
        now
      ]);
    }

    return await this.getOptimalLoadingStrategy(userId);
  }

  /**
   * Get performance recommendations based on current patterns
   */
  static async getPerformanceRecommendations(userId: string): Promise<{
    cachingSuggestions: string[];
    queryOptimizations: string[];
    loadingStrategyImprovements: string[];
    batteryOptimizations: string[];
  }> {
    const accessPatterns = await this.getDataAccessPatterns(userId);
    const queryOptimizations = await this.getQueryOptimizations();
    const loadingStrategy = await this.getOptimalLoadingStrategy(userId);
    const cacheStats = this.getCacheStats();

    const recommendations = {
      cachingSuggestions: [] as string[],
      queryOptimizations: [] as string[],
      loadingStrategyImprovements: [] as string[],
      batteryOptimizations: [] as string[]
    };

    // Caching suggestions
    if (cacheStats.hitRate < 0.5) {
      recommendations.cachingSuggestions.push('Increase cache TTL for better hit rates');
    }
    
    if (cacheStats.totalSize > this.MAX_CACHE_SIZE * 0.8) {
      recommendations.cachingSuggestions.push('Consider clearing unused cache entries');
    }

    // Query optimization suggestions
    const slowQueries = queryOptimizations.filter(q => q.averageExecutionTime > 500);
    if (slowQueries.length > 0) {
      recommendations.queryOptimizations.push(`${slowQueries.length} queries are running slowly and need optimization`);
    }

    // Loading strategy improvements
    if (loadingStrategy.strategyType === 'eager' && loadingStrategy.performance.averageLoadTime > 2000) {
      recommendations.loadingStrategyImprovements.push('Consider switching to lazy loading for better performance');
    }

    if (loadingStrategy.batchSize > 50) {
      recommendations.loadingStrategyImprovements.push('Reduce batch size to improve responsiveness');
    }

    // Battery optimizations
    const highFrequencyPatterns = accessPatterns.filter(p => p.accessFrequency === 'high');
    if (highFrequencyPatterns.length > 3) {
      recommendations.batteryOptimizations.push('Consider reducing data access frequency for better battery life');
    }

    return recommendations;
  }

  /**
   * Preload frequently accessed data based on user patterns
   */
  static async preloadFrequentData(userId: string): Promise<void> {
    const accessPatterns = await this.getDataAccessPatterns(userId);
    const highFrequencyTypes = accessPatterns
      .filter(pattern => pattern.accessFrequency === 'high')
      .map(pattern => pattern.dataType);

    console.log('🚀 Performance Optimization: Preloading high-frequency data types:', highFrequencyTypes);
    
    // This would integrate with the actual data loading services
    // For now, we'll just log the preloading strategy
    for (const dataType of highFrequencyTypes) {
      console.log(`📦 Preloading ${dataType} data for user ${userId}`);
    }
  }
}

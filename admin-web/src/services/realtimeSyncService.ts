// import { Employee, MileageEntry, Receipt, TimeTracking } from '../types'; // Types available but currently unused
import { debugLog, debugError, debugWarn, debugVerbose } from '../config/debug';

export interface RealtimeUpdate {
  type: 'employee' | 'mileage' | 'receipt' | 'time_tracking';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  employeeId?: string;
}

export interface RealtimeSyncConfig {
  enabled: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

export class RealtimeSyncService {
  private static instance: RealtimeSyncService;
  private ws: WebSocket | null = null;
  private config: RealtimeSyncConfig = {
    enabled: false,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000
  };
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Array<(update: RealtimeUpdate) => void>> = new Map();
  private isConnected = false;

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): RealtimeSyncService {
    if (!RealtimeSyncService.instance) {
      RealtimeSyncService.instance = new RealtimeSyncService();
    }
    return RealtimeSyncService.instance;
  }

  /**
   * Initialize real-time sync
   */
  async initialize(): Promise<void> {
    try {
      debugLog('🔄 RealtimeSync: Initializing real-time sync service...');
      
      // Check if WebSocket is supported
      if (typeof WebSocket === 'undefined') {
        debugWarn('⚠️ RealtimeSync: WebSocket not supported in this environment');
        return;
      }

      // Enable real-time sync
      this.config.enabled = true;
      
      // Connect to WebSocket server
      await this.connect();
      
      debugLog('✅ RealtimeSync: Real-time sync service initialized');
    } catch (error) {
      debugError('❌ RealtimeSync: Failed to initialize:', error);
    }
  }

  /**
   * Connect to WebSocket server.
   * Resolves even on failure so the app works when WS is unavailable (e.g. Render free tier).
   */
  private async connect(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const wsUrl = this.getWebSocketUrl();
        debugLog(`🔄 RealtimeSync: Connecting to ${wsUrl}`);

        const connectionTimeout = window.setTimeout(() => {
          if (!this.isConnected) {
            debugWarn('⚠️ RealtimeSync: Connection timeout; continuing without real-time sync.');
            resolve();
          }
        }, 8000);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          window.clearTimeout(connectionTimeout);
          debugLog('✅ RealtimeSync: Connected to WebSocket server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          debugVerbose('🔌 RealtimeSync: WebSocket connection closed:', event.code, event.reason);
          this.isConnected = false;
          this.stopHeartbeat();
          window.clearTimeout(connectionTimeout);
          if (this.config.enabled && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = () => {
          debugWarn('⚠️ RealtimeSync: WebSocket error; app will work without real-time sync.');
          window.clearTimeout(connectionTimeout);
          resolve();
        };
      } catch (error) {
        debugWarn('⚠️ RealtimeSync: Failed to connect:', error);
        resolve();
      }
    });
  }

  /**
   * Get WebSocket URL based on environment
   */
  private getWebSocketUrl(): string {
    const isDev = process.env.NODE_ENV === 'development' || 
                  window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1';
    
    if (isDev) {
      return 'ws://localhost:3002/ws';
    } else {
      // Production WebSocket URL (Render.com)
      const baseUrl = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
      return baseUrl.replace('http', 'ws').replace('https', 'wss') + '/ws';
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'heartbeat':
          // Respond to heartbeat
          this.send({ type: 'heartbeat_response' });
          break;
          
        case 'heartbeat_response':
        case 'connection_established':
          debugLog('✅ RealtimeSync: Connection established by server');
          // Server acknowledgments - no action needed
          break;
          
        case 'data_update':
        case 'data_updated':  // Handle both types for backward compatibility
          // Some messages have data, others are just notifications
          if (message.data) {
            this.handleDataUpdate(message.data);
          } else {
            // This is a notification-style message without data payload
            // It's just telling us something changed, not what changed
            debugLog('🔄 RealtimeSync: Received change notification:', message);
            // Could trigger a refresh here if needed
          }
          break;
          
        case 'sync_request':
          this.handleSyncRequest(message.data);
          break;
          
        default:
          debugVerbose('🔄 RealtimeSync: Unknown message type:', message.type);
      }
    } catch (error) {
      debugError('❌ RealtimeSync: Error parsing message:', error);
    }
  }

  /**
   * Handle data updates from server
   */
  private handleDataUpdate(update: RealtimeUpdate): void {
    debugLog('🔄 RealtimeSync: Received data update:', update);
    
    // Skip if update is undefined or missing type
    if (!update || !update.type) {
      debugWarn('⚠️ RealtimeSync: Skipping invalid update:', update);
      return;
    }
    
    // Notify all listeners for this data type
    const listeners = this.listeners.get(update.type) || [];
    listeners.forEach(listener => {
      try {
        listener(update);
      } catch (error) {
        debugError('❌ RealtimeSync: Error in listener:', error);
      }
    });
  }

  /**
   * Handle sync request from server
   */
  private handleSyncRequest(data: any): void {
    debugVerbose('🔄 RealtimeSync: Received sync request:', data);
    // Trigger a data refresh
    this.requestDataRefresh(data.entityType, data.employeeId);
  }

  /**
   * Send message to WebSocket server
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      debugWarn('⚠️ RealtimeSync: Cannot send message, WebSocket not connected');
    }
  }

  /**
   * Subscribe to real-time updates for a specific data type
   */
  subscribe(dataType: string, listener: (update: RealtimeUpdate) => void): () => void {
    if (!this.listeners.has(dataType)) {
      this.listeners.set(dataType, []);
    }
    
    this.listeners.get(dataType)!.push(listener);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(dataType);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Request data refresh from server
   */
  requestDataRefresh(entityType: string, employeeId?: string): void {
    this.send({
      type: 'refresh_request',
      data: {
        entityType,
        employeeId,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Notify server of local data changes
   */
  notifyDataChange(update: RealtimeUpdate): void {
    this.send({
      type: 'data_change',
      data: update
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'heartbeat' });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    debugVerbose(`🔄 RealtimeSync: Scheduling reconnect attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
    
    setTimeout(() => {
      if (this.config.enabled) {
        this.connect().catch(error => {
          debugError('❌ RealtimeSync: Reconnect failed:', error);
        });
      }
    }, this.config.reconnectInterval);
  }

  /**
   * Setup event listeners for page visibility and online/offline
   */
  private setupEventListeners(): void {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        debugVerbose('🔄 RealtimeSync: Page hidden, pausing sync');
      } else {
        debugVerbose('🔄 RealtimeSync: Page visible, resuming sync');
        if (!this.isConnected && this.config.enabled) {
          this.connect().catch(error => {
            debugError('❌ RealtimeSync: Failed to reconnect:', error);
          });
        }
      }
    });

    // Handle online/offline events
    window.addEventListener('online', () => {
      debugVerbose('🔄 RealtimeSync: Network online, attempting to reconnect');
      if (!this.isConnected && this.config.enabled) {
        this.connect().catch(error => {
          debugError('❌ RealtimeSync: Failed to reconnect:', error);
        });
      }
    });

    window.addEventListener('offline', () => {
      debugVerbose('🔄 RealtimeSync: Network offline, connection will be lost');
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    debugVerbose('🔄 RealtimeSync: Disconnecting...');
    this.config.enabled = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.listeners.clear();
  }

  /**
   * Enable or disable real-time sync
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    if (enabled && !this.isConnected) {
      this.connect().catch(error => {
        debugError('❌ RealtimeSync: Failed to connect:', error);
      });
    } else if (!enabled && this.isConnected) {
      this.disconnect();
    }
  }
}

// Export singleton instance
export const realtimeSyncService = RealtimeSyncService.getInstance();

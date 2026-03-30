import { Alert } from 'react-native';
import { debugLog, debugError, debugWarn } from '../config/debug';

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
}

export interface DataUpdateMessage {
  type: 'data_update';
  data: {
    type: string;
    action: string;
    data: any;
    timestamp: string;
    employeeId?: string;
  };
}

export interface NotificationMessage {
  type: 'notification';
  data: {
    title: string;
    message: string;
    timestamp: string;
    employeeId?: string;
  };
}

export interface ConnectionMessage {
  type: 'connection_established' | 'heartbeat_response';
  timestamp: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type WebSocketEventType = 
  | 'data_update'
  | 'notification'
  | 'connection_established'
  | 'heartbeat_response'
  | 'error';

/** Wait for bursts of data_update to settle before push+pull (reduces duplicate work and 429s). */
const DATA_UPDATE_SYNC_DEBOUNCE_MS = 4500;

export class RealtimeSyncService {
  private static instance: RealtimeSyncService;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentEmployeeId: string | null = null;
  private eventListeners: Map<WebSocketEventType, ((data: any) => void)[]> = new Map();
  private dataUpdateSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private dataUpdateSyncInProgress = false;

  private constructor() {
    this.initializeEventListeners();
  }

  public static getInstance(): RealtimeSyncService {
    if (!RealtimeSyncService.instance) {
      RealtimeSyncService.instance = new RealtimeSyncService();
    }
    return RealtimeSyncService.instance;
  }

  public static initialize(): void {
    // Get the instance to initialize it
    RealtimeSyncService.getInstance();
    debugLog('✅ RealtimeSyncService: Initialized (ready for connection)');
  }

  private initializeEventListeners(): void {
    // Initialize event listener maps
    const eventTypes: WebSocketEventType[] = [
      'data_update',
      'notification', 
      'connection_established',
      'heartbeat_response',
      'error'
    ];
    
    eventTypes.forEach(eventType => {
      this.eventListeners.set(eventType, []);
    });
  }

  public connect(baseUrl: string, employeeId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      debugLog('📡 WebSocket already connected');
      return;
    }

    this.currentEmployeeId = employeeId;
    
    // Remove /api suffix if present, then convert to WebSocket URL
    const cleanBaseUrl = baseUrl.replace(/\/api$/, '');
    const wsUrl = cleanBaseUrl.replace('http', 'ws') + '/ws';
    
    debugLog('📡 Connecting to WebSocket:', wsUrl);
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      this.handleReconnect(baseUrl, employeeId);
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      debugLog('✅ WebSocket connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('❌ WebSocket message parsing error:', error);
      }
    };

    this.ws.onclose = (event) => {
      debugLog('🔌 WebSocket disconnected:', event.code, event.reason);
      this.stopHeartbeat();
      
      // Note: Reconnection is handled by the caller with the correct baseUrl
      // We don't reconnect here because we don't have access to the correct baseUrl
    };

    this.ws.onerror = (error) => {
      // WebSocket errors are common in development (Metro bundler, network issues)
      // Use debugWarn instead of console.error to reduce noise
      debugWarn('⚠️ WebSocket error (this is often expected in development):', error);
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    debugLog('📨 WebSocket message received:', message.type);

    switch (message.type) {
      case 'connection_established':
        this.emit('connection_established', message);
        break;
        
      case 'heartbeat_response':
        this.emit('heartbeat_response', message);
        break;
        
      case 'data_update':
        this.handleDataUpdate(message as DataUpdateMessage);
        break;
        
      case 'notification':
        this.handleNotification(message as NotificationMessage);
        break;
        
      case 'error':
        this.handleError(message as ErrorMessage);
        break;
        
      default:
        debugLog('🔄 Unknown WebSocket message type:', message.type);
    }
  }

  private handleDataUpdate(message: DataUpdateMessage): void {
    const { data } = message;

    if (data.employeeId && this.currentEmployeeId) {
      void this.whenSameEmployeeAsCurrent(data.employeeId, () => {
        this.deliverDataUpdate(data);
      });
      return;
    }

    this.deliverDataUpdate(data);
  }

  /** Backend WebSocket uses canonical employee id; app may still use local SQLite id — treat as same after resolve. */
  private async whenSameEmployeeAsCurrent(
    messageEmployeeId: string,
    onMatch: () => void
  ): Promise<void> {
    if (!this.currentEmployeeId) return;
    if (messageEmployeeId === this.currentEmployeeId) {
      onMatch();
      return;
    }
    try {
      const { ApiSyncService } = await import('./apiSyncService');
      const [a, b] = await Promise.all([
        ApiSyncService.resolveBackendEmployeeId(this.currentEmployeeId),
        ApiSyncService.resolveBackendEmployeeId(messageEmployeeId),
      ]);
      const ca = a ?? this.currentEmployeeId;
      const cb = b ?? messageEmployeeId;
      if (ca === cb) {
        onMatch();
        return;
      }
    } catch {
      // fall through to ignore
    }
    debugLog('📡 Ignoring data update for different employee:', messageEmployeeId);
  }

  private deliverDataUpdate(data: DataUpdateMessage['data']): void {
    debugLog(`📡 Data update: ${data.type} ${data.action}`, data.data);
    
    this.emit('data_update', data);

    this.triggerSyncIfNeeded(data);
  }

  private handleNotification(message: NotificationMessage): void {
    const { data } = message;

    if (data.employeeId && this.currentEmployeeId) {
      void this.whenSameEmployeeAsCurrent(data.employeeId, () => {
        this.deliverNotification(data);
      });
      return;
    }

    this.deliverNotification(data);
  }

  private deliverNotification(data: NotificationMessage['data']): void {
    debugLog(`📢 Notification: ${data.title} - ${data.message}`);
    
    Alert.alert(data.title, data.message);

    this.emit('notification', data);
  }

  private handleError(message: ErrorMessage): void {
    console.error('❌ WebSocket error message:', message.message);
    this.emit('error', message);
  }

  private triggerSyncIfNeeded(data: any): void {
    if (!this.currentEmployeeId) return;
    // Debounce rapid data_update messages so we run push-then-pull once after activity settles
    if (this.dataUpdateSyncTimer) {
      clearTimeout(this.dataUpdateSyncTimer);
    }
    const runPushThenPull = async () => {
      if (this.dataUpdateSyncInProgress) return;
      this.dataUpdateSyncInProgress = true;
      this.dataUpdateSyncTimer = null;
      try {
        debugLog('🔄 Triggering sync due to real-time update (push then pull)');
        const { SyncIntegrationService } = await import('./syncIntegrationService');
        const { ApiSyncService } = await import('./apiSyncService');
        await SyncIntegrationService.processSyncQueue();
        await ApiSyncService.syncFromBackend(this.currentEmployeeId, undefined, {
          skipSyncQueue: true,
          realtimePullThrottle: true
        });
      } catch (error) {
        console.error('❌ Error syncing after real-time update:', error);
      } finally {
        this.dataUpdateSyncInProgress = false;
      }
    };
    this.dataUpdateSyncTimer = setTimeout(runPushThenPull, DATA_UPDATE_SYNC_DEBOUNCE_MS);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        }));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleReconnect(baseUrl: string, employeeId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    debugLog(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      this.connect(baseUrl, employeeId);
    }, this.reconnectDelay);
    
    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  public disconnect(): void {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.currentEmployeeId = null;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
  }

  public on(eventType: WebSocketEventType, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(callback);
    this.eventListeners.set(eventType, listeners);
  }

  public off(eventType: WebSocketEventType, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(eventType) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(eventType, listeners);
    }
  }

  private emit(eventType: WebSocketEventType, data: any): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ Error in WebSocket event listener for ${eventType}:`, error);
      }
    });
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }
}

export default RealtimeSyncService;
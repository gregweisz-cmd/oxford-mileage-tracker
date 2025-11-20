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

export class RealtimeSyncService {
  private static instance: RealtimeSyncService;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentEmployeeId: string | null = null;
  private eventListeners: Map<WebSocketEventType, ((data: any) => void)[]> = new Map();

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
    
    // Only process updates for the current employee or global updates
    if (data.employeeId && data.employeeId !== this.currentEmployeeId) {
      debugLog('📡 Ignoring data update for different employee:', data.employeeId);
      return;
    }

    debugLog(`📡 Data update: ${data.type} ${data.action}`, data.data);
    
    // Emit the data update event
    this.emit('data_update', data);
    
    // Trigger sync if needed
    this.triggerSyncIfNeeded(data);
  }

  private handleNotification(message: NotificationMessage): void {
    const { data } = message;
    
    // Only show notifications for the current employee or global notifications
    if (data.employeeId && data.employeeId !== this.currentEmployeeId) {
      debugLog('📡 Ignoring notification for different employee:', data.employeeId);
      return;
    }

    debugLog(`📢 Notification: ${data.title} - ${data.message}`);
    
    // Show native notification
    Alert.alert(data.title, data.message);
    
    // Emit the notification event
    this.emit('notification', data);
  }

  private handleError(message: ErrorMessage): void {
    console.error('❌ WebSocket error message:', message.message);
    this.emit('error', message);
  }

  private triggerSyncIfNeeded(data: any): void {
    // Import ApiSyncService dynamically to avoid circular dependencies
    import('./apiSyncService').then(({ ApiSyncService }) => {
      if (this.currentEmployeeId) {
        debugLog('🔄 Triggering sync due to real-time update');
        ApiSyncService.syncFromBackend(this.currentEmployeeId).catch(error => {
          console.error('❌ Error syncing after real-time update:', error);
        });
      }
    });
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
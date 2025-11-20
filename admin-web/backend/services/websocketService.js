/**
 * WebSocket Service
 * Manages WebSocket connections and real-time communication
 * Extracted from server.js for better organization
 */

const WebSocket = require('ws');
const { debugLog, debugError } = require('../debug');

// WebSocket clients management
const connectedClients = new Set();

/**
 * Initialize WebSocket service with the WebSocket server instance
 * @param {WebSocket.Server} wss - WebSocket server instance
 */
function initializeWebSocket(wss) {
  // WebSocket connection handling
  wss.on('connection', (ws, req) => {
    debugLog('🔌 WebSocket client connected from:', req.headers.origin);
    connectedClients.add(ws);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection_established',
      timestamp: new Date().toISOString()
    }));
    
    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'heartbeat_response',
          timestamp: new Date().toISOString()
        }));
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleWebSocketMessage(ws, data);
      } catch (error) {
        debugError('❌ WebSocket message parsing error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    ws.on('close', () => {
      debugLog('🔌 WebSocket client disconnected');
      connectedClients.delete(ws);
      clearInterval(heartbeat);
    });
    
    ws.on('error', (error) => {
      debugError('❌ WebSocket error:', error);
      connectedClients.delete(ws);
      clearInterval(heartbeat);
    });
  });
}

/**
 * Handle WebSocket messages
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} data - Message data
 */
function handleWebSocketMessage(ws, data) {
  switch (data.type) {
    case 'heartbeat':
      ws.send(JSON.stringify({ type: 'heartbeat_response' }));
      break;
      
    case 'refresh_request':
      handleRefreshRequest(ws, data.data);
      break;
      
    case 'data_change':
      handleDataChangeNotification(data.data);
      break;
      
    default:
      debugLog('🔄 Unknown WebSocket message type:', data.type);
  }
}

/**
 * Handle refresh requests
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} requestData - Request data
 */
function handleRefreshRequest(ws, requestData) {
  debugLog('🔄 Handling refresh request:', requestData);
  
  // Send refresh notification to all clients
  broadcastToClients({
    type: 'sync_request',
    data: requestData
  });
}

/**
 * Handle data change notifications
 * @param {Object} updateData - Update data
 */
function handleDataChangeNotification(updateData) {
  debugLog('🔄 Broadcasting data change:', updateData);
  
  // Broadcast update to all connected clients
  broadcastToClients({
    type: 'data_update',
    data: updateData
  });
}

/**
 * Broadcast data change with convenience parameters
 * @param {string} type - Type of data change (e.g., 'mileage_entry', 'receipt')
 * @param {string} action - Action performed (e.g., 'create', 'update', 'delete')
 * @param {Object} data - Data object
 * @param {string|null} employeeId - Optional employee ID
 */
function broadcastDataChange(type, action, data, employeeId = null) {
  const update = {
    type,
    action,
    data,
    timestamp: new Date(),
    employeeId
  };
  
  handleDataChangeNotification(update);
}

/**
 * Broadcast message to all connected clients
 * @param {Object} message - Message to broadcast
 */
function broadcastToClients(message) {
  const messageStr = JSON.stringify(message);
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
      } catch (error) {
        debugError('❌ Error sending WebSocket message:', error);
        connectedClients.delete(client);
      }
    }
  });
}

/**
 * Get number of connected clients
 * @returns {number} Number of connected clients
 */
function getConnectedClientsCount() {
  return connectedClients.size;
}

module.exports = {
  initializeWebSocket,
  broadcastToClients,
  handleDataChangeNotification,
  broadcastDataChange,
  getConnectedClientsCount,
};


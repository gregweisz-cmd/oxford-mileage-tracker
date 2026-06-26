/**
 * WebSocket Service
 * Manages WebSocket connections and real-time communication
 * Extracted from server.js for better organization
 */

const WebSocket = require('ws');
const { debugLog, debugError } = require('../debug');
const { verifyAuthToken, getEffectiveRole } = require('../middleware/auth');

// WebSocket clients management
const connectedClients = new Set();

// Roles that are allowed to receive data-change events for employees other than themselves.
// (Regular employees only ever receive events for their own data; unauthenticated sockets receive none.)
const ELEVATED_ROLES = new Set(['admin', 'finance', 'contracts', 'supervisor', 'senior_staff']);

/**
 * Authenticate an incoming WebSocket upgrade using a `token` query-string parameter.
 * Browsers cannot set custom headers on a WebSocket handshake, so the signed JWT is passed in the URL.
 * @returns {{ employeeId: string, role: string }|null} auth context, or null when unauthenticated
 */
function authenticateConnection(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const verified = verifyAuthToken(token);
    if (!verified || !verified.employeeId) return null;
    const role = getEffectiveRole({
      email: verified.payload && verified.payload.email,
      role: verified.payload && verified.payload.role,
    });
    return { employeeId: verified.employeeId, role };
  } catch (error) {
    return null;
  }
}

/**
 * Decide whether a connected client may receive a data-change event for a given owner employee.
 * @param {{ employeeId: string, role: string }|null} auth - the client's auth context
 * @param {string|null} ownerEmployeeId - employee the changed data belongs to
 */
function clientMayReceive(auth, ownerEmployeeId) {
  if (!auth) return false; // unauthenticated sockets never receive data events
  if (ownerEmployeeId && auth.employeeId === ownerEmployeeId) return true; // own data
  return ELEVATED_ROLES.has(auth.role); // reviewers/admins may receive others' events
}

/**
 * Initialize WebSocket service with the WebSocket server instance
 * @param {WebSocket.Server} wss - WebSocket server instance
 */
function initializeWebSocket(wss) {
  // WebSocket connection handling
  wss.on('connection', (ws, req) => {
    ws.authContext = authenticateConnection(req);
    debugLog(
      `🔌 WebSocket client connected from: ${req.headers.origin} (${ws.authContext ? `auth=${ws.authContext.role}` : 'unauthenticated'})`
    );
    connectedClients.add(ws);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection_established',
      authenticated: !!ws.authContext,
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
  const ownerEmployeeId =
    (updateData && (updateData.employeeId || (updateData.data && updateData.data.employeeId))) || null;
  debugLog('🔄 Broadcasting data change for employee:', ownerEmployeeId || '(unknown)');

  // Deliver only to the owning employee's sockets and to elevated-role reviewers/admins.
  const message = JSON.stringify({ type: 'data_update', data: updateData });
  let delivered = 0;
  connectedClients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (!clientMayReceive(client.authContext, ownerEmployeeId)) return;
    try {
      client.send(message);
      delivered += 1;
    } catch (error) {
      debugError('❌ Error sending WebSocket data_update:', error);
      connectedClients.delete(client);
    }
  });
  debugLog(`📤 data_update delivered to ${delivered} client(s)`);
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


# Mobile App Data Sync

This document explains how the mobile app data sync works with the web portal backend.

## Overview

The mobile app now includes a comprehensive data synchronization system that allows seamless data flow between the mobile app and the web portal. Data entered in the mobile app is automatically synced to the backend API, and data from the web portal can be downloaded to the mobile app.

## Architecture

### Components

1. **ApiSyncService** - Handles direct API communication with the backend
2. **SyncIntegrationService** - Manages sync queue and batch processing
3. **SyncManager** - UI component for manual sync operations
4. **SyncStatusBar** - Status indicator for sync state
5. **DatabaseService** - Updated to queue sync operations

### Data Flow

```
Mobile App Database → Sync Queue → API Sync Service → Backend API
                                                      ↓
Web Portal ← Backend API ← API Sync Service ← Sync Queue ← Mobile App Database
```

## Features

### Automatic Sync
- Data changes are automatically queued for sync
- Batch processing every 30 seconds
- Retry mechanism for failed operations
- Connection status monitoring

### Manual Sync
- Force sync all data to backend
- Download data from backend
- Test connection to backend API
- Clear sync queue

### Status Monitoring
- Real-time sync status
- Pending changes counter
- Queue length monitoring
- Connection status indicator

## Usage

### Adding Sync to Your App

1. **Add Sync Status Bar to Main Screen**
```tsx
import { SyncStatusBar } from '../components/SyncStatusBar';

// In your main screen component
<SyncStatusBar 
  onPress={() => navigation.navigate('SyncManager')}
  showDetails={true}
/>
```

2. **Add Sync Manager Screen**
```tsx
import { SyncManager } from '../components/SyncManager';

// In your navigation stack
<Stack.Screen 
  name="SyncManager" 
  component={SyncManager} 
  options={{ title: 'Data Sync' }}
/>
```

3. **Initialize Sync Service**
```tsx
import { DatabaseService } from '../services/database';

// In your app initialization
useEffect(() => {
  DatabaseService.initDatabase(); // This will also initialize sync
}, []);
```

### Configuration

The sync service can be configured by updating the API base URL:

```tsx
import { ApiSyncService } from '../services/apiSyncService';

// Update API configuration
ApiSyncService.updateConfig({
  baseUrl: 'http://your-backend-url:3002/api',
  timeout: 15000,
  retryAttempts: 5
});
```

### Sync Operations

#### Automatic Sync
Data is automatically synced when:
- New mileage entries are created
- Receipts are added
- Time tracking entries are created
- Employee data is updated

#### Manual Sync
Users can manually trigger sync operations:
- **Sync to Backend**: Upload all mobile data to web portal
- **Sync from Backend**: Download data from web portal
- **Test Connection**: Verify backend connectivity

## API Endpoints

The sync service communicates with these backend endpoints:

- `GET /api/employees` - Fetch all employees
- `POST /api/employees` - Create employee
- `PUT /api/employees/:id` - Update employee
- `GET /api/mileage-entries` - Fetch mileage entries
- `POST /api/mileage-entries` - Create mileage entry
- `GET /api/receipts` - Fetch receipts
- `POST /api/receipts` - Create receipt
- `GET /api/time-tracking` - Fetch time tracking
- `POST /api/time-tracking` - Create time tracking
- `GET /api/stats` - Get sync statistics

## Error Handling

### Connection Issues
- Automatic retry with exponential backoff
- Offline mode support
- Queue persistence for retry when connection restored

### Sync Failures
- Individual operation retry (max 3 attempts)
- Failed operations logged for debugging
- User notification of sync status

### Data Conflicts
- Last-write-wins strategy
- Timestamp-based conflict resolution
- Manual conflict resolution via sync manager

## Troubleshooting

### Common Issues

1. **"Backend API not available"**
   - Check if backend server is running on port 3002
   - Verify network connectivity
   - Check firewall settings

2. **"Sync failed: Network error"**
   - Check internet connection
   - Verify backend URL configuration
   - Try manual sync from sync manager

3. **"Data not appearing in web portal"**
   - Check sync queue status
   - Verify employee ID matches
   - Check backend logs for errors

### Debug Information

Enable debug logging by checking console output:
- `🔄 SyncIntegration:` - Sync queue operations
- `📤 ApiSync:` - Backend sync operations
- `📥 ApiSync:` - Backend fetch operations
- `❌ ApiSync:` - Sync errors

## Performance Considerations

### Batch Processing
- Operations are batched by entity type
- Reduces API calls and improves performance
- Configurable batch size and interval

### Offline Support
- Data is queued when offline
- Automatic sync when connection restored
- No data loss during network outages

### Memory Management
- Sync queue has size limits
- Old operations are cleaned up automatically
- Efficient data serialization

## Security

### Data Protection
- All API calls use HTTPS in production
- Sensitive data is not logged
- Authentication tokens handled securely

### Network Security
- API endpoints require proper authentication
- CORS configured for mobile app domains
- Rate limiting to prevent abuse

## Future Enhancements

### Planned Features
- Real-time sync with WebSocket connections
- Conflict resolution UI
- Sync progress indicators
- Data compression for large datasets
- Background sync optimization

### Integration Points
- Push notifications for sync status
- Cloud storage integration
- Multi-device sync support
- Advanced conflict resolution strategies

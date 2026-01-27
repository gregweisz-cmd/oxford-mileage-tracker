# Backend-First Architecture Plan

## Current Problem
- Mobile app stores data locally first, then syncs to backend
- Web portal reads from backend
- Conflicts occur when data is out of sync
- Duplicate entries, deleted items reappearing, hours not matching

## New Architecture: Backend as Single Source of Truth

### Core Principle
**Backend API is the ONLY source of truth. Both mobile app and web portal read from and write directly to backend.**

### Data Flow

#### Reading Data
```
Mobile App Screen Loads
    ↓
Fetch from Backend API
    ↓
Display in UI
    ↓
(Optional: Cache locally for offline viewing)
```

#### Writing Data
```
User Action (Save/Delete)
    ↓
Write directly to Backend API
    ↓
Backend saves to database
    ↓
Return success/error
    ↓
Refresh UI from backend
```

### Changes Required

1. **Create BackendDataService**
   - New service that reads directly from backend API
   - Replaces DatabaseService for all data operations
   - Handles authentication, error handling, retries

2. **Modify All Screens**
   - Replace `DatabaseService.getX()` with `BackendDataService.getX()`
   - Replace `DatabaseService.saveX()` with `BackendDataService.saveX()`
   - Remove local-first save logic

3. **Keep Local Database for**
   - Offline caching (read-only)
   - User preferences
   - Session management
   - NOT for primary data storage

4. **Remove Sync Logic**
   - No more `syncToBackend()` / `syncFromBackend()`
   - No more sync queues
   - No more conflict resolution
   - Direct API calls only

### Benefits
- ✅ Single source of truth (backend)
- ✅ No sync conflicts
- ✅ Data always consistent
- ✅ Simpler codebase
- ✅ Easier debugging

### Migration Steps
1. Create BackendDataService
2. Update one screen at a time
3. Test thoroughly
4. Remove old sync code
5. Clean up local database usage

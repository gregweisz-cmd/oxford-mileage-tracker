# Server.js Refactoring Plan

## Current State
- **File Size**: 13,651 lines
- **Routes**: 99+ API endpoints
- **Risk**: Single point of failure, difficult to maintain

## Proposed Structure

```
backend/
├── server.js (main entry point, ~200 lines)
├── routes/
│   ├── index.js (route aggregator)
│   ├── setup.js (database initialization)
│   ├── employees.js
│   ├── supervisors.js
│   ├── costCenters.js
│   ├── mileage.js
│   ├── receipts.js
│   ├── timeTracking.js
│   ├── dailyDescriptions.js
│   ├── perDiem.js
│   ├── expenseReports.js
│   ├── monthlyReports.js
│   ├── weeklyReports.js
│   ├── approval.js
│   ├── export.js
│   ├── dashboard.js
│   └── reporting.js
├── services/
│   ├── dbService.js (database connection & helpers)
│   ├── exportService.js (PDF/Excel generation)
│   ├── ocrService.js (receipt OCR)
│   ├── emailService.js (email functionality)
│   └── websocketService.js (WebSocket handling)
├── middleware/
│   ├── auth.js (authentication)
│   ├── validation.js (request validation)
│   └── errorHandler.js (error handling)
└── utils/
    ├── helpers.js (utility functions)
    ├── dateHelpers.js (date normalization)
    └── constants.js (constants and config)
```

## Refactoring Strategy

### Phase 1: Foundation (Low Risk)
1. Create directory structure
2. Extract utility functions (no dependencies on routes)
3. Extract database service (shared by all routes)
4. Extract constants

### Phase 2: Services (Medium Risk)
1. Extract export service (PDF/Excel)
2. Extract OCR service
3. Extract email service
4. Extract WebSocket service

### Phase 3: Routes (Higher Risk - Test Each)
1. Extract simple CRUD routes first (cost centers, per diem)
2. Extract employee routes
3. Extract expense report routes
4. Extract approval workflow
5. Extract reporting routes

### Phase 4: Cleanup
1. Update main server.js
2. Remove duplicate code
3. Add comprehensive error handling
4. Add route documentation

## Benefits
- **Maintainability**: Each module has a single responsibility
- **Testability**: Easier to unit test individual modules
- **Collaboration**: Multiple developers can work on different modules
- **Debugging**: Easier to locate and fix issues
- **Performance**: Can optimize individual modules
- **Risk Reduction**: Corruption in one file doesn't affect others

## Migration Notes
- Keep old server.js as backup during migration
- Test each module as it's extracted
- Use feature flags if needed for gradual rollout
- Maintain backward compatibility with API contracts


# Local development – start order

**The backend must be running first.** Both the web portal and mobile app call `http://localhost:3003`. If nothing is listening on port 3003, you’ll see “Connection refused” / “Network request failed” and the web portal may not load properly.

## 1. Start the backend (required first)

```bash
cd admin-web/backend
node server.js
```

Wait until you see: `Backend server running on http://localhost:3003`

## 2. Start the web portal

```bash
cd admin-web
npm start
```

Opens at http://localhost:3000 (or 3001).

## 3. Start the mobile app (Expo)

```bash
npx expo start
```

- **Simulator/emulator:** Uses `localhost:3003` (already correct).
- **Physical device (Expo Go):** Set your computer’s IP in `src/config/api.ts` → `LOCAL_IP = '192.168.x.x'`.

## Quick check

- Backend: http://localhost:3003/health (or open in browser – should respond).
- If port 3003 is in use: stop the process using it, then start the backend again.

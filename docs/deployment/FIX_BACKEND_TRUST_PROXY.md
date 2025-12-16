# Fix: Backend Trust Proxy Configuration

## Issue

The backend was showing this error on Render.com:

```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false (default). 
This could indicate a misconfiguration which would prevent express-rate-limit from accurately identifying users.
```

## Root Cause

When running on Render.com, the backend sits behind a load balancer that adds `X-Forwarded-For` headers. Express needs to be configured to trust these proxy headers to:
- Correctly identify client IP addresses
- Allow rate limiting to work properly
- Handle SSL/TLS termination correctly

## Solution

Added `app.set('trust proxy', true)` to the Express app configuration in `server.js`.

This tells Express to:
- Trust the first proxy in front of it (Render's load balancer)
- Read client IP from `X-Forwarded-For` header
- Use `X-Forwarded-Proto` header for HTTPS detection
- Properly handle rate limiting per client IP

## File Changed

- `admin-web/backend/server.js` - Added trust proxy setting after Express app creation

## Deployment

After committing and pushing this change, Render.com will automatically redeploy. The error should be resolved.

## Verification

After deployment, check Render.com logs - the error should no longer appear.


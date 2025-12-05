/**
 * OAuth Redirect Handler for Mobile Apps
 * 
 * This endpoint receives OAuth callbacks from Google and redirects to the mobile app
 * using a custom URL scheme. This allows us to use HTTPS URLs (which Google accepts)
 * while still using custom scheme redirects to the mobile app.
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const { debugLog, debugError } = require('../debug');

/**
 * GET /oauth/mobile/redirect
 * 
 * Receives OAuth callback from Google and serves HTML page that redirects to mobile app
 * Uses HTML page because direct custom scheme redirects from backend don't work reliably
 * in mobile browsers - the HTML page with JavaScript redirect is more reliable
 * 
 * Query params:
 * - code: Authorization code from Google
 * - error: Error from Google (if any)
 * - state: State parameter (if provided)
 */
router.get('/oauth/mobile/redirect', (req, res) => {
  const { code, error, state } = req.query;
  
  debugLog('🔍 OAuth redirect handler received callback:', {
    hasCode: !!code,
    hasError: !!error,
    error: error,
    state: state
  });

  // Serve HTML page that will redirect to mobile app
  // This is more reliable than trying to redirect directly from backend
  res.sendFile(path.join(__dirname, '../public/oauth-redirect.html'));
});

module.exports = router;


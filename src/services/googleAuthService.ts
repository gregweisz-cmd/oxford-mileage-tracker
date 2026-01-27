import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Linking } from 'react-native';
import { API_BASE_URL } from '../config/api';

// Complete the auth session (required for web)
if (Platform.OS === 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  idToken?: string;
  authorizationCode?: string; // For mobile flow
}

export class GoogleAuthService {
  // Use the same API configuration as the rest of the app (Render when USE_PRODUCTION_FOR_TESTING)
  private static getBaseUrl(): string {
    const baseUrl = (API_BASE_URL ?? '').replace(/\/api\/?$/, '');
    return baseUrl || 'https://oxford-mileage-backend.onrender.com';
  }
  
  private static baseUrl = GoogleAuthService.getBaseUrl();

  // Google OAuth Client ID (from Google Cloud Console)
  // Using Web client ID - matches backend configuration
  // External apps allow this to work for mobile too
  private static GOOGLE_CLIENT_ID = '893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6.apps.googleusercontent.com';

  private static getGoogleClientId(): string {
    return this.GOOGLE_CLIENT_ID;
  }

  private static getGoogleRedirectUri(): string {
    // For External apps, we can use backend proxy flow with HTTPS redirect URI
    // Backend handles OAuth callback and redirects to app via deep link
    const baseUrl = this.baseUrl;
    const redirectUri = `${baseUrl}/api/auth/google/mobile/callback`;
    
    console.log('🔍 Google OAuth Redirect URI (backend proxy):', redirectUri);
    
    return redirectUri;
  }

  /**
   * Initiate Google Sign-In
   * Returns null if user cancels, GoogleUserInfo on success, throws on error
   */
  static async signInWithGoogle(): Promise<GoogleUserInfo | null> {
    try {
      const clientId = this.getGoogleClientId();
      const redirectUri = this.getGoogleRedirectUri();

      console.log('🔍 Google OAuth Config:', {
        clientId: clientId.substring(0, 20) + '...',
        redirectUri: redirectUri
      });

      if (clientId === 'YOUR_GOOGLE_CLIENT_ID') {
        throw new Error('Google OAuth Client ID not configured. Please set up Google OAuth in Google Cloud Console.');
      }

      // For backend proxy flow, we need to:
      // 1. Open OAuth URL directly in browser using AuthRequest
      // 2. Listen for deep link callback from backend
      // AuthSession.promptAsync() won't work well with backend redirects
      
      console.log('🔍 Starting OAuth with backend proxy flow...');
      console.log('🔍 Full redirect URI:', redirectUri);
      console.log('🔍 Full client ID:', clientId);
      
      // Generate state for security (CSRF protection)
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Build OAuth authorization URL with all required parameters
      // Note: For Internal apps, Google may not require PKCE, but including state is recommended
      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      };
      
      // Build authorization URL with required parameters only
      // For Internal apps, keep it minimal - only required params
      const authUrlParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        state: state, // CSRF protection (required for security)
      });
      
      const authUrl = `${discovery.authorizationEndpoint}?${authUrlParams.toString()}`;
      console.log('🔍 Generated OAuth URL (first 200 chars):', authUrl.substring(0, 200) + '...');
      console.log('🔍 Full OAuth URL:', authUrl);
      console.log('🔍 Redirect URI being sent:', redirectUri);
      console.log('🔍 Redirect URI length:', redirectUri.length);
      console.log('🔍 Redirect URI (exact, no encoding):', JSON.stringify(redirectUri));
      console.log('🔍 Client ID being sent:', clientId);
      console.log('🔍 State parameter:', state);
      console.log('🔍 All URL parameters:', Object.fromEntries(authUrlParams));
      
      // Set up deep link listener BEFORE opening browser
      const deepLinkPromise = new Promise<GoogleUserInfo | null>((resolve, reject) => {
        const timeout = setTimeout(() => {
          Linking.removeAllListeners('url');
          reject(new Error('OAuth timeout - no response received from backend'));
        }, 300000); // 5 minute timeout
        
        const handleDeepLink = (event: { url: string }) => {
          const url = event.url;
          console.log('🔍 Deep link received:', url);
          console.log('🔍 Deep link type:', typeof url);
          
          // Check for Universal Link (HTTPS) or custom scheme
          // Universal Link format: https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback?...
          // Custom scheme format: ohstafftracker://oauth/callback?...
          const isUniversalLink = url && (
            url.includes('oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback') ||
            url.includes('/oauth/callback')
          );
          const isCustomScheme = url && url.startsWith('ohstafftracker://oauth/callback');
          
          if (isUniversalLink || isCustomScheme) {
            console.log('✅ Deep link matched! Type:', isUniversalLink ? 'Universal Link' : 'Custom Scheme');
            clearTimeout(timeout);
            Linking.removeAllListeners('url');
            
            try {
              const urlObj = new URL(url);
              const success = urlObj.searchParams.get('success');
              const token = urlObj.searchParams.get('token');
              const email = urlObj.searchParams.get('email');
              const error = urlObj.searchParams.get('error');
              const code = urlObj.searchParams.get('code'); // Polling code as fallback
              
              console.log('🔍 Parsed deep link params:', { success, hasToken: !!token, email, error, hasCode: !!code });
              
              if (error) {
                console.error('❌ Deep link contains error:', error);
                reject(new Error(decodeURIComponent(error)));
                return;
              }
              
              if (success === 'true' && token && email) {
                console.log('✅ Successfully received token from backend via deep link');
                console.log('🔍 Token (first 20 chars):', token.substring(0, 20) + '...');
                console.log('🔍 Email:', decodeURIComponent(email));
                resolve({
                  id: '',
                  email: decodeURIComponent(email),
                  name: '',
                  token: decodeURIComponent(token),
                } as any);
              } else {
                console.error('❌ Invalid deep link response:', { success, hasToken: !!token, email });
                reject(new Error('Invalid deep link response - missing success, token, or email'));
              }
            } catch (err: any) {
              console.error('❌ Failed to parse deep link:', err);
              reject(new Error(`Failed to parse deep link: ${err?.message || err}`));
            }
          } else {
            console.log('⚠️ Deep link received but does not match expected pattern:', url);
          }
        };
        
        console.log('🔍 Setting up deep link listener...');
        // Listen for deep links
        const subscription = Linking.addEventListener('url', handleDeepLink);
        console.log('✅ Deep link listener added');
        
        // Also check for initial URL (in case app was opened via deep link)
        Linking.getInitialURL().then((initialUrl) => {
          console.log('🔍 Initial URL check:', initialUrl);
          if (initialUrl) {
            const isUniversalLink = initialUrl.includes('oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback') ||
                                    initialUrl.includes('/oauth/callback');
            const isCustomScheme = initialUrl.startsWith('ohstafftracker://oauth/callback');
            
            if (isUniversalLink || isCustomScheme) {
              console.log('✅ Found initial URL matching pattern');
              handleDeepLink({ url: initialUrl });
            }
          }
        }).catch((err) => {
          console.log('⚠️ Error getting initial URL:', err);
        });
      });
      
      // Open browser - use system browser which handles deep links better on iOS
      console.log('🔍 Opening OAuth URL in browser...');
      
      // Try opening with system browser (better for deep links)
      let browserResult;
      try {
        // Use openBrowserAsync which should close when redirected
        browserResult = await WebBrowser.openBrowserAsync(authUrl, {
          // iOS options - preferEphemeralSession might help with redirects
          showInRecents: false,
          // Android options
          createTask: false,
        });
        console.log('🔍 Browser closed with result:', browserResult);
      } catch (browserError) {
        console.error('❌ Error opening browser:', browserError);
      }
      
      // Wait for deep link callback from backend
      // Note: Deep link should fire when backend redirects
      console.log('⏳ Waiting for deep link callback from backend...');
      
      // If browser closed but no deep link received, try polling the backend
      // or check if we can manually trigger the deep link
      let userInfo: GoogleUserInfo | null = null;
      try {
        userInfo = await Promise.race([
          deepLinkPromise,
          // Timeout after 30 seconds and try alternative method
          new Promise<null>((resolve) => {
            setTimeout(() => {
              console.log('⚠️ Deep link timeout - browser may have blocked redirect');
              resolve(null);
            }, 30000);
          })
        ]);
      } catch (deepLinkError) {
        console.error('❌ Deep link error:', deepLinkError);
      }
      
      // If no deep link received, try checking if app was reopened via deep link
      if (!userInfo) {
        console.log('🔍 No deep link received, checking initial URL...');
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl && initialUrl.startsWith('ohstafftracker://oauth/callback')) {
            console.log('✅ Found initial URL after browser close:', initialUrl);
            // Parse the initial URL
            const urlObj = new URL(initialUrl);
            const success = urlObj.searchParams.get('success');
            const token = urlObj.searchParams.get('token');
            const email = urlObj.searchParams.get('email');
            
            if (success === 'true' && token && email) {
              userInfo = {
                id: '',
                email: decodeURIComponent(email),
                name: '',
                token: decodeURIComponent(token),
              } as any;
            }
          }
        } catch (initialUrlError) {
          console.error('❌ Error checking initial URL:', initialUrlError);
        }
      }
      
      // If still no userInfo, the redirect was blocked
      if (!userInfo) {
        console.log('⚠️ Deep link failed - Safari likely blocked the redirect');
        console.log('📱 If you see a code on the browser page, the app can poll for your token.');
        console.log('💡 Please check the browser page for an auth code, or try signing in again.');
        
        throw new Error(
          'OAuth redirect was blocked by Safari. ' +
          'If you see a code on the sign-in success page, please note it down. ' +
          'The app will support code entry in a future update. ' +
          'For now, please try signing in again or ensure the app can handle deep links.'
        );
      }
      
      return userInfo;
      
      // Old AuthSession flow (commented out - doesn't work well with backend proxy)
      /*
      const request = new AuthSession.AuthRequest({
        clientId: clientId,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.Code,
        redirectUri: redirectUri,
        usePKCE: true,
      });

      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      };
      
      let result;
      try {
        result = await request.promptAsync(discovery);
      } catch (promptError: any) {
        console.error('❌ Error during promptAsync:', promptError);
        throw new Error(`OAuth prompt failed: ${promptError?.message || 'Unknown error'}`);
      }
      */
      
      // OLD CODE CONTINUES...
      if (false) { // Never executed, keeping for reference
      } else if (false) {
        // Cancel could mean user cancelled OR Google rejected the request
        // Check if there's an error URL that might indicate why it was cancelled
        const resultAny = result as any;
        const url = resultAny.url || resultAny.errorUrl;
        
        console.log('⚠️ OAuth cancelled');
        console.log('⚠️ Result URL (if any):', url);
        
        // If there's a URL, check if it contains error info
        if (url && typeof url === 'string') {
          try {
            const urlObj = new URL(url);
            const errorParam = urlObj.searchParams.get('error');
            const errorDescription = urlObj.searchParams.get('error_description');
            
            if (errorParam) {
              console.error('❌ Google OAuth Error in redirect URL:', {
                error: errorParam,
                description: errorDescription,
                fullUrl: url
              });
              
              // Provide helpful error message
              if (errorParam === 'redirect_uri_mismatch') {
                const backendUrl = this.baseUrl;
                throw new Error(`Redirect URI mismatch. Please add ${backendUrl}/api/auth/google/mobile/callback to Google Cloud Console Authorized redirect URIs.`);
              } else if (errorParam === 'access_denied') {
                throw new Error('Access denied. You may need to be added as a test user in Google Cloud Console.');
              } else {
                throw new Error(`OAuth error: ${errorParam}${errorDescription ? ` - ${errorDescription}` : ''}`);
              }
            }
          } catch (urlError) {
            // URL parsing failed, might not be a URL
            console.log('⚠️ Could not parse URL from cancel result');
          }
        }
        
        // If no error detected, assume user cancelled
        console.log('ℹ️ User cancelled OAuth (no error detected)');
        return null;
      } else {
        // Other result types (dismiss, error, etc.)
        const resultAny = result as any;
        console.error('❌ OAuth result type:', result.type);
        console.error('❌ Full result object:', JSON.stringify(resultAny, null, 2));
        
        // Check if there's an error in params
        const errorFromParams = resultAny.params?.error || resultAny.error || 'Unknown error';
        const errorDescription = resultAny.params?.error_description || resultAny.error_description || '';
        
        console.error('❌ OAuth error details:', {
          type: result.type,
          error: errorFromParams,
          errorDescription: errorDescription,
          allParams: resultAny.params
        });
        
        const errorMsg = errorDescription 
          ? `${errorFromParams}: ${errorDescription}`
          : `OAuth flow failed: ${result.type} - ${errorFromParams}`;
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      // Log and throw actual errors (network issues, configuration problems, etc.)
      // Cancellations are handled above and won't reach here
      const errorMessage = error?.message || 'Failed to sign in with Google';
      
      // Don't log cancellation messages as errors
      if (!errorMessage.toLowerCase().includes('cancel')) {
        console.error('Google Sign-In error:', error);
      }
      
      throw error;
    }
  }

  /**
   * Verify Google authorization code with backend and get employee data
   * Backend will exchange the code for tokens (more secure - client secret stays on backend)
   * OR handle token received via deep link from backend
   */
  static async verifyWithBackend(userInfo: GoogleUserInfo): Promise<any> {
    // If we already have a token from deep link (backend proxy flow)
    const userInfoAny = userInfo as any;
    if (userInfoAny.token) {
      console.log('✅ Using token from deep link, fetching employee data...');
      // Token is already received, just need to fetch employee data
      const response = await fetch(`${this.baseUrl}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${userInfoAny.token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to verify token with backend');
      }
      
      const result = await response.json();
      return result.employee || result;
    }
    
    // Original flow: send authorization code to backend
    if (!userInfo.authorizationCode) {
      throw new Error('Authorization code is required for backend verification');
    }

    // Include the redirect URI so backend can use it for token exchange
    const redirectUri = this.getGoogleRedirectUri();
    const backendUrl = `${this.baseUrl}/api/auth/google/mobile`;

    console.log('🔍 Sending authorization code to backend:', {
      backendUrl: backendUrl,
      hasCode: !!userInfo.authorizationCode,
      redirectUri: redirectUri
    });

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: userInfo.authorizationCode,
          redirectUri: redirectUri, // Pass redirect URI to backend
        }),
      });

      console.log('🔍 Backend response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Failed to authenticate with backend' };
        }
        
        console.error('❌ Backend OAuth error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error,
          fullResponse: errorText
        });
        
        throw new Error(errorData.error || `Backend error (${response.status}): ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      
      // Return employee data (backend already handled token exchange)
      return result.employee;
    } catch (error: any) {
      console.error('❌ Error in verifyWithBackend:', error);
      throw error;
    }
  }
}


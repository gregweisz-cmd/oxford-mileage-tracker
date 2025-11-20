import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

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
}

export class GoogleAuthService {
  private static baseUrl = __DEV__
    ? 'http://192.168.86.101:3002'
    : 'https://oxford-mileage-backend.onrender.com';

  // Google OAuth configuration
  // These will need to be configured in Google Cloud Console
  // For now, we'll get these from environment or config
  private static getGoogleClientId(): string {
    // TODO: Get from environment variable or config
    // For now, return placeholder - this needs to be configured
    return 'YOUR_GOOGLE_CLIENT_ID';
  }

  private static getGoogleRedirectUri(): string {
    return AuthSession.makeRedirectUri({
      useProxy: true,
    });
  }

  /**
   * Initiate Google Sign-In
   */
  static async signInWithGoogle(): Promise<GoogleUserInfo> {
    try {
      const clientId = this.getGoogleClientId();
      const redirectUri = this.getGoogleRedirectUri();

      if (clientId === 'YOUR_GOOGLE_CLIENT_ID') {
        throw new Error('Google OAuth Client ID not configured. Please set up Google OAuth in Google Cloud Console.');
      }

      // Request authorization code from Google
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

      const result = await request.promptAsync(discovery, {
        useProxy: true,
      });

      if (result.type === 'success') {
        // Exchange authorization code for tokens
        const tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            clientId: clientId,
            code: result.params.code,
            redirectUri: redirectUri,
            extraParams: {},
          },
          discovery
        );

        // Store ID token for backend verification
        const idToken = tokenResponse.idToken;
        if (!idToken) {
          throw new Error('No ID token received from Google');
        }

        // Get user info from Google
        const userInfoResponse = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.accessToken}`,
            },
          }
        );

        const userInfo = await userInfoResponse.json();

        return {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          idToken: idToken, // Include ID token for backend verification
        };
      } else {
        throw new Error('Google Sign-In was cancelled');
      }
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      throw new Error(error.message || 'Failed to sign in with Google');
    }
  }

  /**
   * Verify Google token with backend and get employee data
   */
  static async verifyWithBackend(userInfo: GoogleUserInfo): Promise<any> {
    if (!userInfo.idToken) {
      throw new Error('ID token is required for backend verification');
    }

    const response = await fetch(`${this.baseUrl}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: userInfo.idToken,
        email: userInfo.email,
        name: userInfo.name,
        googleId: userInfo.id,
        picture: userInfo.picture,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to authenticate with backend');
    }

    return response.json();
  }
}


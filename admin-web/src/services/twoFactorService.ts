export interface TwoFactorStatus {
  twoFactorEnabled: boolean;
  phoneNumberVerified: boolean;
  phoneNumber: string | null; // Last 4 digits only
}

export interface SendCodeResponse {
  success: boolean;
  message: string;
  phoneNumberLast4?: string;
}

export class TwoFactorService {
  private static baseUrl = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api`
    : 'https://oxford-mileage-backend.onrender.com/api';

  /**
   * Send verification code to phone number
   */
  static async sendCode(employeeId: string, phoneNumber: string): Promise<SendCodeResponse> {
    const response = await fetch(`${this.baseUrl}/auth/two-factor/send-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId,
        phoneNumber
      }),
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send verification code');
    }

    return data;
  }

  /**
   * Verify phone number and enable 2FA
   */
  static async verifyPhone(
    employeeId: string,
    phoneNumber: string,
    verificationCode: string
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/two-factor/verify-phone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId,
        phoneNumber,
        verificationCode
      }),
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to verify phone number');
    }
  }

  /**
   * Disable 2FA
   */
  static async disable(employeeId: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/two-factor/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId,
        password
      }),
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to disable 2FA');
    }
  }

  /**
   * Get 2FA status
   */
  static async getStatus(employeeId: string): Promise<TwoFactorStatus> {
    const response = await fetch(`${this.baseUrl}/auth/two-factor/status/${employeeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch 2FA status');
    }

    return response.json();
  }
}

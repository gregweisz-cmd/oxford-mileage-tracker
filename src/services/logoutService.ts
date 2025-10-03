import { DatabaseService } from './database';

class LogoutService {
  private static logoutCallback: (() => void) | null = null;

  static setLogoutCallback(callback: () => void) {
    this.logoutCallback = callback;
  }

  static async logout() {
    console.log('🚪 LogoutService: Logging out user...');
    try {
      // Clear current employee from database
      await DatabaseService.clearCurrentEmployee();
      console.log('✅ LogoutService: Current employee cleared');
      
      // Call the logout callback if it exists
      if (this.logoutCallback) {
        this.logoutCallback();
      } else {
        console.warn('⚠️ LogoutService: No logout callback set');
      }
    } catch (error) {
      console.error('❌ LogoutService: Error during logout:', error);
    }
  }
}

export default LogoutService;

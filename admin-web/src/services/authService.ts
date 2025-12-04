// Authentication Service for Admin Web Portal
import { debugError, debugWarn } from '../config/debug';

export type UserRole = 'employee' | 'supervisor' | 'admin' | 'finance';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  position: string;
  oxfordHouseId: string;
  costCenters: string[];
  baseAddress: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export class AuthService {
  private authState: AuthState = {
    user: null,
    isAuthenticated: false,
    loading: false
  };

  // Role-based permissions
  static hasPermission(userRole: UserRole | null, permission: string): boolean {
    const permissions: Record<UserRole, string[]> = {
      employee: [
        'view_own_data',
        'submit_reports',
        'edit_own_profile'
      ],
      supervisor: [
        'view_own_data',
        'submit_reports',
        'edit_own_profile',
        'view_team_data',
        'approve_reports',
        'view_team_employees',
        'manage_team_settings'
      ],
      finance: [
        'view_own_data',
        'edit_own_profile',
        'view_all_data',
        'approve_reports',
        'export_data',
        'view_finance_reports',
        'manage_expense_approvals',
        'view_financial_analytics'
      ],
      admin: [
        'view_own_data',
        'submit_reports',
        'edit_own_profile',
        'view_team_data',
        'approve_reports',
        'view_team_employees',
        'manage_team_settings',
        'view_all_data',
        'manage_all_employees',
        'system_administration',
        'export_data',
        'import_data',
        'manage_organizations'
      ]
    };

    return userRole ? permissions[userRole]?.includes(permission) || false : false;
  }

  // Login with email/password
  async login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    this.setLoading(true);
    
    try {
      // First, get all employees to find the one with matching email
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';
      const response = await fetch(`${API_BASE_URL}/api/employees`);
      if (!response.ok) {
        throw new Error('Failed to fetch employees');
      }

      const employees = await response.json();
      const employee = employees.find((emp: any) => 
        emp.email.toLowerCase() === email.toLowerCase()
      );

      if (!employee) {
        throw new Error('Invalid email or password');
      }

      // For now, we'll skip password validation since passwords aren't fully implemented
      // In production, you'd hash and compare passwords properly
      
      // Get role from database (stored separately from position)
      // Role is the login role (employee, supervisor, admin, finance), not the job title
      // If role is not set in database, fall back to determining from position for backward compatibility
      let userRole: UserRole = employee.role || 'employee';
      
      // Validate role is one of the allowed values
      const allowedRoles: UserRole[] = ['employee', 'supervisor', 'admin', 'finance'];
      if (!allowedRoles.includes(userRole)) {
        // Fallback: determine from position if role is invalid or missing
        debugWarn(`Invalid or missing role for employee ${employee.email}, determining from position`);
        userRole = this.determineUserRole(employee.position, employee.name, employee.email);
      }
      
      const user: User = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: userRole,
        position: employee.position,
        oxfordHouseId: employee.oxfordHouseId,
        costCenters: typeof employee.costCenters === 'string' 
          ? JSON.parse(employee.costCenters) 
          : employee.costCenters || [],
        baseAddress: employee.baseAddress
      };

      this.setAuthState({
        user,
        isAuthenticated: true,
        loading: false
      });

      // Store in localStorage for persistence
      localStorage.setItem('authUser', JSON.stringify(user));

      return { success: true, user };
      
    } catch (error: any) {
      this.setAuthState({
        user: null,
        isAuthenticated: false,
        loading: false
      });
      
      return { 
        success: false, 
        error: error.message || 'Login failed' 
      };
    }
  }

  // Determine user role based on position and name
  private determineUserRole(position: string, name: string, email?: string): UserRole {
    const positionLower = position.toLowerCase();
    const nameLower = name.toLowerCase();
    const emailLower = email?.toLowerCase() || '';

    // Admin users (hardcoded for now)
    if (nameLower.includes('greg') || nameLower.includes('goose') || nameLower.includes('admin') || 
        positionLower.includes('executive director') || emailLower.includes('greg.weisz')) {
      return 'admin';
    }

    // Finance users (check before supervisor to avoid conflicts)
    if (
      positionLower.includes('finance') ||
      positionLower.includes('financial') ||
      positionLower.includes('accounting') ||
      positionLower.includes('accountant') ||
      positionLower.includes('controller') ||
      positionLower.includes('cfo') ||
      positionLower.includes('chief financial')
    ) {
      return 'finance';
    }

    // Supervisors (positions that typically manage teams) - be more specific
    if (
      positionLower.includes('director') ||
      positionLower.includes('program director') ||
      positionLower.includes('regional manager') ||
      positionLower.includes('house manager') ||
      positionLower.includes('supervisor') ||
      positionLower.includes('coordinator') ||
      positionLower.includes('administrative assistant')
    ) {
      // Exclude case manager from supervisor
      if (!positionLower.includes('case manager')) {
        return 'supervisor';
      }
    }

    // Default to employee for all other positions (including Case Manager)
    return 'employee';
  }

  // Logout
  logout(): void {
    this.setAuthState({
      user: null,
      isAuthenticated: false,
      loading: false
    });
    
    localStorage.removeItem('authUser');
  }

  // Initialize auth state from localStorage
  initializeAuth(): void {
    this.setLoading(true);
    
    try {
      const storedUser = localStorage.getItem('authUser');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        this.setAuthState({
          user,
          isAuthenticated: true,
          loading: false
        });
      } else {
        this.setAuthState({
          user: null,
          isAuthenticated: false,
          loading: false
        });
      }
    } catch (error) {
      debugError('Error initializing auth:', error);
      this.setAuthState({
        user: null,
        isAuthenticated: false,
        loading: false
      });
    }
  }

  // Getters
  getAuthState(): AuthState {
    return this.authState;
  }

  getUser(): User | null {
    return this.authState.user;
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  isLoading(): boolean {
    return this.authState.loading;
  }

  // Set auth state and notify listeners
  private setAuthState(state: AuthState): void {
    this.authState = state;
    this.notifyListeners();
  }

  setLoading(loading: boolean): void {
    this.authState.loading = loading;
    this.notifyListeners();
  }

  // Event listeners for auth state changes
  private listeners: Array<(state: AuthState) => void> = [];

  addListener(listener: (state: AuthState) => void): void {
    this.listeners.push(listener);
  }

  removeListener(listener: (state: AuthState) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.authState));
  }

  // Helper methods for role checking
  static isEmployee(user: User | null): boolean {
    return user?.role === 'employee';
  }

  static isSupervisor(user: User | null): boolean {
    return user?.role === 'supervisor';
  }

  static isFinance(user: User | null): boolean {
    return user?.role === 'finance';
  }

  static isAdmin(user: User | null): boolean {
    return user?.role === 'admin';
  }

  static canManageEmployees(user: User | null): boolean {
    return AuthService.isAdmin(user) || AuthService.isSupervisor(user);
  }

  static canViewAllData(user: User | null): boolean {
    return AuthService.isAdmin(user) || AuthService.isFinance(user);
  }

  static canApproveReports(user: User | null): boolean {
    return AuthService.isAdmin(user) || AuthService.isSupervisor(user) || AuthService.isFinance(user);
  }
}

export default new AuthService();

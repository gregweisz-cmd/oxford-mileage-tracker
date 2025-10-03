import { Employee } from '../types';

export class PermissionService {
  /**
   * Check if user has management permissions (can see Employee Management and Team Dashboard)
   */
  static hasManagementPermissions(employee: Employee): boolean {
    const position = employee.position.toLowerCase();
    
    // CEO and Executive level positions
    const executivePositions = [
      'ceo',
      'chief',
      'co-founder',
      'consultant',
      'executive'
    ];
    
    // Director level positions
    const directorPositions = [
      'director'
    ];
    
    // Manager level positions
    const managerPositions = [
      'regional manager',
      'manager'
    ];
    
    // Senior level positions
    const seniorPositions = [
      'senior'
    ];
    
    // Check if position contains any of the management keywords
    const isExecutive = executivePositions.some(keyword => position.includes(keyword));
    const isDirector = directorPositions.some(keyword => position.includes(keyword));
    const isManager = managerPositions.some(keyword => position.includes(keyword));
    const isSenior = seniorPositions.some(keyword => position.includes(keyword));
    
    return isExecutive || isDirector || isManager || isSenior;
  }
  
  /**
   * Check if user has admin permissions (can see Employee Management)
   */
  static hasAdminPermissions(employee: Employee): boolean {
    const position = employee.position.toLowerCase();
    
    // Only CEO, Directors, and Regional Managers can access Employee Management
    const adminPositions = [
      'ceo',
      'chief',
      'co-founder',
      'consultant',
      'executive',
      'director',
      'regional manager'
    ];
    
    return adminPositions.some(keyword => position.includes(keyword));
  }
  
  /**
   * Check if user has team dashboard permissions
   */
  static hasTeamDashboardPermissions(employee: Employee): boolean {
    const position = employee.position.toLowerCase();
    
    // Regional Managers, Directors, CEO, and anyone with "Senior" in title
    const teamDashboardPositions = [
      'ceo',
      'chief',
      'co-founder',
      'consultant',
      'executive',
      'director',
      'regional manager',
      'senior'
    ];
    
    return teamDashboardPositions.some(keyword => position.includes(keyword));
  }
  
  /**
   * Get user's permission level for display purposes
   */
  static getUserPermissionLevel(employee: Employee): 'Executive' | 'Director' | 'Manager' | 'Senior' | 'Employee' {
    const position = employee.position.toLowerCase();
    
    if (position.includes('ceo') || position.includes('chief') || position.includes('co-founder')) {
      return 'Executive';
    }
    
    if (position.includes('director')) {
      return 'Director';
    }
    
    if (position.includes('regional manager') || position.includes('manager')) {
      return 'Manager';
    }
    
    if (position.includes('senior')) {
      return 'Senior';
    }
    
    return 'Employee';
  }
}





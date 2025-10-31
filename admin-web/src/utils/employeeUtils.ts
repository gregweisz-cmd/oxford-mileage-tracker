/**
 * Employee utility functions
 */

export interface Employee {
  id: string;
  name: string;
  preferredName?: string;
  email: string;
  position?: string;
  [key: string]: any;
}

/**
 * Get the display name for an employee
 * Returns preferredName if set, otherwise returns name
 * 
 * @param employee - Employee object or data with name and preferredName fields
 * @returns Display name string
 */
export function getEmployeeDisplayName(employee: Employee | { name: string; preferredName?: string; [key: string]: any }): string {
  if (!employee) {
    return 'Unknown';
  }

  // Return preferred name if it exists and is not empty
  if (employee.preferredName && employee.preferredName.trim()) {
    return employee.preferredName.trim();
  }

  // Fall back to regular name
  return employee.name || 'Unknown';
}

/**
 * Get display name from name and preferredName strings directly
 * @param name - Employee's full name
 * @param preferredName - Employee's preferred name (optional)
 * @returns Display name string
 */
export function getDisplayName(name: string, preferredName?: string): string {
  if (preferredName && preferredName.trim()) {
    return preferredName.trim();
  }
  return name || 'Unknown';
}


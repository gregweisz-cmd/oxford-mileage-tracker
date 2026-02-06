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

/**
 * Format a name for display with proper capitalization of "Mc", "Mac", "O'" prefixes
 * (e.g. "mckinney" -> "McKinney", "mckeogh" -> "McKeogh").
 * Other words are left as-is (assume already correct or title-cased from source).
 */
export function formatNameForDisplay(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      const w = word;
      if (w.length === 0) return w;
      // McX -> Mc + uppercase(X) + rest lowercase (e.g. Mckinney -> McKinney)
      const mcMatch = w.match(/^([Mm]c)(.+)$/);
      if (mcMatch) {
        return 'Mc' + mcMatch[2].charAt(0).toUpperCase() + mcMatch[2].slice(1).toLowerCase();
      }
      // MacX -> Mac + uppercase(X) + rest lowercase
      const macMatch = w.match(/^([Mm]ac)(.+)$/);
      if (macMatch && macMatch[2].length > 0) {
        return 'Mac' + macMatch[2].charAt(0).toUpperCase() + macMatch[2].slice(1).toLowerCase();
      }
      // O'X -> O' + uppercase(X) + rest lowercase
      const oMatch = w.match(/^[oO]'(.+)$/);
      if (oMatch) {
        return "O'" + oMatch[1].charAt(0).toUpperCase() + oMatch[1].slice(1).toLowerCase();
      }
      return w;
    })
    .join(' ');
}


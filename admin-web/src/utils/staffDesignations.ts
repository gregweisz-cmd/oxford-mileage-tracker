import type { Employee } from '../types';

export type PortalPermission = NonNullable<Employee['permissions']>[number];

const SENIOR_STAFF_SUFFIX = /\s*-\s*Senior Staff\b/i;
const SUPERVISOR_SUFFIX = /\s*-\s*Supervisor\b/i;

export function parseEmployeePermissions(permissions: unknown): PortalPermission[] {
  if (Array.isArray(permissions)) {
    return permissions.filter(Boolean) as PortalPermission[];
  }
  if (typeof permissions === 'string') {
    try {
      const parsed = JSON.parse(permissions);
      return Array.isArray(parsed) ? (parsed as PortalPermission[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Remove legacy " - Senior Staff" / " - Supervisor" suffixes from HR job titles. */
export function stripDesignationSuffixes(position: string | undefined | null): string {
  return String(position || '')
    .replace(SENIOR_STAFF_SUFFIX, '')
    .replace(SUPERVISOR_SUFFIX, '')
    .trim();
}

export function getDisplayPosition(position: string | undefined | null): string {
  const cleaned = stripDesignationSuffixes(position);
  return cleaned || '-';
}

export function hasSeniorStaffDesignation(employee: Pick<Employee, 'position' | 'permissions'>): boolean {
  const perms = parseEmployeePermissions(employee.permissions);
  if (perms.includes('senior_staff')) return true;
  const pos = employee.position || '';
  return SENIOR_STAFF_SUFFIX.test(pos) || pos.toLowerCase().includes('senior staff');
}

export function hasSupervisorDesignation(employee: Pick<Employee, 'position' | 'permissions'>): boolean {
  if (hasSeniorStaffDesignation(employee)) return false;
  const perms = parseEmployeePermissions(employee.permissions);
  if (perms.includes('supervisor')) return true;
  const pos = employee.position || '';
  const posLower = pos.toLowerCase();
  return SUPERVISOR_SUFFIX.test(pos) || (posLower.includes('supervisor') && !posLower.includes('senior staff'));
}

export function inferSupervisorType(employee: Pick<Employee, 'position' | 'permissions'>): 'supervisor' | 'senior-staff' {
  return hasSeniorStaffDesignation(employee) ? 'senior-staff' : 'supervisor';
}

export function addDesignationPermission(
  permissions: unknown,
  designation: 'senior_staff' | 'supervisor'
): PortalPermission[] {
  const perms = new Set(parseEmployeePermissions(permissions));
  perms.add(designation);
  if (!perms.has('staff')) perms.add('staff');
  return Array.from(perms);
}

export function removeDesignationPermission(
  permissions: unknown,
  designation: 'senior_staff' | 'supervisor'
): PortalPermission[] {
  return parseEmployeePermissions(permissions).filter((p) => p !== designation);
}

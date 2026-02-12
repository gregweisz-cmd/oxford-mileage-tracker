// Types for the admin-web project
export interface MileageEntry {
  id: string;
  employeeId: string;
  date: Date;
  startLocation: string;
  endLocation: string;
  miles: number;
  purpose: string;
  odometerReading?: number;
  notes?: string;
  hoursWorked?: number;
  isGpsTracked: boolean;
  costCenter?: string; // Cost center for this specific entry
  startLocationName?: string;
  startLocationAddress?: string;
  startLocationLat?: number;
  startLocationLng?: number;
  endLocationName?: string;
  endLocationAddress?: string;
  endLocationLat?: number;
  endLocationLng?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Receipt {
  id: string;
  employeeId: string;
  date: Date;
  amount: number;
  vendor: string;
  description?: string;
  category: string;
  imageUri?: string;
  fileType?: 'image' | 'pdf'; // Type of file (image or PDF)
  costCenter?: string; // Cost center for this specific receipt
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeTracking {
  id: string;
  employeeId: string;
  date: Date;
  category: string;
  hours: number;
  description?: string;
  costCenter?: string; // Cost center for this specific time tracking entry
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  name: string;
  preferredName?: string;
  email: string;
  password: string;
  oxfordHouseId: string;
  position: string; // Job title within the company
  role?: 'employee' | 'supervisor' | 'admin' | 'finance' | 'contracts'; // Login role (separate from position/job title)
  permissions?: Array<'admin' | 'finance' | 'contracts' | 'supervisor' | 'staff'>; // Portal access permissions
  phoneNumber: string;
  baseAddress: string;
  baseAddress2?: string;
  costCenters: string[];
  selectedCostCenters: string[];
  defaultCostCenter: string;
  supervisorId?: string | null; // ID of the supervisor this employee reports to (null = no supervisor)
  seniorStaffId?: string | null; // ID of the senior staff who reviews before supervisor (optional)
  signature?: string;
  typicalWorkStartHour?: number; // Typical work start hour (0-23)
  typicalWorkEndHour?: number; // Typical work end hour (0-23)
  hasCompletedOnboarding?: boolean; // Whether the employee has completed the onboarding flow
  hasCompletedSetupWizard?: boolean; // Whether the employee has completed the setup wizard
  lastLoginAt?: string | null; // ISO 8601 timestamp of last login
  createdAt: Date;
  updatedAt: Date;
}

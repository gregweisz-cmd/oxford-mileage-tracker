export interface Employee {
  id: string;
  name: string;
  email: string;
  password: string; // Added password field
  oxfordHouseId: string;
  position: string;
  phoneNumber?: string;
  baseAddress: string; // Base Address (BA) for reports
  baseAddress2?: string; // Second Base Address (BA2) for reports
  costCenters: string[]; // All available cost centers
  selectedCostCenters: string[]; // Cost centers this employee can bill to
  defaultCostCenter?: string; // Default cost center for new entries
  createdAt: Date;
  updatedAt: Date;
}

export interface OxfordHouse {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber?: string;
  managerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationDetails {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface SavedAddress {
  id: string;
  employeeId: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  category?: string; // e.g., 'Office', 'Client', 'Home', 'Other'
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyOdometerReading {
  id: string;
  employeeId: string;
  date: Date; // Date for this reading (YYYY-MM-DD)
  odometerReading: number; // Starting odometer reading for the day
  notes?: string; // Optional notes
  createdAt: Date;
  updatedAt: Date;
}

export interface MileageEntry {
  id: string;
  employeeId: string;
  oxfordHouseId: string;
  costCenter: string; // Cost center for this specific entry
  date: Date;
  odometerReading: number; // Starting odometer reading for this trip
  startLocation: string;
  endLocation: string;
  startLocationDetails?: LocationDetails;
  endLocationDetails?: LocationDetails;
  purpose: string;
  miles: number;
  notes?: string;
  hoursWorked?: number; // DEPRECATED: Use TimeTracking instead for hours management
  isGpsTracked: boolean; // Whether this entry was created via GPS tracking
  createdAt: Date;
  updatedAt: Date;
}

// Add missing interfaces for services
export interface TripChain {
  id: string;
  employeeId: string;
  startTime: Date;
  endTime?: Date;
  totalMiles: number;
  entries: MileageEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationMapping {
  id: string;
  systemType: string;
  systemName: string;
  authType: string;
  isActive: boolean;
  authConfig: any;
  fieldMappings: any;
  syncSettings: any;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GpsTrackingSession {
  id: string;
  employeeId: string;
  startTime: Date;
  endTime?: Date;
  odometerReading: number; // Starting odometer reading for this session
  startLocation?: string;
  endLocation?: string;
  startLocationDetails?: LocationDetails;
  endLocationDetails?: LocationDetails;
  totalMiles: number;
  isActive: boolean;
  purpose: string;
  notes?: string;
}

export interface Receipt {
  id: string;
  employeeId: string;
  date: Date;
  amount: number;
  vendor: string;
  description?: string;
  category: string;
  imageUri: string;
  costCenter?: string; // Cost center for this specific receipt
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeTracking {
  id: string;
  employeeId: string;
  date: Date;
  category: 'Working Hours' | 'G&A Hours' | 'Holiday Hours' | 'PTO Hours' | 'STD/LTD Hours' | 'PFL/PFML Hours';
  hours: number;
  description?: string;
  costCenter?: string; // Cost center for this specific time tracking entry
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyDescription {
  id: string;
  employeeId: string;
  date: Date;
  description: string;
  costCenter?: string; // Cost center for this specific daily description
  createdAt: Date;
  updatedAt: Date;
}

export interface CostCenterSummary {
  id: string;
  employeeId: string;
  costCenter: string;
  month: number;
  year: number;
  totalHours: number;
  totalMiles: number;
  totalReceipts: number;
  totalPerDiem: number;
  totalExpenses: number;
  mileageEntries: number;
  receiptEntries: number;
  timeTrackingEntries: number;
  descriptionEntries: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonthlyReport {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  totalMiles: number;
  entries: MileageEntry[];
  status: 'draft' | 'submitted' | 'approved';
  submittedAt?: Date;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlackConfig {
  webhookUrl: string;
  channel: string;
  botToken?: string;
}

export type RootStackParamList = {
  Home: undefined;
  MileageEntry: { entryId?: string };
  Reports: undefined;
  GpsTracking: { showEndModal?: boolean };
  Receipts: undefined;
  AddReceipt: undefined;
  HoursWorked: undefined;
  DailyDescription: undefined;
  CostCenterReporting: undefined;
  Admin: undefined;
  ManagerDashboard: undefined;
  SavedAddresses: undefined;
  DataSync: undefined;
  EmployeeProfile: undefined;
  Settings: { currentEmployeeId?: string };
  Preferences: undefined;
};

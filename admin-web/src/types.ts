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
  position: string;
  phoneNumber: string;
  baseAddress: string;
  baseAddress2?: string;
  costCenters: string[];
  selectedCostCenters: string[];
  defaultCostCenter: string;
  supervisorId?: string; // ID of the supervisor this employee reports to
  signature?: string;
  createdAt: Date;
  updatedAt: Date;
}

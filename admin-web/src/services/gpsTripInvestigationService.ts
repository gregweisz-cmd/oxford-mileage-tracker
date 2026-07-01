export interface GpsTripInvestigationRow {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  miles: number;
  purpose: string;
  startLocation: string;
  endLocation: string;
  startLocationName?: string;
  startLocationAddress?: string;
  startLocationLat?: number;
  startLocationLng?: number;
  endLocationName?: string;
  endLocationAddress?: string;
  endLocationLat?: number;
  endLocationLng?: number;
  gpsTrackStartedAt?: string | null;
  gpsTrackEndedAt?: string | null;
  gpsStartLat?: number;
  gpsStartLng?: number;
  gpsEndLat?: number;
  gpsEndLng?: number;
  baseAddress?: string;
  baseAddress2?: string;
  startGapMiles?: number | null;
  endGapMiles?: number | null;
  tripDurationMinutes?: number | null;
  flagLateStart?: boolean;
  flagLateEnd?: boolean;
  hasGpsAudit?: boolean;
}

export interface GpsTripInvestigationResponse {
  trips: GpsTripInvestigationRow[];
  filters: { startDate: string; endDate: string; employeeId: string | null };
  generatedAt: string;
}

const baseUrl = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/admin/reporting`
  : 'https://oxford-mileage-backend.onrender.com/api/admin/reporting';

export async function fetchGpsTripInvestigation(filters: {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
}): Promise<GpsTripInvestigationResponse> {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.employeeId) params.append('employeeId', filters.employeeId);

  const response = await fetch(`${baseUrl}/gps-trips?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GPS trips (${response.status})`);
  }

  return response.json();
}

export function googleMapsCoordUrl(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
    return null;
  }
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

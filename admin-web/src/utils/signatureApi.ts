const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

export async function fetchEmployeeSavedSignature(employeeId: string): Promise<string | null> {
  if (!employeeId) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`);
    if (!response.ok) return null;
    const employee = await response.json();
    return employee?.signature || null;
  } catch {
    return null;
  }
}

export async function saveEmployeeSavedSignature(employeeId: string, signature: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to save signature');
  }
}

export function readPngFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type !== 'image/png') {
      reject(new Error('PNG_REQUIRED'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Failed to read file'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Merge signature-related fields into an expense report's reportData. */
export async function fetchExpenseReportById(reportId: string): Promise<{
  id: string;
  employeeId: string;
  month: number;
  year: number;
  submissionType?: string;
  reportData?: Record<string, unknown>;
}> {
  const response = await fetch(`${API_BASE_URL}/api/expense-reports/id/${reportId}`);
  if (!response.ok) {
    throw new Error('Failed to load expense report');
  }
  return response.json();
}

export function requiresSupervisorCertification(submissionType?: string): boolean {
  return (submissionType || '').toLowerCase() !== 'weekly_checkup';
}

export async function mergeReportDataFields(
  employeeId: string,
  month: number,
  year: number,
  fields: Record<string, unknown>
): Promise<void> {
  const getRes = await fetch(`${API_BASE_URL}/api/expense-reports/${employeeId}/${month}/${year}`);
  if (!getRes.ok) {
    throw new Error('Could not load expense report to save signature');
  }
  const existing = await getRes.json();
  const reportData = { ...(existing.reportData || {}), ...fields };
  const syncRes = await fetch(`${API_BASE_URL}/api/expense-reports/sync-to-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId, month, year, reportData }),
  });
  if (!syncRes.ok) {
    const errorData = await syncRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to save signature on report');
  }
}

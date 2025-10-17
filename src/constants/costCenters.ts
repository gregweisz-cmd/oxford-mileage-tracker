// Cost Centers for Oxford House Expense Tracker
// Now dynamically loaded from API with fallback to hardcoded list

import { costCenterApiService } from '../services/costCenterApiService';

// Fallback cost centers (used when API is unavailable)
export const FALLBACK_COST_CENTERS = [
  'AL / HI / LA',
  'AL-SOR',
  'AL-SUBG',
  'AZ / CO',
  'AZ.CHCCP-SUBG (N)',
  'AZ.CHCCP-SUBG (S)',
  'AZ.MC-SUBG',
  'CA / CO / SD',
  'CA.CCC-OSG',
  'CA.CCC-SUBG',
  'CA.SLOC-HHSG',
  'CO.RMHP',
  'CO.RMHP-SOR',
  'CO.SBH-SOR',
  'CORPORATE',
  'CT / DE / NJ',
  'DC / MD / VA',
  'DC-SOR',
  'DE-STATE',
  'FL-',
  'FL-SOR',
  'Finance',
  'HI-STATE',
  'ID / WA',
  'IL / MN / WI',
  'IL-SUBG',
  'IL.BCBS',
  'IN.TC-OSG',
  'KY / IN / OH',
  'KY-OSG',
  'KY-SOR',
  'KY-STATE',
  'KY-SUBG',
  'LA-SOR',
  'LA-SUBG',
  'MO.GRACE',
  'NC',
  'NC.AHP',
  'NC.DOGWOOD',
  'NC.F-SOR',
  'NC.F-SUBG',
  'NC.MECKCO-OSG',
  'NC.TRILLIUM',
  'NE-SOR',
  'NJ-OSG',
  'NJ-SOR',
  'NJ-SOR (SUBG X)',
  'NJ-SUBG',
  'NM-STATE',
  'NY-',
  'NY.CC/GC-OSG',
  'NY.NC-OSG',
  'NY.OC-OSG',
  'NY.RC-OSG',
  'NY.SC-OSG',
  'NY.UC-OSG',
  'OH-OSG (HC)',
  'OH-SOR/SOS',
  'OH.BHM-STATE',
  'OH.FC-SOR/SOS',
  'OH.MC-STATE',
  'OK / MO / NE',
  'OK-DOJ (RE-ENTRY)',
  'OK-SUBG',
  'OR-',
  'OR-OSG',
  'OR-STATE',
  'Program Services',
  'SC / TN',
  'SC-STATE',
  'SC.PHCA',
  'SC.RUBICON',
  'SD-SOR',
  'TN-STATE',
  'TN-SUBG',
  'TX / NM',
  'TX-SUBG',
  'TX.HEB',
  'VA-SOR',
  'VA-SUBG',
  'WA-SUBG',
  'WA.KING',
  'WA.SNO',
  'WI.MIL',
] as const;

// Legacy export for backward compatibility
export const COST_CENTERS = FALLBACK_COST_CENTERS;

export type CostCenter = typeof FALLBACK_COST_CENTERS[number];

/**
 * Get cost centers from API with fallback
 * This is the new preferred way to get cost centers
 */
export const getCostCenters = async (): Promise<string[]> => {
  try {
    return await costCenterApiService.getCostCenterNames();
  } catch (error) {
    console.warn('Failed to fetch cost centers from API, using fallback:', error);
    return [...FALLBACK_COST_CENTERS];
  }
};

/**
 * Get cost center objects from API with fallback
 */
export const getCostCenterObjects = async () => {
  try {
    return await costCenterApiService.getCostCenters();
  } catch (error) {
    console.warn('Failed to fetch cost center objects from API, using fallback:', error);
    return costCenterApiService.getFallbackCostCenters();
  }
};

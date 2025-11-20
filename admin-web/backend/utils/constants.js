/**
 * Constants and Configuration
 * Centralized constants used throughout the application
 */

// Cost centers are managed as a constant array, not in database
const COST_CENTERS = [
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
  'WI.MIL'
];

// Approval workflow constants
const SUPERVISOR_ESCALATION_HOURS = 48;
const FINANCE_ESCALATION_HOURS = 72;

// Report schedule constants
const REPORT_SCHEDULE_DEFAULT_TIME = '08:00';
const REPORT_SCHEDULE_DEFAULT_TIMEZONE = 'America/New_York';
const REPORT_SCHEDULE_DEFAULT_ROW_LIMIT = 250;

module.exports = {
  COST_CENTERS,
  SUPERVISOR_ESCALATION_HOURS,
  FINANCE_ESCALATION_HOURS,
  REPORT_SCHEDULE_DEFAULT_TIME,
  REPORT_SCHEDULE_DEFAULT_TIMEZONE,
  REPORT_SCHEDULE_DEFAULT_ROW_LIMIT,
};


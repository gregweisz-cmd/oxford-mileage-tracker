/**
 * Per-diem and travel policy definitions for specific cost centers.
 *
 * This file is used by scripts/maintenance/seed-per-diem-policies.js.
 * Only the cost centers listed here are modified — all others are left unchanged.
 */

const NO_TAXES_NOTE =
  'Policy: Do not include sales tax on receipt reimbursements.';
const NO_TAXES_SUPPLIES_NOTE =
  'Policy: Do not include sales tax on supplies receipts.';
const NO_TRAVEL_NOTE =
  'Policy: No travel expenses (mileage, per diem, or travel receipts) for this cost center.';
const NV_MAPS_NOTE =
  'Policy: Requires a Google Maps travel log screenshot for every day of travel.';

function noPerDiemRule(description) {
  return {
    ruleType: 'single',
    maxAmount: 0,
    minHours: 0,
    minMiles: 0,
    minDistanceFromBase: 0,
    useActualAmount: false,
    description,
    tiers: [],
  };
}

function overnightOnlyRule(description, amount = 35) {
  return {
    ruleType: 'tiered',
    maxAmount: amount,
    minHours: 8,
    minMiles: 0,
    minDistanceFromBase: 0,
    useActualAmount: false,
    description,
    tiers: [
      {
        label: 'Overnight',
        amount,
        minHours: 8,
        minMiles: 0,
        minDistanceFromBase: 0,
        requiresOvernight: true,
        sortOrder: 100,
      },
    ],
  };
}

/**
 * Each entry targets one or more cost centers. Set `perDiem` to null to leave
 * existing per-diem rules untouched (description / flags only).
 *
 * Matchers use exact normalized name/code equality (case/punctuation insensitive).
 * Use `matchPrefix` for state-wide rules (e.g. all NV cost centers).
 */
const PER_DIEM_POLICY_DEFINITIONS = [
  {
    key: 'DC-SOR',
    matchers: ['DC-SOR', 'DC SOR'],
    perDiem: noPerDiemRule('No per diem for DC SOR.'),
  },
  {
    key: 'FL-SOR-OSTF',
    matchers: ['FL-SOR', 'FL-OSTF', 'FL.OSTF'],
    perDiem: overnightOnlyRule(
      [
        'Per diem only for overnight travel.',
        'Categorize overnight travel separately:',
        'hotel per diem, hotel mileage, hotel park/tolls/ground/misc;',
        'non-hotel overnight per diem and non-hotel overnight mileage.',
        'No per diem for day trips.',
      ].join(' ')
    ),
  },
  {
    key: 'IN.TC',
    matchers: ['IN.TC-OSG', 'IN.TC'],
    perDiem: null,
    descriptionAppend: NO_TRAVEL_NOTE,
  },
  {
    key: 'NC-F-SUBG-SOR',
    matchers: ['NC.F-SUBG', 'NC.F-SOR', 'NC F-SUBG', 'NC F-SOR'],
    perDiem: overnightOnlyRule(
      `Per diem only for overnight travel. ${NO_TAXES_NOTE}`
    ),
    descriptionAppend: NO_TAXES_NOTE,
    noTaxesOnReceipts: true,
  },
  {
    key: 'NC-AHP',
    matchers: ['NC.AHP', 'NC AHP'],
    perDiem: overnightOnlyRule(
      `Per diem only for overnight travel. ${NO_TAXES_NOTE}`
    ),
    descriptionAppend: NO_TAXES_NOTE,
    noTaxesOnReceipts: true,
  },
  {
    key: 'NC-MECKLENBURG',
    matchers: ['NC.MECKCO-OSG', 'NC Mecklenburg', 'NC-MECKCO'],
    perDiem: overnightOnlyRule(
      `Per diem only for overnight travel. ${NO_TAXES_NOTE}`
    ),
    descriptionAppend: NO_TAXES_NOTE,
    noTaxesOnReceipts: true,
  },
  {
    key: 'NC-DOGWOOD',
    matchers: ['NC.DOGWOOD', 'NC Dogwood'],
    perDiem: null,
    descriptionAppend: NO_TAXES_NOTE,
    noTaxesOnReceipts: true,
  },
  {
    key: 'NC-CRIMINAL-JUSTICE',
    matchers: [
      'NC.CJ',
      'NC CJ',
      'NC Criminal Justice',
      'NC CRIMINAL JUSTICE',
      'NC.CRIMINAL',
      'NC-CRIMINAL',
      'NC.CRIMINAL-JUSTICE',
    ],
    perDiem: null,
    descriptionAppend: NO_TAXES_NOTE,
    noTaxesOnReceipts: true,
  },
  {
    key: 'NV',
    matchPrefix: 'nv',
    perDiem: null,
    enableGoogleMaps: true,
    descriptionAppend: NV_MAPS_NOTE,
  },
  {
    key: 'NY-UC',
    matchers: ['NY.UC-OSG', 'NY.UC', 'NY UC'],
    perDiem: null,
    descriptionAppend: NO_TAXES_NOTE,
    noTaxesOnReceipts: true,
  },
  {
    key: 'OH-FRANKLIN-CO',
    matchers: ['OH.FC-SOR/SOS', 'OH Franklin Co', 'OH.FC-SOR'],
    perDiem: noPerDiemRule('No per diem for OH Franklin County.'),
  },
  {
    key: 'OH-BHM',
    matchers: ['OH.BHM-STATE', 'OH BHM'],
    perDiem: noPerDiemRule('No per diem for OH BHM.'),
  },
  {
    key: 'SC-STATE',
    matchers: ['SC-STATE', 'SC STATE'],
    perDiem: overnightOnlyRule('Per diem only for overnight travel.'),
  },
  {
    key: 'TN-STATE',
    matchers: ['TN-STATE', 'TN STATE'],
    perDiem: overnightOnlyRule(
      `Per diem only for overnight travel. ${NO_TAXES_SUPPLIES_NOTE}`
    ),
    descriptionAppend: NO_TAXES_SUPPLIES_NOTE,
    noTaxesOnSupplies: true,
  },
];

module.exports = {
  PER_DIEM_POLICY_DEFINITIONS,
  NO_TAXES_NOTE,
  NO_TAXES_SUPPLIES_NOTE,
  NO_TRAVEL_NOTE,
  NV_MAPS_NOTE,
  noPerDiemRule,
  overnightOnlyRule,
};

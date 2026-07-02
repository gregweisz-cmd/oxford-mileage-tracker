export interface ReceiptTaxPolicySource {
  name: string;
  code?: string;
  description?: string;
  noTaxesOnReceipts?: boolean | number;
  noTaxesOnSupplies?: boolean | number;
}

export interface ReceiptTaxReminderResult {
  costCenterNames: string[];
  noTaxesOnReceipts: boolean;
  noTaxesOnSupplies: boolean;
  title: string;
  message: string;
}

const normalize = (value: string | null | undefined): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

function isTruthyFlag(value: boolean | number | undefined): boolean {
  return value === true || value === 1;
}

export function getCostCenterTaxPolicy(
  costCenter: ReceiptTaxPolicySource | null | undefined
): { noTaxesOnReceipts: boolean; noTaxesOnSupplies: boolean } {
  if (!costCenter) {
    return { noTaxesOnReceipts: false, noTaxesOnSupplies: false };
  }

  const description = String(costCenter.description || '');
  const noTaxesOnReceipts =
    isTruthyFlag(costCenter.noTaxesOnReceipts) ||
    /do not include sales tax on receipt/i.test(description) ||
    /no taxes on receipts/i.test(description);
  const noTaxesOnSupplies =
    isTruthyFlag(costCenter.noTaxesOnSupplies) ||
    /do not include sales tax on supplies/i.test(description) ||
    /no taxes on supplies/i.test(description) ||
    /no taxes for supplies/i.test(description);

  return { noTaxesOnReceipts, noTaxesOnSupplies };
}

function findCostCenterInCatalog(
  catalog: ReceiptTaxPolicySource[],
  costCenterName: string
): ReceiptTaxPolicySource | undefined {
  const target = normalize(costCenterName);
  if (!target) return undefined;

  return catalog.find((row) => {
    const name = normalize(row.name);
    const code = normalize(row.code);
    return target === name || target === code;
  });
}

function buildMessage(
  noTaxesOnReceipts: boolean,
  noTaxesOnSupplies: boolean,
  platform: 'mobile' | 'web'
): { title: string; message: string } {
  const splitHint =
    platform === 'mobile'
      ? 'Use Split Receipt, enter the tax amount, and tap Tax to Other so sales tax is logged under Other and not reimbursed.'
      : 'Exclude sales tax from the reimbursable amount, or add a separate line under Other for the tax portion (not reimbursed).';

  if (noTaxesOnReceipts && noTaxesOnSupplies) {
    return {
      title: 'Split sales tax on receipts',
      message: `Your cost center does not reimburse sales tax on receipts or supplies. ${splitHint}`,
    };
  }

  if (noTaxesOnSupplies) {
    return {
      title: 'Split sales tax on supplies',
      message: `Your cost center does not reimburse sales tax on supplies receipts. ${splitHint}`,
    };
  }

  return {
    title: 'Split sales tax on receipts',
    message: `Your cost center does not reimburse sales tax on receipts. ${splitHint}`,
  };
}

export function getReceiptTaxReminder(
  catalog: ReceiptTaxPolicySource[],
  employeeCostCenterNames: string[],
  options?: {
    activeCostCenter?: string;
    platform?: 'mobile' | 'web';
  }
): ReceiptTaxReminderResult | null {
  const platform = options?.platform ?? 'web';
  const namesToCheck = options?.activeCostCenter
    ? [options.activeCostCenter]
    : Array.from(new Set((employeeCostCenterNames || []).map((n) => n?.trim()).filter(Boolean)));

  if (!namesToCheck.length || !catalog.length) return null;

  const matchedNames: string[] = [];
  let noTaxesOnReceipts = false;
  let noTaxesOnSupplies = false;

  for (const name of namesToCheck) {
    const row = findCostCenterInCatalog(catalog, name);
    const policy = getCostCenterTaxPolicy(row);
    if (!policy.noTaxesOnReceipts && !policy.noTaxesOnSupplies) continue;
    matchedNames.push(row?.name || name);
    noTaxesOnReceipts = noTaxesOnReceipts || policy.noTaxesOnReceipts;
    noTaxesOnSupplies = noTaxesOnSupplies || policy.noTaxesOnSupplies;
  }

  if (!matchedNames.length) return null;

  const { title, message } = buildMessage(noTaxesOnReceipts, noTaxesOnSupplies, platform);
  return {
    costCenterNames: matchedNames,
    noTaxesOnReceipts,
    noTaxesOnSupplies,
    title,
    message,
  };
}

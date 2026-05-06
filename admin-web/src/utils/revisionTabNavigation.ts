/**
 * Staff portal tab index for Mileage / Timesheet / Receipt Management (left-to-right).
 * Open the left-most tab that currently has revisions needed.
 */
export function computeStaffPortalRevisionTabIndex(
  counts: { mileage: number; receipts: number; time: number },
  costCenterCount: number
): number {
  const ccLen = Math.max(0, costCenterCount);
  const candidates = [
    { idx: 2, count: counts.mileage },
    { idx: ccLen + 4, count: counts.time },
    { idx: ccLen + 5, count: counts.receipts },
  ];
  const leftMostWithRevisions = candidates.find((tab) => tab.count > 0);
  return leftMostWithRevisions ? leftMostWithRevisions.idx : 0;
}

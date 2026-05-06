/**
 * Staff portal tab index for Mileage / Timesheet / Receipt Management (left-to-right).
 * Matches server logic in notificationService.computeStaffPortalTabIndexForRevisionReport:
 * highest unresolved count wins; ties go to the leftmost tab.
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
  const nonzero = candidates.filter((t) => t.count > 0);
  if (nonzero.length === 0) return 0;
  nonzero.sort((a, b) => (b.count !== a.count ? b.count - a.count : a.idx - b.idx));
  return nonzero[0].idx;
}

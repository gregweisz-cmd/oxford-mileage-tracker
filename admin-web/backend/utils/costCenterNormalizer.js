function normalizeCostCenter(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function costCentersMatch(a, b) {
  const left = normalizeCostCenter(a);
  const right = normalizeCostCenter(b);
  if (!left || !right) return false;
  return left === right;
}

module.exports = {
  normalizeCostCenter,
  costCentersMatch,
};


#!/usr/bin/env node
/**
 * Apply per-diem / travel policies for the cost centers defined in
 * config/perDiemPolicyDefinitions.js.
 *
 * Only those cost centers are modified. Every other cost center is left as-is.
 *
 * Usage (from admin-web/backend):
 *   node scripts/maintenance/seed-per-diem-policies.js [--dry-run]
 *
 * On Render (Shell on the API service with DATABASE_PATH set):
 *   node scripts/maintenance/seed-per-diem-policies.js --dry-run
 *   node scripts/maintenance/seed-per-diem-policies.js
 */

const dbService = require('../../services/dbService');
const { normalizeCostCenter } = require('../../utils/costCenterNormalizer');
const { PER_DIEM_POLICY_DEFINITIONS } = require('../../config/perDiemPolicyDefinitions');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function log(message, type = 'info') {
  const prefix = { info: '📝', success: '✅', error: '❌', warning: '⚠️', step: '🚀' }[type] || '📝';
  console.log(`${prefix} ${message}`);
}

function normalize(value) {
  return normalizeCostCenter(value);
}

function rowMatchesPolicy(row, policy) {
  const dbName = normalize(row.name);
  const dbCode = normalize(row.code);
  if (!dbName && !dbCode) return false;

  if (policy.matchPrefix) {
    const prefix = normalize(policy.matchPrefix);
    return (
      (dbName && dbName.startsWith(prefix)) ||
      (dbCode && dbCode.startsWith(prefix))
    );
  }

  // Exact match only — fuzzy includes() caused false positives (e.g. DC-SOR → OR-).
  const matchers = new Set((policy.matchers || []).map(normalize).filter(Boolean));
  return matchers.has(dbName) || matchers.has(dbCode);
}

function findMatches(allRows, policy, alreadyAssigned) {
  return allRows.filter((row) => {
    if (alreadyAssigned.has(row.id)) return false;
    return rowMatchesPolicy(row, policy);
  });
}

function appendDescription(existing, addition) {
  const current = String(existing || '').trim();
  const note = String(addition || '').trim();
  if (!note) return current;
  if (current.includes(note)) return current;
  return current ? `${current}\n\n${note}` : note;
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function savePerDiemRule(db, costCenterName, rule, dryRunMode) {
  const now = new Date().toISOString();
  const existing = await dbGet(
    db,
    'SELECT id, createdAt FROM per_diem_rules WHERE costCenter = ?',
    [costCenterName]
  );

  const ruleId =
    existing?.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const createdAt = existing?.createdAt || now;

  if (dryRunMode) {
    log(`Would ${existing ? 'update' : 'create'} per-diem rule for ${costCenterName}`, 'info');
    if (rule.ruleType === 'tiered') {
      log(`  Tiered: ${(rule.tiers || []).map((t) => t.label).join(', ') || '(none)'}`, 'info');
    } else if (rule.maxAmount === 0 && !rule.useActualAmount) {
      log('  No per diem (all days ineligible)', 'info');
    } else {
      log(`  Single: max $${rule.maxAmount}, min ${rule.minHours}h`, 'info');
    }
    return;
  }

  await dbRun(
    db,
    `INSERT OR REPLACE INTO per_diem_rules (
      id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase,
      description, useActualAmount, ruleType, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ruleId,
      costCenterName,
      rule.maxAmount,
      rule.minHours || 0,
      rule.minMiles || 0,
      rule.minDistanceFromBase || 0,
      rule.description || '',
      rule.useActualAmount ? 1 : 0,
      rule.ruleType === 'tiered' ? 'tiered' : 'single',
      createdAt,
      now,
    ]
  );

  await dbRun(db, 'DELETE FROM per_diem_tiers WHERE costCenter = ?', [costCenterName]);

  if (rule.ruleType === 'tiered' && Array.isArray(rule.tiers) && rule.tiers.length > 0) {
    for (let index = 0; index < rule.tiers.length; index += 1) {
      const tier = rule.tiers[index];
      const tierId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${index}`;
      await dbRun(
        db,
        `INSERT INTO per_diem_tiers (
          id, costCenter, label, amount, minHours, minMiles, minDistanceFromBase,
          requiresOvernight, sortOrder, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tierId,
          costCenterName,
          tier.label || `Tier ${index + 1}`,
          Number(tier.amount) || 0,
          Number(tier.minHours) || 0,
          Number(tier.minMiles) || 0,
          Number(tier.minDistanceFromBase) || 0,
          tier.requiresOvernight ? 1 : 0,
          Number(tier.sortOrder) || 0,
          now,
          now,
        ]
      );
    }
  }

  log(`Per-diem rule saved for ${costCenterName}`, 'success');
}

async function updateCostCenterFlags(db, row, policy, dryRunMode) {
  const updates = [];
  const params = [];

  if (policy.descriptionAppend) {
    const nextDescription = appendDescription(row.description, policy.descriptionAppend);
    if (nextDescription !== (row.description || '')) {
      updates.push('description = ?');
      params.push(nextDescription);
    }
  }

  if (policy.enableGoogleMaps === true && !row.enableGoogleMaps) {
    updates.push('enableGoogleMaps = ?');
    params.push(1);
  }

  if (updates.length === 0) return;

  const now = new Date().toISOString();
  params.push(now, row.id);

  if (dryRunMode) {
    log(`Would update cost center flags for ${row.name}`, 'info');
    if (policy.enableGoogleMaps) log('  enableGoogleMaps = true', 'info');
    if (policy.descriptionAppend) log(`  append policy note`, 'info');
    return;
  }

  await dbRun(
    db,
    `UPDATE cost_centers SET ${updates.join(', ')}, updatedAt = ? WHERE id = ?`,
    params
  );
  log(`Cost center updated: ${row.name}`, 'success');
}

async function main() {
  log('Seeding per-diem policies (listed cost centers only)', 'step');
  if (dryRun) log('DRY RUN — no database writes', 'warning');

  await dbService.initDatabase();
  const db = dbService.getDb();
  const allCostCenters = await dbAll(db, 'SELECT id, code, name, description, enableGoogleMaps FROM cost_centers');

  const assigned = new Set();
  const summary = { matched: 0, perDiemUpdated: 0, flagsUpdated: 0, unmatchedPolicies: [] };

  for (const policy of PER_DIEM_POLICY_DEFINITIONS) {
    const matches = findMatches(allCostCenters, policy, assigned);
    if (matches.length === 0) {
      summary.unmatchedPolicies.push(policy.key);
      log(`No cost center match for policy "${policy.key}"`, 'warning');
      continue;
    }

    for (const row of matches) {
      assigned.add(row.id);
      summary.matched += 1;
      log(`Applying "${policy.key}" → ${row.name}`, 'info');

      if (policy.perDiem) {
        await savePerDiemRule(db, row.name, policy.perDiem, dryRun);
        summary.perDiemUpdated += 1;
      }

      if (policy.descriptionAppend || policy.enableGoogleMaps) {
        await updateCostCenterFlags(db, row, policy, dryRun);
        summary.flagsUpdated += 1;
      }
    }
  }

  log('', 'info');
  log(`Matched ${summary.matched} cost center(s)`, 'success');
  log(`Per-diem rules touched: ${summary.perDiemUpdated}`, 'info');
  log(`Cost-center flags/notes touched: ${summary.flagsUpdated}`, 'info');
  log(`All other cost centers left unchanged`, 'info');

  if (summary.unmatchedPolicies.length > 0) {
    log(
      `Unmatched policy keys (verify names in Admin → Cost Centers): ${summary.unmatchedPolicies.join(', ')}`,
      'warning'
    );
  }

  process.exit(0);
}

main().catch((err) => {
  log(err.message || String(err), 'error');
  process.exit(1);
});

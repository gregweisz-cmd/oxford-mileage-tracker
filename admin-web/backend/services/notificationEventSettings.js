/**
 * Admin-configurable workflow notification events (in-app row + email).
 * Templates support {placeholder} tokens documented per event.
 */

const dbService = require('./dbService');
const { debugWarn } = require('../debug');

/** Used when `hoursThreshold` is unset in the DB for the weekly hours supervisor alert */
const DEFAULT_WEEKLY_HOURS_ALERT_THRESHOLD = 60;
const WEEKLY_HOURS_ALERT_MIN = 1;
const WEEKLY_HOURS_ALERT_MAX = 168;

function resolveWeeklyHoursThresholdFromRow(row) {
  if (!row || row.hoursThreshold == null || row.hoursThreshold === '') {
    return DEFAULT_WEEKLY_HOURS_ALERT_THRESHOLD;
  }
  const num = Number(row.hoursThreshold);
  if (!Number.isFinite(num)) return DEFAULT_WEEKLY_HOURS_ALERT_THRESHOLD;
  return Math.min(WEEKLY_HOURS_ALERT_MAX, Math.max(WEEKLY_HOURS_ALERT_MIN, Math.round(num)));
}

/** Stable keys — add new workflow notifications here and wire in notificationService */
const NOTIFICATION_EVENT_DEFINITIONS = {
  report_submitted: {
    displayName: 'Report submitted for review',
    description:
      'Notifies the first approver (senior staff in workflow, else supervisor) when an employee submits an expense report.',
    notificationType: 'report_submitted',
    placeholders: ['employeeName', 'monthName'],
  },
  supervisor_approval_needed: {
    displayName: 'Report ready for supervisor (after senior staff)',
    description: 'Notifies the employee’s supervisor when senior staff has approved and the report needs supervisor review.',
    notificationType: 'approval_needed',
    placeholders: ['employeeName', 'monthName', 'actorName'],
  },
  finance_approval_needed: {
    displayName: 'Report ready for finance',
    description: 'Notifies each finance approver when a supervisor has approved and the report is ready for finance review.',
    notificationType: 'approval_needed',
    placeholders: ['employeeName', 'monthName', 'actorName'],
  },
  finance_revision_supervisor: {
    displayName: 'Finance requested revisions (to supervisor)',
    description: 'Notifies the supervisor when finance requests changes on an employee’s report.',
    notificationType: 'revision_requested',
    placeholders: ['employeeName', 'monthName', 'actorName'],
  },
  supervisor_revision_employee: {
    displayName: 'Supervisor requested revisions (to employee)',
    description: 'Notifies the employee when their supervisor requests report revisions.',
    notificationType: 'revision_requested',
    placeholders: ['employeeName', 'monthName', 'actorName'],
  },
  employee_report_approved: {
    displayName: 'Report fully approved (employee)',
    description: 'Notifies the employee when their report is fully approved (monthly after finance, or weekly after supervisor).',
    notificationType: 'report_approved',
    placeholders: ['monthName', 'actorName', 'reportKind'],
  },
  sunday_reminder: {
    displayName: 'Sunday submission reminder',
    description: 'Weekly reminder to employees who have Sunday reminders enabled (scheduled job).',
    notificationType: 'sunday_reminder',
    placeholders: [],
  },
  fifty_plus_hours_alert: {
    displayName: 'Weekly hours threshold (supervisor)',
    description:
      'Alerts the supervisor when an employee reaches the configured weekly total (calendar week Sunday–Saturday). At most one email per employee per week. Admins set the hour threshold below.',
    notificationType: '50_plus_hours_alert',
    placeholders: ['employeeName', 'totalHours', 'weekRange', 'hoursThreshold'],
  },
};

function listDefinitions() {
  return Object.entries(NOTIFICATION_EVENT_DEFINITIONS).map(([eventKey, meta]) => ({
    eventKey,
    ...meta,
  }));
}

function applyTemplate(template, ctx) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (ctx[key] === undefined || ctx[key] === null) return `{${key}}`;
    return String(ctx[key]);
  });
}

async function getEventRow(eventKey) {
  const db = dbService.getDb();
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM notification_event_settings WHERE eventKey = ?', [eventKey], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

/** Effective weekly hours threshold for supervisor alerts (reads admin setting). */
async function getWeeklyHoursAlertThreshold() {
  const row = await getEventRow('fifty_plus_hours_alert');
  return resolveWeeklyHoursThresholdFromRow(row);
}

/**
 * Merge DB row with defaults; apply optional title/message templates.
 * @returns {{ title: string, message: string, inAppEnabled: boolean, emailEnabled: boolean, notificationType: string }}
 */
async function resolveDelivery(eventKey, defaults, templateContext = {}) {
  const meta = NOTIFICATION_EVENT_DEFINITIONS[eventKey];
  if (!meta) {
    debugWarn('⚠️ Unknown notification eventKey:', eventKey);
    return {
      title: defaults.title,
      message: defaults.message,
      inAppEnabled: true,
      emailEnabled: true,
      notificationType: eventKey,
    };
  }

  let row;
  try {
    row = await getEventRow(eventKey);
  } catch (e) {
    row = null;
  }

  const inAppEnabled = row ? Number(row.inAppEnabled) !== 0 : true;
  const emailEnabled = row ? Number(row.emailEnabled) !== 0 : true;

  const title =
    row && row.titleTemplate && String(row.titleTemplate).trim()
      ? applyTemplate(row.titleTemplate, templateContext)
      : defaults.title;
  const message =
    row && row.messageTemplate && String(row.messageTemplate).trim()
      ? applyTemplate(row.messageTemplate, templateContext)
      : defaults.message;

  return {
    title,
    message,
    inAppEnabled,
    emailEnabled,
    notificationType: meta.notificationType,
  };
}

async function listAllForAdmin() {
  const db = dbService.getDb();
  const rows = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM notification_event_settings', [], (err, r) => (err ? reject(err) : resolve(r || [])));
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.eventKey, r]));

  return listDefinitions().map((def) => {
    const row = byKey[def.eventKey];
    const weeklyHoursThreshold =
      def.eventKey === 'fifty_plus_hours_alert' ? resolveWeeklyHoursThresholdFromRow(row) : null;
    const weeklyHoursThresholdIsDefault =
      def.eventKey === 'fifty_plus_hours_alert' && (!row || row.hoursThreshold == null || row.hoursThreshold === '');

    return {
      eventKey: def.eventKey,
      displayName: def.displayName,
      description: def.description,
      notificationType: def.notificationType,
      placeholders: def.placeholders,
      inAppEnabled: row ? Number(row.inAppEnabled) !== 0 : true,
      emailEnabled: row ? Number(row.emailEnabled) !== 0 : true,
      titleTemplate: row?.titleTemplate ?? null,
      messageTemplate: row?.messageTemplate ?? null,
      updatedAt: row?.updatedAt ?? null,
      weeklyHoursThreshold,
      weeklyHoursThresholdIsDefault,
      defaultWeeklyHoursThreshold:
        def.eventKey === 'fifty_plus_hours_alert' ? DEFAULT_WEEKLY_HOURS_ALERT_THRESHOLD : null,
    };
  });
}

async function updateEventSetting(eventKey, body) {
  if (!NOTIFICATION_EVENT_DEFINITIONS[eventKey]) {
    const err = new Error('Unknown notification event');
    err.statusCode = 400;
    throw err;
  }

  const existing = await getEventRow(eventKey);
  if (!existing) {
    const err = new Error('Event row missing');
    err.statusCode = 500;
    throw err;
  }

  const inAppEnabled =
    body.inAppEnabled === undefined ? Number(existing.inAppEnabled) : body.inAppEnabled ? 1 : 0;
  const emailEnabled =
    body.emailEnabled === undefined ? Number(existing.emailEnabled) : body.emailEnabled ? 1 : 0;

  let titleTemplate = existing.titleTemplate;
  if (body.titleTemplate !== undefined) {
    titleTemplate =
      body.titleTemplate === null || body.titleTemplate === '' ? null : String(body.titleTemplate);
  }
  let messageTemplate = existing.messageTemplate;
  if (body.messageTemplate !== undefined) {
    messageTemplate =
      body.messageTemplate === null || body.messageTemplate === '' ? null : String(body.messageTemplate);
  }

  let hoursThreshold = existing.hoursThreshold ?? null;
  if (eventKey === 'fifty_plus_hours_alert' && body.hoursThreshold !== undefined) {
    if (body.hoursThreshold === null || body.hoursThreshold === '') {
      hoursThreshold = null;
    } else {
      const n = Number(body.hoursThreshold);
      if (!Number.isFinite(n)) {
        const err = new Error('hoursThreshold must be a number');
        err.statusCode = 400;
        throw err;
      }
      const rounded = Math.round(n);
      if (rounded < WEEKLY_HOURS_ALERT_MIN || rounded > WEEKLY_HOURS_ALERT_MAX) {
        const err = new Error(`hoursThreshold must be between ${WEEKLY_HOURS_ALERT_MIN} and ${WEEKLY_HOURS_ALERT_MAX}`);
        err.statusCode = 400;
        throw err;
      }
      hoursThreshold = rounded;
    }
  }

  const now = new Date().toISOString();
  const db = dbService.getDb();

  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE notification_event_settings
       SET inAppEnabled = ?, emailEnabled = ?, titleTemplate = ?, messageTemplate = ?, hoursThreshold = ?, updatedAt = ?
       WHERE eventKey = ?`,
      [inAppEnabled, emailEnabled, titleTemplate, messageTemplate, hoursThreshold, now, eventKey],
      function (err) {
        if (err) return reject(err);
        if (this.changes === 0) return reject(Object.assign(new Error('Event not updated'), { statusCode: 500 }));
        resolve();
      }
    );
  });

  return getEventRow(eventKey);
}

module.exports = {
  NOTIFICATION_EVENT_DEFINITIONS,
  DEFAULT_WEEKLY_HOURS_ALERT_THRESHOLD,
  listDefinitions,
  resolveDelivery,
  listAllForAdmin,
  updateEventSetting,
  applyTemplate,
  getWeeklyHoursAlertThreshold,
};

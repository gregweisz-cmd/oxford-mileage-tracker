/**
 * Suggested starting odometer for the next mileage entry (mirrors mobile DatabaseService logic).
 */

function dateKeyFromEntry(dateStr) {
  return String(dateStr || '').split('T')[0];
}

function computeDayEnding(entries, dailyReading) {
  const totalMiles = entries.reduce((sum, entry) => sum + (Number(entry.miles) || 0), 0);
  let fallbackStart = null;
  for (const entry of entries) {
    const reading = Number(entry.odometerReading) || 0;
    if (reading > 0) {
      fallbackStart = fallbackStart === null ? reading : Math.min(fallbackStart, reading);
    }
  }
  const startingOdometer = dailyReading ?? fallbackStart ?? 0;
  return {
    startingOdometer,
    totalMiles,
    endingOdometer: Math.round(startingOdometer + totalMiles),
  };
}

function groupEntriesByDay(entries) {
  const map = new Map();
  for (const entry of entries) {
    const key = dateKeyFromEntry(entry.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }
  return map;
}

function formatLastTravelDayNote(dateKey, endingOdometer) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dateText = new Date(year, month - 1, day).toLocaleDateString('en-US');
  return `Ending odometer of last travel day (${dateText}): ${Math.round(endingOdometer)}`;
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function getDailyOdometerReading(db, employeeId, dateKey) {
  const row = await dbGet(
    db,
    'SELECT odometerReading FROM daily_odometer_readings WHERE employeeId = ? AND date = ?',
    [employeeId, dateKey]
  );
  if (!row || row.odometerReading == null) return null;
  const reading = Number(row.odometerReading);
  return Number.isFinite(reading) ? reading : null;
}

async function getLastTravelDayEnding(db, employeeId, beforeDateKey) {
  const allEntries = await dbAll(
    db,
    'SELECT date, miles, odometerReading FROM mileage_entries WHERE employeeId = ? ORDER BY date DESC',
    [employeeId]
  );
  const entriesBefore = allEntries.filter((entry) => dateKeyFromEntry(entry.date) < beforeDateKey);
  if (!entriesBefore.length) return null;

  const byDay = groupEntriesByDay(entriesBefore);
  const latestDayKey = Array.from(byDay.keys()).sort().pop();
  if (!latestDayKey) return null;

  const dailyReading = await getDailyOdometerReading(db, employeeId, latestDayKey);
  const ending = computeDayEnding(byDay.get(latestDayKey) || [], dailyReading);
  if (ending.endingOdometer <= 0) return null;

  return {
    dateKey: latestDayKey,
    endingOdometer: ending.endingOdometer,
  };
}

/**
 * Resolve suggested starting odometer and helper note for a new mileage entry.
 */
async function resolveSuggestedStartingOdometer(db, employeeId, dateStr) {
  const normalizedDate = dateKeyFromEntry(dateStr);
  if (!employeeId || !normalizedDate) {
    return {
      suggestedOdometer: null,
      prefillSource: null,
      lastTravelDayNote: '',
      lastTravelDayDate: null,
    };
  }

  const lastTravelDay = await getLastTravelDayEnding(db, employeeId, normalizedDate);
  const lastTravelDayNote =
    lastTravelDay && lastTravelDay.endingOdometer > 0
      ? formatLastTravelDayNote(lastTravelDay.dateKey, lastTravelDay.endingOdometer)
      : '';

  const dayEntries = await dbAll(
    db,
    'SELECT miles, odometerReading FROM mileage_entries WHERE employeeId = ? AND date LIKE ? ORDER BY COALESCE(sortOrder, 0) ASC',
    [employeeId, `${normalizedDate}%`]
  );

  if (dayEntries.length > 0) {
    const dailyReading = await getDailyOdometerReading(db, employeeId, normalizedDate);
    const todayEnding = computeDayEnding(dayEntries, dailyReading);
    if (todayEnding.endingOdometer > 0) {
      return {
        suggestedOdometer: todayEnding.endingOdometer,
        prefillSource: 'today_ending',
        lastTravelDayNote,
        lastTravelDayDate: lastTravelDay?.dateKey || null,
      };
    }
  }

  if (lastTravelDay && lastTravelDay.endingOdometer > 0) {
    return {
      suggestedOdometer: lastTravelDay.endingOdometer,
      prefillSource: 'last_travel_day',
      lastTravelDayNote,
      lastTravelDayDate: lastTravelDay.dateKey,
    };
  }

  return {
    suggestedOdometer: null,
    prefillSource: null,
    lastTravelDayNote: '',
    lastTravelDayDate: null,
  };
}

module.exports = {
  resolveSuggestedStartingOdometer,
};

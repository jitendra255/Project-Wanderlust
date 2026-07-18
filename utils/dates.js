// Booking dates are whole days, pinned to UTC midnight, so a stay means the
// same nights regardless of the server's timezone.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse a "YYYY-MM-DD" form value into a UTC-midnight Date, or null. */
function parseDay(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Today at UTC midnight. */
function todayUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Whole nights between two UTC-midnight dates. */
function nightsBetween(checkIn, checkOut) {
    return Math.round((checkOut - checkIn) / MS_PER_DAY);
}

/** Format a Date back to "YYYY-MM-DD" for date inputs. */
function formatDay(date) {
    return new Date(date).toISOString().slice(0, 10);
}

module.exports = { MS_PER_DAY, parseDay, todayUtc, nightsBetween, formatDay };

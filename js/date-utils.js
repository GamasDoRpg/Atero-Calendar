const LOCALE = "pt-BR";
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

export function cloneDate(value) {
  return new Date(value instanceof Date ? value.getTime() : value);
}

export function createDate(
  year,
  month = 0,
  day = 1,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0
) {
  const date = new Date(0);
  date.setHours(hours, minutes, seconds, milliseconds);
  date.setFullYear(year, month, day);
  return date;
}

export function clampYear(year) {
  const numericYear = Number(year);

  if (!Number.isInteger(numericYear)) {
    return null;
  }

  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, numericYear));
}

export function startOfDay(value) {
  const date = cloneDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value) {
  const date = cloneDate(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function startOfWeek(value) {
  const date = startOfDay(value);
  const weekday = date.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + offset);
  return date;
}

export function endOfWeek(value) {
  return endOfDay(addDays(startOfWeek(value), 6));
}

export function startOfMonth(value) {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

export function endOfMonth(value) {
  const date = startOfMonth(value);
  date.setMonth(date.getMonth() + 1, 0);
  return endOfDay(date);
}

export function startOfYear(value) {
  const date = startOfDay(value);
  date.setMonth(0, 1);
  return date;
}

export function endOfYear(value) {
  const date = startOfDay(value);
  date.setMonth(11, 31);
  return endOfDay(date);
}

export function daysInMonth(year, month) {
  const date = createDate(year, month + 1, 0);
  return date.getDate();
}

export function addDays(value, amount) {
  const date = cloneDate(value);
  date.setDate(date.getDate() + amount);
  return date;
}

export function addMonths(value, amount) {
  const date = cloneDate(value);
  const originalDay = date.getDate();
  const targetMonth = date.getMonth() + amount;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const safeDay = Math.min(originalDay, daysInMonth(targetYear, normalizedMonth));

  date.setDate(1);
  date.setFullYear(targetYear, normalizedMonth, safeDay);
  return date;
}

export function addYears(value, amount) {
  const date = cloneDate(value);
  const targetYear = clampYear(date.getFullYear() + amount);

  if (targetYear === null) {
    return date;
  }

  return setYear(date, targetYear);
}

export function setYear(value, year) {
  const targetYear = clampYear(year);

  if (targetYear === null) {
    return null;
  }

  const date = cloneDate(value);
  const month = date.getMonth();
  const day = Math.min(date.getDate(), daysInMonth(targetYear, month));
  date.setDate(1);
  date.setFullYear(targetYear, month, day);
  return date;
}

export function addMinutes(value, amount) {
  const date = cloneDate(value);
  date.setMinutes(date.getMinutes() + amount);
  return date;
}

export function sameDay(a, b) {
  const left = cloneDate(a);
  const right = cloneDate(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function sameMonth(a, b) {
  const left = cloneDate(a);
  const right = cloneDate(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

export function sameYear(a, b) {
  return cloneDate(a).getFullYear() === cloneDate(b).getFullYear();
}

export function toDateInput(value) {
  const date = cloneDate(value);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toTimeInput(value) {
  const date = cloneDate(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function parseLocalDate(dateValue, timeValue = "00:00") {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] = String(dateValue).split("-").map(Number);
  const [hours, minutes] = String(timeValue || "00:00").split(":").map(Number);

  if (![year, month, day, hours, minutes].every(Number.isFinite)) {
    return null;
  }

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    year < MIN_YEAR ||
    year > MAX_YEAR ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month - 1) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return createDate(year, month - 1, day, hours, minutes);
}

export function roundToNextMinutes(value, interval = 30) {
  const date = cloneDate(value);
  date.setSeconds(0, 0);
  const minutes = date.getMinutes();
  const rounded = Math.ceil(minutes / interval) * interval;
  date.setMinutes(rounded);
  return date;
}

export function monthGridRange(value) {
  const monthStart = startOfMonth(value);
  const start = startOfWeek(monthStart);
  const end = endOfDay(addDays(start, 41));
  return { start, end };
}

export function visibleRange(value, view) {
  if (view === "day") {
    return {
      start: startOfDay(value),
      end: endOfDay(value)
    };
  }

  if (view === "week") {
    return {
      start: startOfWeek(value),
      end: endOfWeek(value)
    };
  }

  if (view === "year") {
    return {
      start: startOfYear(value),
      end: endOfYear(value)
    };
  }

  return monthGridRange(value);
}

export function movePeriod(value, view, direction) {
  if (view === "day") {
    return addDays(value, direction);
  }

  if (view === "week") {
    return addDays(value, direction * 7);
  }

  if (view === "year") {
    return addYears(value, direction);
  }

  return addMonths(value, direction);
}

export function formatPeriodTitle(value, view) {
  const date = cloneDate(value);

  if (view === "year") {
    return String(date.getFullYear());
  }

  if (view === "day") {
    return new Intl.DateTimeFormat(LOCALE, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  if (view === "week") {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    const startMonth = new Intl.DateTimeFormat(LOCALE, { month: "short" }).format(start);
    const endMonth = new Intl.DateTimeFormat(LOCALE, { month: "short" }).format(end);

    if (start.getFullYear() !== end.getFullYear()) {
      return `${start.getDate()} ${startMonth} ${start.getFullYear()} — ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
    }

    if (start.getMonth() !== end.getMonth()) {
      return `${start.getDate()} ${startMonth} — ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
    }

    return `${start.getDate()}–${end.getDate()} de ${new Intl.DateTimeFormat(LOCALE, {
      month: "long",
      year: "numeric"
    }).format(end)}`;
  }

  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatMonthTitle(value) {
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric"
  }).format(cloneDate(value));
}

export function formatMonthName(value, width = "long") {
  return new Intl.DateTimeFormat(LOCALE, {
    month: width
  }).format(cloneDate(value));
}

export function formatWeekday(value, width = "short") {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: width
  }).format(cloneDate(value));
}

export function formatTime(value) {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(cloneDate(value));
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(cloneDate(value));
}

export function normalizeIso(value) {
  const date = cloneDate(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function eventOverlapsRange(event, rangeStart, rangeEnd) {
  const startsAt = new Date(event.starts_at);
  const endsAt = new Date(event.ends_at);
  return startsAt <= rangeEnd && endsAt >= rangeStart;
}

export function eventOccursOnDay(event, day) {
  return eventOverlapsRange(event, startOfDay(day), endOfDay(day));
}

export function durationMinutes(start, end) {
  return Math.max(0, Math.round((cloneDate(end) - cloneDate(start)) / 60000));
}

export function minutesSinceStartOfDay(value) {
  const date = cloneDate(value);
  return date.getHours() * 60 + date.getMinutes();
}

export function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export const YEAR_LIMITS = Object.freeze({
  min: MIN_YEAR,
  max: MAX_YEAR
});

const LOCALE = "pt-BR";

export function cloneDate(value) {
  return new Date(value instanceof Date ? value.getTime() : value);
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
  const date = startOfDay(value);
  date.setMonth(date.getMonth() + 1, 0);
  return endOfDay(date);
}

export function addDays(value, amount) {
  const date = cloneDate(value);
  date.setDate(date.getDate() + amount);
  return date;
}

export function addMonths(value, amount) {
  const date = cloneDate(value);
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
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

export function toDateInput(value) {
  const date = cloneDate(value);
  const year = date.getFullYear();
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

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = String(timeValue || "00:00").split(":").map(Number);

  if (![year, month, day, hours, minutes].every(Number.isFinite)) {
    return null;
  }

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
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

  return monthGridRange(value);
}

export function movePeriod(value, view, direction) {
  if (view === "day") {
    return addDays(value, direction);
  }

  if (view === "week") {
    return addDays(value, direction * 7);
  }

  return addMonths(value, direction);
}

export function formatPeriodTitle(value, view) {
  const date = cloneDate(value);

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

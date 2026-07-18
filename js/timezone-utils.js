function utcStamp(year, month, day, hour, minute, second = 0) {
  const date = new Date(0);
  date.setUTCHours(hour, minute, second, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime();
}

function parseInput(dateValue, timeValue = "00:00") {
  const [year, month, day] = String(dateValue || "").split("-").map(Number);
  const [hour, minute] = String(timeValue || "00:00").split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isInteger)) return null;
  return { year, month, day, hour, minute };
}

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(value, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second
  };
}

export function zonedDateTimeToDate(dateValue, timeValue, timeZone) {
  const desired = parseInput(dateValue, timeValue);
  if (!desired || !isValidTimeZone(timeZone)) return null;
  const desiredStamp = utcStamp(
    desired.year,
    desired.month,
    desired.day,
    desired.hour,
    desired.minute
  );
  let instant = desiredStamp;
  for (let index = 0; index < 4; index += 1) {
    const current = zonedParts(new Date(instant), timeZone);
    const representedStamp = utcStamp(
      current.year,
      current.month,
      current.day,
      current.hour,
      current.minute
    );
    const difference = representedStamp - desiredStamp;
    if (difference === 0) break;
    instant -= difference;
  }
  const result = new Date(instant);
  const finalParts = zonedParts(result, timeZone);
  if (
    finalParts.year !== desired.year ||
    finalParts.month !== desired.month ||
    finalParts.day !== desired.day ||
    finalParts.hour !== desired.hour ||
    finalParts.minute !== desired.minute
  ) return null;
  return result;
}

export function toZonedDateInput(value, timeZone) {
  const parts = zonedParts(value, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function toZonedTimeInput(value, timeZone) {
  const parts = zonedParts(value, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

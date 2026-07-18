const API_BASE_URL = "https://api.atero.space";
const API_EVENTS_PATH = "/calendar/events";
const API_CALENDARS_PATH = "/calendar/calendars";
const LOCAL_EVENTS_PREFIX = "atero-calendar-events";
const LOCAL_CALENDARS_PREFIX = "atero-calendar-calendars";
const REQUEST_TIMEOUT = 15000;

let eventStorageKey = `${LOCAL_EVENTS_PREFIX}-anonymous`;
let calendarStorageKey = `${LOCAL_CALENDARS_PREFIX}-anonymous`;
let persistenceMode = "local";

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function safeId(value) {
  return String(value || "anonymous")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, "-")
    .slice(0, 120) || "anonymous";
}

export function configureApi({ user }) {
  const identity = user?.id || user?.email || user?.user_metadata?.email;
  const suffix = safeId(identity);
  eventStorageKey = `${LOCAL_EVENTS_PREFIX}-${suffix}`;
  calendarStorageKey = `${LOCAL_CALENDARS_PREFIX}-${suffix}`;
}

export function getPersistenceMode() {
  return persistenceMode;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(data, status) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") return detail.message || detail.code || `HTTP ${status}`;
  return data?.message || `A API retornou HTTP ${status}.`;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const method = String(options.method || "GET").toUpperCase();
  const writesData = !["GET", "HEAD", "OPTIONS"].includes(method);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(writesData ? { "X-Atero-Request": "1" } : {}),
        ...options.headers
      },
      signal: controller.signal
    });
    const data = await parseResponse(response);
    if (!response.ok) {
      throw new ApiError(errorMessage(data, response.status), response.status, data);
    }
    persistenceMode = "api";
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError("A API demorou para responder.", 0);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function canUseLocalFallback(error) {
  if (!(error instanceof ApiError)) return true;
  return [0, 404, 405, 501, 502, 503, 504].includes(error.status);
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error("Falha ao ler armazenamento local:", error);
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  persistenceMode = "local";
}

function localId(prefix) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeList(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function defaultLocalCalendars() {
  return [{
    id: "default",
    name: "Pessoal",
    color: "#00c7df",
    visible: true,
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }];
}

export async function listCalendars() {
  try {
    return normalizeList(await request(API_CALENDARS_PATH), "calendars");
  } catch (error) {
    if (!canUseLocalFallback(error)) throw error;
    persistenceMode = "local";
    const calendars = readJson(calendarStorageKey, defaultLocalCalendars());
    if (!Array.isArray(calendars) || calendars.length === 0) {
      const defaults = defaultLocalCalendars();
      writeJson(calendarStorageKey, defaults);
      return defaults;
    }
    return calendars;
  }
}

export async function createCalendar(payload) {
  try {
    const data = await request(API_CALENDARS_PATH, { method: "POST", body: JSON.stringify(payload) });
    return data?.calendar || data;
  } catch (error) {
    if (!canUseLocalFallback(error)) throw error;
    const calendars = await listCalendars();
    const now = new Date().toISOString();
    if (payload.is_default) calendars.forEach((calendar) => { calendar.is_default = false; });
    const calendar = { ...payload, id: localId("cal"), created_at: now, updated_at: now };
    calendars.push(calendar);
    writeJson(calendarStorageKey, calendars);
    return calendar;
  }
}

export async function updateCalendar(calendarId, payload) {
  try {
    const data = await request(`${API_CALENDARS_PATH}/${encodeURIComponent(calendarId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    return data?.calendar || data;
  } catch (error) {
    if (!canUseLocalFallback(error)) throw error;
    const calendars = await listCalendars();
    const index = calendars.findIndex((calendar) => calendar.id === calendarId);
    if (index < 0) throw new ApiError("Calendário não encontrado.", 404);
    if (payload.is_default) calendars.forEach((calendar) => { calendar.is_default = false; });
    calendars[index] = { ...calendars[index], ...payload, id: calendarId, updated_at: new Date().toISOString() };
    writeJson(calendarStorageKey, calendars);
    return calendars[index];
  }
}

export async function deleteCalendar(calendarId) {
  try {
    await request(`${API_CALENDARS_PATH}/${encodeURIComponent(calendarId)}`, { method: "DELETE" });
    return true;
  } catch (error) {
    if (!canUseLocalFallback(error)) throw error;
    const calendars = await listCalendars();
    if (calendars.length <= 1) throw new ApiError("A conta precisa manter ao menos um calendário.", 409);
    const current = calendars.find((calendar) => calendar.id === calendarId);
    const next = calendars.filter((calendar) => calendar.id !== calendarId);
    if (!current) throw new ApiError("Calendário não encontrado.", 404);
    if (current.is_default) next[0].is_default = true;
    writeJson(calendarStorageKey, next);
    const events = readJson(eventStorageKey, []).filter((event) => event.calendar_id !== calendarId);
    writeJson(eventStorageKey, events);
    return true;
  }
}

export async function listEvents({ start, end }) {
  const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
  try {
    return normalizeList(await request(`${API_EVENTS_PATH}?${params}`), "events");
  } catch (error) {
    if (!canUseLocalFallback(error)) throw error;
    persistenceMode = "local";
    return readJson(eventStorageKey, []).filter((event) => {
      const startsAt = new Date(event.starts_at);
      const endsAt = new Date(event.ends_at);
      return startsAt <= end && endsAt >= start;
    });
  }
}

export async function createEvent(payload) {
  try {
    const data = await request(API_EVENTS_PATH, { method: "POST", body: JSON.stringify(payload) });
    return data?.event || data;
  } catch (error) {
    if (!canUseLocalFallback(error)) throw error;
    const now = new Date().toISOString();
    const event = { ...payload, id: localId("evt"), created_at: now, updated_at: now };
    const events = readJson(eventStorageKey, []);
    events.push(event);
    writeJson(eventStorageKey, events);
    return event;
  }
}

export async function updateEvent(eventId, payload) {
  try {
    const data = await request(`${API_EVENTS_PATH}/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    return data?.event || data;
  } catch (error) {
    if (!canUseLocalFallback(error)) throw error;
    const events = readJson(eventStorageKey, []);
    const index = events.findIndex((event) => event.id === eventId);
    if (index < 0) throw new ApiError("O evento não foi encontrado no armazenamento local.", 404);
    events[index] = { ...events[index], ...payload, id: eventId, updated_at: new Date().toISOString() };
    writeJson(eventStorageKey, events);
    return events[index];
  }
}

export async function deleteEvent(eventId) {
  try {
    await request(`${API_EVENTS_PATH}/${encodeURIComponent(eventId)}`, { method: "DELETE" });
    return true;
  } catch (error) {
    if (!canUseLocalFallback(error)) throw error;
    const events = readJson(eventStorageKey, []);
    const next = events.filter((event) => event.id !== eventId);
    if (next.length === events.length) throw new ApiError("O evento não foi encontrado.", 404);
    writeJson(eventStorageKey, next);
    return true;
  }
}

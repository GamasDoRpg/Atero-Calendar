const API_BASE_URL = "https://api.atero.space";
const API_EVENTS_PATH = "/calendar/events";
const LOCAL_STORAGE_PREFIX = "atero-calendar-events";
const REQUEST_TIMEOUT = 12000;

let storageKey = `${LOCAL_STORAGE_PREFIX}-anonymous`;
let persistenceMode = "local";

class ApiError extends Error {
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
  storageKey = `${LOCAL_STORAGE_PREFIX}-${safeId(identity)}`;
}

export function getPersistenceMode() {
  return persistenceMode;
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      },
      signal: controller.signal
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      const message = data?.detail || data?.message || `A API retornou HTTP ${response.status}.`;
      throw new ApiError(message, response.status, data);
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
  if (!(error instanceof ApiError)) {
    return true;
  }

  return [0, 404, 405, 501, 502, 503, 504].includes(error.status);
}

function readLocalEvents() {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Não foi possível ler os eventos locais:", error);
    return [];
  }
}

function writeLocalEvents(events) {
  localStorage.setItem(storageKey, JSON.stringify(events));
  persistenceMode = "local";
}

function localId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeApiList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.events)) {
    return data.events;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

export async function listEvents({ start, end }) {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString()
  });

  try {
    const data = await request(`${API_EVENTS_PATH}?${params.toString()}`);
    return normalizeApiList(data);
  } catch (error) {
    if (!canUseLocalFallback(error)) {
      throw error;
    }

    console.info("A API do Calendar ainda não está disponível; usando armazenamento local.");
    persistenceMode = "local";

    return readLocalEvents().filter((event) => {
      const startsAt = new Date(event.starts_at);
      const endsAt = new Date(event.ends_at);
      return startsAt <= end && endsAt >= start;
    });
  }
}

export async function createEvent(payload) {
  try {
    const data = await request(API_EVENTS_PATH, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    return data?.event || data;
  } catch (error) {
    if (!canUseLocalFallback(error)) {
      throw error;
    }

    const now = new Date().toISOString();
    const event = {
      ...payload,
      id: localId(),
      created_at: now,
      updated_at: now
    };
    const events = readLocalEvents();
    events.push(event);
    writeLocalEvents(events);
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
    if (!canUseLocalFallback(error)) {
      throw error;
    }

    const events = readLocalEvents();
    const index = events.findIndex((event) => event.id === eventId);

    if (index < 0) {
      throw new ApiError("O evento não foi encontrado no armazenamento local.", 404);
    }

    const event = {
      ...events[index],
      ...payload,
      id: eventId,
      updated_at: new Date().toISOString()
    };

    events[index] = event;
    writeLocalEvents(events);
    return event;
  }
}

export async function deleteEvent(eventId) {
  try {
    await request(`${API_EVENTS_PATH}/${encodeURIComponent(eventId)}`, {
      method: "DELETE"
    });
    return true;
  } catch (error) {
    if (!canUseLocalFallback(error)) {
      throw error;
    }

    const events = readLocalEvents();
    const nextEvents = events.filter((event) => event.id !== eventId);

    if (nextEvents.length === events.length) {
      throw new ApiError("O evento não foi encontrado no armazenamento local.", 404);
    }

    writeLocalEvents(nextEvents);
    return true;
  }
}

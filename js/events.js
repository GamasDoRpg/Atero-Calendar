import {
  createEvent as apiCreateEvent,
  deleteEvent as apiDeleteEvent,
  getPersistenceMode,
  listEvents,
  updateEvent as apiUpdateEvent
} from "./api.js?v=4";
import {
  getState,
  removeEventFromState,
  setState,
  upsertEventInState
} from "./state.js?v=4";

const DEFAULT_COLOR = "#00c7df";
const VALID_FREQUENCIES = new Set(["none", "daily", "weekly", "monthly", "yearly"]);

function safeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR;
}

function safeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeDate(value, fallback = null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

function normalizeEvent(event) {
  const startsAt = normalizeDate(event.starts_at || event.startsAt || event.start);
  const endsAt = normalizeDate(event.ends_at || event.endsAt || event.end);
  if (!startsAt || !endsAt) throw new Error("A API retornou um evento com datas inválidas.");
  const frequency = VALID_FREQUENCIES.has(event.recurrence_frequency) ? event.recurrence_frequency : "none";
  return {
    id: String(event.id),
    series_id: event.series_id ? String(event.series_id) : null,
    series_starts_at: normalizeDate(event.series_starts_at, startsAt),
    series_ends_at: normalizeDate(event.series_ends_at, endsAt),
    is_recurring_occurrence: Boolean(event.is_recurring_occurrence),
    calendar_id: String(event.calendar_id || event.calendarId || "default"),
    title: safeText(event.title, 120) || "Sem título",
    description: safeText(event.description, 2000),
    location: safeText(event.location, 180),
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: Boolean(event.all_day ?? event.allDay),
    timezone: safeText(event.timezone, 80) || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    color: safeColor(event.color),
    recurrence_frequency: frequency,
    recurrence_interval: Math.max(1, Number(event.recurrence_interval) || 1),
    recurrence_until: normalizeDate(event.recurrence_until),
    recurrence_count: event.recurrence_count ? Number(event.recurrence_count) : null,
    recurrence_by_weekday: Array.isArray(event.recurrence_by_weekday)
      ? [...new Set(event.recurrence_by_weekday.map(Number).filter((day) => day >= 0 && day <= 6))].sort()
      : [],
    reminder_minutes: Array.isArray(event.reminder_minutes)
      ? [...new Set(event.reminder_minutes.map(Number).filter((minutes) => minutes >= 0))].sort((a, b) => a - b)
      : [],
    created_at: event.created_at || null,
    updated_at: event.updated_at || null
  };
}

export function validateEventInput(input) {
  const errors = {};
  const title = safeText(input.title, 120);
  const startsAt = new Date(input.starts_at);
  const endsAt = new Date(input.ends_at);
  const datesAreValid = !Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime());
  const frequency = VALID_FREQUENCIES.has(input.recurrence_frequency) ? input.recurrence_frequency : "none";
  const interval = Math.max(1, Math.min(365, Number(input.recurrence_interval) || 1));

  if (!title) errors.title = "Dê um título ao evento.";
  if (!datesAreValid) errors.period = "Informe datas e horários válidos.";
  else if (endsAt <= startsAt) errors.period = "O término precisa acontecer depois do início.";
  if (!safeText(input.timezone, 80)) errors.timezone = "Escolha um fuso horário.";

  const recurrenceUntil = input.recurrence_until ? new Date(input.recurrence_until) : null;
  if (recurrenceUntil && Number.isNaN(recurrenceUntil.getTime())) {
    errors.recurrence = "A data final da repetição é inválida.";
  } else if (recurrenceUntil && datesAreValid && recurrenceUntil < startsAt) {
    errors.recurrence = "A repetição não pode terminar antes do evento.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      calendar_id: safeText(input.calendar_id, 80) || "default",
      title,
      description: safeText(input.description, 2000),
      location: safeText(input.location, 180),
      starts_at: datesAreValid ? startsAt.toISOString() : "",
      ends_at: datesAreValid ? endsAt.toISOString() : "",
      all_day: Boolean(input.all_day),
      timezone: safeText(input.timezone, 80),
      color: safeColor(input.color),
      recurrence_frequency: frequency,
      recurrence_interval: interval,
      recurrence_until: recurrenceUntil ? recurrenceUntil.toISOString() : null,
      recurrence_count: input.recurrence_count ? Math.max(1, Math.min(10000, Number(input.recurrence_count))) : null,
      recurrence_by_weekday: frequency === "weekly"
        ? [...new Set((input.recurrence_by_weekday || []).map(Number).filter((day) => day >= 0 && day <= 6))].sort()
        : [],
      reminder_minutes: [...new Set((input.reminder_minutes || []).map(Number).filter((minutes) => minutes >= 0 && minutes <= 525600))].sort((a, b) => a - b)
    }
  };
}

export async function loadEvents(range) {
  setState({ loadingEvents: true, lastError: null });
  try {
    const events = (await listEvents(range))
      .filter((event) => event?.id)
      .map(normalizeEvent)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    setState({ events, loadingEvents: false, persistenceMode: getPersistenceMode(), lastError: null });
    return events;
  } catch (error) {
    console.error("Erro ao carregar eventos:", error);
    setState({
      loadingEvents: false,
      persistenceMode: "error",
      lastError: error?.message || "Não foi possível carregar os eventos."
    });
    throw error;
  }
}

export async function createEvent(input) {
  const validation = validateEventInput(input);
  if (!validation.valid) return validation;
  const created = normalizeEvent(await apiCreateEvent(validation.value));
  upsertEventInState(created);
  setState({ persistenceMode: getPersistenceMode() });
  return { valid: true, event: created, errors: {} };
}

export async function updateEvent(eventId, input) {
  const validation = validateEventInput(input);
  if (!validation.valid) return validation;
  const current = getEventById(eventId);
  const remoteId = current?.series_id || eventId;
  const updated = normalizeEvent(await apiUpdateEvent(remoteId, validation.value));
  upsertEventInState(updated);
  setState({ persistenceMode: getPersistenceMode() });
  return { valid: true, event: updated, errors: {} };
}

export async function deleteEvent(eventId) {
  const current = getEventById(eventId);
  const remoteId = current?.series_id || eventId;
  await apiDeleteEvent(remoteId);
  removeEventFromState(eventId);
  setState({ persistenceMode: getPersistenceMode() });
}

export function getEventById(eventId) {
  return getState().events.find((event) => event.id === eventId) || null;
}

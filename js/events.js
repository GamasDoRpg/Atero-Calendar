import {
  createEvent as apiCreateEvent,
  deleteEvent as apiDeleteEvent,
  getPersistenceMode,
  listEvents,
  updateEvent as apiUpdateEvent
} from "./api.js?v=2";
import {
  getState,
  removeEventFromState,
  setState,
  upsertEventInState
} from "./state.js?v=2";

const DEFAULT_COLOR = "#5b5bd6";

function safeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR;
}

function safeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeEvent(event) {
  const startsAt = new Date(event.starts_at || event.startsAt || event.start);
  const endsAt = new Date(event.ends_at || event.endsAt || event.end);

  return {
    id: String(event.id),
    calendar_id: String(event.calendar_id || event.calendarId || "default"),
    title: safeText(event.title, 120) || "Sem título",
    description: safeText(event.description, 2000),
    location: safeText(event.location, 180),
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    all_day: Boolean(event.all_day ?? event.allDay),
    color: safeColor(event.color),
    created_at: event.created_at || null,
    updated_at: event.updated_at || null
  };
}

export function validateEventInput(input) {
  const errors = {};
  const title = safeText(input.title, 120);
  const startsAt = new Date(input.starts_at);
  const endsAt = new Date(input.ends_at);

  if (!title) {
    errors.title = "Dê um título ao evento.";
  }

  const datesAreValid =
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(endsAt.getTime());

  if (!datesAreValid) {
    errors.period = "Informe datas e horários válidos.";
  } else if (endsAt <= startsAt) {
    errors.period = "O término precisa acontecer depois do início.";
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
      color: safeColor(input.color)
    }
  };
}

export async function loadEvents(range) {
  setState({ loadingEvents: true, lastError: null });

  try {
    const items = await listEvents(range);
    const events = items
      .filter((event) => event?.id)
      .map(normalizeEvent)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

    setState({
      events,
      loadingEvents: false,
      persistenceMode: getPersistenceMode(),
      lastError: null
    });

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

  if (!validation.valid) {
    return validation;
  }

  const created = normalizeEvent(await apiCreateEvent(validation.value));
  upsertEventInState(created);
  setState({ persistenceMode: getPersistenceMode() });

  return {
    valid: true,
    event: created,
    errors: {}
  };
}

export async function updateEvent(eventId, input) {
  const validation = validateEventInput(input);

  if (!validation.valid) {
    return validation;
  }

  const updated = normalizeEvent(await apiUpdateEvent(eventId, validation.value));
  upsertEventInState(updated);
  setState({ persistenceMode: getPersistenceMode() });

  return {
    valid: true,
    event: updated,
    errors: {}
  };
}

export async function deleteEvent(eventId) {
  await apiDeleteEvent(eventId);
  removeEventFromState(eventId);
  setState({ persistenceMode: getPersistenceMode() });
}

export function getEventById(eventId) {
  return getState().events.find((event) => event.id === eventId) || null;
}

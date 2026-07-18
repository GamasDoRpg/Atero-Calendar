import { startOfDay } from "./date-utils.js?v=3";

const listeners = new Set();

let state = {
  user: null,
  app: null,
  currentDate: startOfDay(new Date()),
  view: "month",
  events: [],
  calendars: [
    {
      id: "default",
      name: "Pessoal",
      color: "#00c7df",
      visible: true,
      isDefault: true
    }
  ],
  searchQuery: "",
  loadingEvents: true,
  persistenceMode: "loading",
  lastError: null
};

export function getState() {
  return state;
}

export function setState(patch) {
  const nextPatch = typeof patch === "function" ? patch(state) : patch;
  state = {
    ...state,
    ...nextPatch
  };

  for (const listener of listeners) {
    listener(state);
  }

  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateCalendarVisibility(calendarId, visible) {
  setState({
    calendars: state.calendars.map((calendar) => (
      calendar.id === calendarId
        ? { ...calendar, visible: Boolean(visible) }
        : calendar
    ))
  });
}

export function upsertEventInState(event) {
  const exists = state.events.some((item) => item.id === event.id);
  const events = exists
    ? state.events.map((item) => item.id === event.id ? event : item)
    : [...state.events, event];

  setState({ events });
}

export function removeEventFromState(eventId) {
  setState({
    events: state.events.filter((event) => event.id !== eventId)
  });
}

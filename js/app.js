import { configureApi } from "./api.js?v=2";
import {
  renderCalendar,
  renderMiniCalendar
} from "./calendar.js?v=2";
import {
  parseLocalDate,
  startOfDay,
  visibleRange
} from "./date-utils.js?v=2";
import { loadEvents } from "./events.js?v=2";
import {
  configureModal,
  openEvent,
  openNewEvent
} from "./modal.js?v=2";
import {
  configureNavigation,
  selectDateFromInput,
  updateNavigation
} from "./navigation.js?v=2";
import {
  getState,
  setState,
  subscribe
} from "./state.js?v=2";

let calendarRoot = null;
let miniCalendarRoot = null;
let calendarListRoot = null;
let reloadSequence = 0;

function initialsForUser(user) {
  const name =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Atero";

  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "A";
}

function notify(message, kind = "info") {
  const region = document.querySelector("#toast-region");

  if (!region) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.kind = kind;
  toast.textContent = message;
  region.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4200);
}

function renderCalendarList(state) {
  if (!calendarListRoot) {
    return;
  }

  calendarListRoot.innerHTML = state.calendars.map((calendar) => `
    <label class="calendar-filter">
      <input
        type="checkbox"
        data-calendar-filter="${calendar.id}"
        ${calendar.visible ? "checked" : ""}
      >
      <span
        class="calendar-filter-dot"
        style="--calendar-color: ${calendar.color}"
        aria-hidden="true"
      ></span>
      <span>${calendar.name}</span>
    </label>
  `).join("");
}

function renderSyncStatus(state) {
  const status = document.querySelector("#sync-status");
  const dot = document.querySelector("#sync-dot");

  if (!status || !dot) {
    return;
  }

  dot.className = "sync-dot";

  if (state.loadingEvents || state.persistenceMode === "loading") {
    dot.classList.add("is-loading");
    status.textContent = "Carregando eventos…";
    return;
  }

  if (state.persistenceMode === "api") {
    dot.classList.add("is-online");
    status.textContent = "Sincronizado com a Atero API";
    return;
  }

  if (state.persistenceMode === "local") {
    dot.classList.add("is-online");
    status.textContent = "Salvo neste dispositivo";
    return;
  }

  dot.classList.add("is-error");
  status.textContent = "Falha ao sincronizar";
}

function renderApplication(state) {
  renderCalendar(calendarRoot, state);
  renderMiniCalendar(miniCalendarRoot, state);
  renderCalendarList(state);
  renderSyncStatus(state);
  updateNavigation(state);
}

async function reloadVisibleEvents() {
  const sequence = ++reloadSequence;
  const state = getState();
  const range = visibleRange(state.currentDate, state.view);

  try {
    await loadEvents(range);
  } catch (error) {
    if (sequence === reloadSequence) {
      notify(error?.message || "Não foi possível carregar os eventos.", "error");
    }
  }
}

function handleCalendarClick(event) {
  const eventButton = event.target.closest("[data-event-id]");

  if (eventButton) {
    openEvent(eventButton.dataset.eventId);
    return;
  }

  const actionButton = event.target.closest("[data-action]");

  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.action;

  if (action === "retry-events") {
    reloadVisibleEvents();
    return;
  }

  const date = parseLocalDate(actionButton.dataset.date);

  if (action === "open-day" && date) {
    setState({
      currentDate: startOfDay(date),
      view: "day"
    });
    reloadVisibleEvents();
    return;
  }

  if (action === "new-event" && date) {
    const hour = actionButton.dataset.hour === undefined
      ? null
      : Number(actionButton.dataset.hour);

    openNewEvent({
      date,
      hour: Number.isInteger(hour) ? hour : null,
      allDay: hour === null
    });
  }
}

function handleMiniCalendarClick(event) {
  const button = event.target.closest("[data-mini-date]");

  if (button) {
    selectDateFromInput(button.dataset.miniDate);
  }
}

export async function iniciarAplicativo({ usuario, aplicativo }) {
  calendarRoot = document.querySelector("#calendar-root");
  miniCalendarRoot = document.querySelector("#mini-calendar");
  calendarListRoot = document.querySelector("#calendar-list");

  if (!calendarRoot || !miniCalendarRoot || !calendarListRoot) {
    throw new Error("A estrutura visual do Atero Calendar está incompleta.");
  }

  configureApi({ user: usuario });

  setState({
    user: usuario,
    app: aplicativo,
    currentDate: startOfDay(new Date()),
    loadingEvents: true,
    persistenceMode: "loading"
  });

  const profileInitials = document.querySelector("#profile-initials");
  const profileChip = document.querySelector("#profile-chip");

  if (profileInitials) {
    profileInitials.textContent = initialsForUser(usuario);
  }

  if (profileChip) {
    profileChip.title = usuario?.email || "Conta Atero";
    profileChip.addEventListener("click", () => {
      window.location.href = "https://atero.space/conta.html";
    });
  }

  configureModal({ onNotify: notify });
  configureNavigation({
    onNavigate: reloadVisibleEvents,
    onCreateEvent: openNewEvent
  });

  calendarRoot.addEventListener("click", handleCalendarClick);
  miniCalendarRoot.addEventListener("click", handleMiniCalendarClick);
  subscribe(renderApplication);
  renderApplication(getState());

  await reloadVisibleEvents();
}

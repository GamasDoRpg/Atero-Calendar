import { configureApi } from "./api.js?v=4";
import { renderCalendar, renderMiniCalendar } from "./calendar.js?v=4";
import {
  configureCalendarManager,
  loadCalendars,
  setCalendarVisibility
} from "./calendars.js?v=4";
import {
  addYears,
  parseLocalDate,
  setYear,
  startOfDay,
  visibleRange,
  YEAR_LIMITS
} from "./date-utils.js?v=4";
import { loadEvents } from "./events.js?v=4";
import { configureModal, openEvent, openNewEvent } from "./modal.js?v=4";
import {
  configureNavigation,
  selectDateFromInput,
  updateNavigation
} from "./navigation.js?v=4";
import { getState, setState, subscribe } from "./state.js?v=4";
import { renderYearCalendar } from "./year-view.js?v=4";

let calendarRoot = null;
let miniCalendarRoot = null;
let calendarListRoot = null;
let reloadSequence = 0;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initialsForUser(user) {
  const name =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.display_name ||
    user?.email ||
    "Atero";
  return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "A";
}

function notify(message, kind = "info") {
  const region = document.querySelector("#toast-region");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.kind = kind;
  toast.textContent = message;
  region.append(toast);
  setTimeout(() => toast.remove(), 4200);
}

function renderCalendarList(state) {
  if (!calendarListRoot) return;
  if (state.loadingCalendars) {
    calendarListRoot.innerHTML = '<p class="calendar-list-message">Carregando…</p>';
    return;
  }
  if (!state.calendars.length) {
    calendarListRoot.innerHTML = '<p class="calendar-list-message">Nenhum calendário.</p>';
    return;
  }
  calendarListRoot.innerHTML = state.calendars.map((calendar) => `
    <div class="calendar-filter-row">
      <label class="calendar-filter">
        <input type="checkbox" data-calendar-filter="${escapeHtml(calendar.id)}" ${calendar.visible ? "checked" : ""}>
        <span class="calendar-filter-dot" style="--calendar-color:${escapeHtml(calendar.color)}" aria-hidden="true"></span>
        <span class="calendar-filter-name">${escapeHtml(calendar.name)}</span>
        ${calendar.is_default ? '<small title="Calendário padrão">Padrão</small>' : ""}
      </label>
      <button class="calendar-edit-button" type="button" data-calendar-edit="${escapeHtml(calendar.id)}" aria-label="Editar ${escapeHtml(calendar.name)}">•••</button>
    </div>
  `).join("");
}

function renderSyncStatus(state) {
  const status = document.querySelector("#sync-status");
  const dot = document.querySelector("#sync-dot");
  if (!status || !dot) return;
  dot.className = "sync-dot";
  if (state.loadingEvents || state.loadingCalendars || state.persistenceMode === "loading") {
    dot.classList.add("is-loading");
    status.textContent = "Sincronizando…";
  } else if (state.persistenceMode === "api") {
    dot.classList.add("is-online");
    status.textContent = "Sincronizado com a Atero API";
  } else if (state.persistenceMode === "local") {
    dot.classList.add("is-online");
    status.textContent = "Salvo neste dispositivo";
  } else {
    dot.classList.add("is-error");
    status.textContent = "Falha ao sincronizar";
  }
}

function renderApplication(state) {
  if (state.view === "year") renderYearCalendar(calendarRoot, state);
  else renderCalendar(calendarRoot, state);
  renderMiniCalendar(miniCalendarRoot, state);
  renderCalendarList(state);
  renderSyncStatus(state);
  updateNavigation(state);
}

async function reloadVisibleEvents() {
  const sequence = ++reloadSequence;
  const state = getState();
  if (!state.calendars.length) {
    setState({ events: [], loadingEvents: false });
    return;
  }
  const range = visibleRange(state.currentDate, state.view);
  try {
    await loadEvents(range);
  } catch (error) {
    if (sequence === reloadSequence) notify(error?.message || "Não foi possível carregar os eventos.", "error");
  }
}

function moveByYears(amount) {
  const nextDate = addYears(getState().currentDate, amount);
  setState({ currentDate: startOfDay(nextDate) });
  reloadVisibleEvents();
}

function handleCalendarClick(event) {
  const eventButton = event.target.closest("[data-event-id]");
  if (eventButton) {
    openEvent(eventButton.dataset.eventId);
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === "retry-events") return void reloadVisibleEvents();
  if (action === "shift-year") {
    const amount = Number(actionButton.dataset.amount);
    if (Number.isInteger(amount)) moveByYears(amount);
    return;
  }
  const date = parseLocalDate(actionButton.dataset.date);
  if (action === "open-month" && date) {
    setState({ currentDate: startOfDay(date), view: "month" });
    reloadVisibleEvents();
  } else if (action === "open-day" && date) {
    setState({ currentDate: startOfDay(date), view: "day" });
    reloadVisibleEvents();
  } else if (action === "new-event" && date) {
    const hour = actionButton.dataset.hour === undefined ? null : Number(actionButton.dataset.hour);
    openNewEvent({ date, hour: Number.isInteger(hour) ? hour : null, allDay: hour === null });
  }
}

function handleYearJump(event) {
  const form = event.target.closest("[data-year-jump-form]");
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector("#year-jump-input");
  const year = Number(input?.value);
  if (!Number.isInteger(year) || year < YEAR_LIMITS.min || year > YEAR_LIMITS.max) {
    notify(`Digite um ano entre ${YEAR_LIMITS.min} e ${YEAR_LIMITS.max}.`, "error");
    input?.focus();
    return;
  }
  const nextDate = setYear(getState().currentDate, year);
  if (!nextDate) return notify("Esse ano não pôde ser aberto.", "error");
  setState({ currentDate: startOfDay(nextDate), view: "year" });
  reloadVisibleEvents();
}

function handleMiniCalendarClick(event) {
  const button = event.target.closest("[data-mini-date]");
  if (button) selectDateFromInput(button.dataset.miniDate);
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
    loadingCalendars: true,
    persistenceMode: "loading"
  });

  const profileInitials = document.querySelector("#profile-initials");
  const profileChip = document.querySelector("#profile-chip");
  if (profileInitials) profileInitials.textContent = initialsForUser(usuario);
  if (profileChip) {
    profileChip.title = usuario?.email || "Conta Atero";
    profileChip.addEventListener("click", () => { window.location.href = "https://atero.space/conta.html"; });
  }

  configureModal({ onNotify: notify, onEventChanged: reloadVisibleEvents });
  configureCalendarManager({ onNotify: notify, onCalendarChanged: reloadVisibleEvents });
  configureNavigation({
    onNavigate: reloadVisibleEvents,
    onCreateEvent: openNewEvent,
    onVisibilityChange: setCalendarVisibility
  });

  calendarRoot.addEventListener("click", handleCalendarClick);
  calendarRoot.addEventListener("submit", handleYearJump);
  miniCalendarRoot.addEventListener("click", handleMiniCalendarClick);
  subscribe(renderApplication);
  renderApplication(getState());

  try {
    await loadCalendars();
    await reloadVisibleEvents();
  } catch (error) {
    notify(error?.message || "Não foi possível iniciar o Calendar.", "error");
  }
}

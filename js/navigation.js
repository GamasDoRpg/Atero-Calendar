import {
  formatPeriodTitle,
  movePeriod,
  parseLocalDate,
  startOfDay
} from "./date-utils.js?v=2";
import {
  getState,
  setState,
  updateCalendarVisibility
} from "./state.js?v=2";

let onPeriodChanged = async () => {};
let onNewEvent = () => {};
let searchTimer = null;

function changePeriod(direction) {
  const state = getState();
  setState({
    currentDate: startOfDay(movePeriod(state.currentDate, state.view, direction))
  });
  onPeriodChanged();
}

function goToday() {
  setState({ currentDate: startOfDay(new Date()) });
  onPeriodChanged();
}

function setView(view) {
  if (!["month", "week", "day"].includes(view)) {
    return;
  }

  if (getState().view === view) {
    return;
  }

  setState({ view });
  onPeriodChanged();
}

function toggleSidebar(force) {
  const next = typeof force === "boolean"
    ? force
    : !document.body.classList.contains("sidebar-open");

  document.body.classList.toggle("sidebar-open", next);
  const button = document.querySelector("#sidebar-toggle");
  button?.setAttribute("aria-expanded", String(next));
}

function handleKeyboard(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const target = event.target;
  const tagName = target?.tagName?.toLowerCase();

  if (["input", "textarea", "select"].includes(tagName) || target?.isContentEditable) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === "n") {
    event.preventDefault();
    onNewEvent({ date: getState().currentDate });
  } else if (key === "t") {
    event.preventDefault();
    goToday();
  } else if (key === "m") {
    setView("month");
  } else if (key === "w") {
    setView("week");
  } else if (key === "d") {
    setView("day");
  } else if (event.key === "ArrowLeft") {
    changePeriod(-1);
  } else if (event.key === "ArrowRight") {
    changePeriod(1);
  } else if (event.key === "Escape") {
    toggleSidebar(false);
  }
}

export function configureNavigation({ onNavigate, onCreateEvent } = {}) {
  onPeriodChanged = onNavigate || onPeriodChanged;
  onNewEvent = onCreateEvent || onNewEvent;

  document.querySelector("#today-button")?.addEventListener("click", goToday);
  document.querySelector("#mobile-today-button")?.addEventListener("click", goToday);
  document.querySelector("#previous-period")?.addEventListener("click", () => changePeriod(-1));
  document.querySelector("#next-period")?.addEventListener("click", () => changePeriod(1));
  document.querySelector("#mobile-previous-period")?.addEventListener("click", () => changePeriod(-1));
  document.querySelector("#mobile-next-period")?.addEventListener("click", () => changePeriod(1));
  document.querySelector("#new-event-button")?.addEventListener("click", () => {
    toggleSidebar(false);
    onNewEvent({ date: getState().currentDate });
  });
  document.querySelector("#sidebar-toggle")?.addEventListener("click", () => toggleSidebar());

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelector("#event-search")?.addEventListener("input", (event) => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      setState({ searchQuery: event.target.value || "" });
    }, 120);
  });

  document.querySelector("#calendar-list")?.addEventListener("change", (event) => {
    const input = event.target.closest("[data-calendar-filter]");

    if (input) {
      updateCalendarVisibility(input.dataset.calendarFilter, input.checked);
    }
  });

  document.addEventListener("keydown", handleKeyboard);
  document.addEventListener("click", (event) => {
    if (
      document.body.classList.contains("sidebar-open") &&
      !event.target.closest("#calendar-sidebar") &&
      !event.target.closest("#sidebar-toggle")
    ) {
      toggleSidebar(false);
    }
  });
}

export function updateNavigation(state) {
  const title = formatPeriodTitle(state.currentDate, state.view);
  const periodTitle = document.querySelector("#period-title");
  const mobilePeriodTitle = document.querySelector("#mobile-period-title");

  if (periodTitle) {
    periodTitle.textContent = title;
  }

  if (mobilePeriodTitle) {
    mobilePeriodTitle.textContent = title;
  }

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  });
}

export function selectDateFromInput(dateInput) {
  const date = parseLocalDate(dateInput);

  if (!date) {
    return;
  }

  setState({ currentDate: startOfDay(date) });
  onPeriodChanged();
  toggleSidebar(false);
}

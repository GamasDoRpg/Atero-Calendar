import {
  addDays,
  capitalize,
  durationMinutes,
  endOfDay,
  eventOccursOnDay,
  formatMonthTitle,
  formatTime,
  formatWeekday,
  minutesSinceStartOfDay,
  monthGridRange,
  sameDay,
  sameMonth,
  startOfDay,
  startOfWeek,
  toDateInput
} from "./date-utils.js?v=2";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HOUR_HEIGHT = 48;
const MINUTE_HEIGHT = HOUR_HEIGHT / 60;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : "#5b5bd6";
}

function visibleEvents(state) {
  const visibleCalendarIds = new Set(
    state.calendars.filter((calendar) => calendar.visible).map((calendar) => calendar.id)
  );
  const query = state.searchQuery.trim().toLocaleLowerCase("pt-BR");

  return state.events.filter((event) => {
    if (!visibleCalendarIds.has(event.calendar_id)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [event.title, event.description, event.location]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(query);
  });
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    if (a.all_day !== b.all_day) {
      return a.all_day ? -1 : 1;
    }

    return new Date(a.starts_at) - new Date(b.starts_at);
  });
}

function renderEventChip(event) {
  const time = event.all_day ? "" : `<span class="calendar-event-time">${escapeHtml(formatTime(event.starts_at))}</span>`;

  return `
    <button
      class="calendar-event"
      type="button"
      data-event-id="${escapeHtml(event.id)}"
      style="--event-color: ${safeColor(event.color)}"
      title="${escapeHtml(event.title)}"
    >
      ${time}${escapeHtml(event.title)}
    </button>
  `;
}

function renderMonthDay(day, monthDate, events) {
  const dayEvents = sortEvents(events.filter((event) => eventOccursOnDay(event, day)));
  const visible = dayEvents.slice(0, 3);
  const hiddenCount = Math.max(0, dayEvents.length - visible.length);
  const dateInput = toDateInput(day);
  const classes = ["month-day"];

  if (!sameMonth(day, monthDate)) {
    classes.push("is-outside");
  }

  if (sameDay(day, new Date())) {
    classes.push("is-today");
  }

  return `
    <article class="${classes.join(" ")}" data-date="${dateInput}">
      <div class="day-header">
        <span class="day-number">${day.getDate()}</span>
        <button
          class="add-event-inline"
          type="button"
          data-action="new-event"
          data-date="${dateInput}"
          aria-label="Criar evento em ${dateInput}"
        >＋</button>
      </div>
      <div class="day-events">
        ${visible.map(renderEventChip).join("")}
        ${hiddenCount > 0 ? `
          <button
            class="more-events-button"
            type="button"
            data-action="open-day"
            data-date="${dateInput}"
          >+${hiddenCount} evento${hiddenCount === 1 ? "" : "s"}</button>
        ` : ""}
      </div>
    </article>
  `;
}

function renderMonthView(state, events) {
  const { start } = monthGridRange(state.currentDate);
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));

  return `
    <div class="month-view">
      <div class="month-weekdays" aria-hidden="true">
        ${WEEKDAYS.map((weekday) => `<span>${weekday}</span>`).join("")}
      </div>
      <div class="month-grid">
        ${days.map((day) => renderMonthDay(day, state.currentDate, events)).join("")}
      </div>
    </div>
  `;
}

function renderTimeLabels() {
  return Array.from({ length: 24 }, (_, hour) => `
    <span class="time-label" style="top: ${hour * HOUR_HEIGHT}px">
      ${String(hour).padStart(2, "0")}:00
    </span>
  `).join("");
}

function renderAllDayCell(day, events) {
  const dayEvents = sortEvents(
    events.filter((event) => event.all_day && eventOccursOnDay(event, day))
  );

  return `
    <div class="all-day-cell" data-date="${toDateInput(day)}">
      ${dayEvents.map(renderEventChip).join("")}
    </div>
  `;
}

function renderTimedEvent(event, day) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const eventStart = new Date(event.starts_at);
  const eventEnd = new Date(event.ends_at);
  const segmentStart = eventStart < dayStart ? dayStart : eventStart;
  const segmentEnd = eventEnd > dayEnd ? dayEnd : eventEnd;
  const top = Math.max(0, minutesSinceStartOfDay(segmentStart) * MINUTE_HEIGHT);
  const height = Math.max(25, durationMinutes(segmentStart, segmentEnd) * MINUTE_HEIGHT);

  return `
    <button
      class="timed-event"
      type="button"
      data-event-id="${escapeHtml(event.id)}"
      style="top: ${top}px; height: ${height}px; --event-color: ${safeColor(event.color)}"
      title="${escapeHtml(event.title)}"
    >
      <strong>${escapeHtml(event.title)}</strong>
      <small>${escapeHtml(formatTime(eventStart))}–${escapeHtml(formatTime(eventEnd))}</small>
    </button>
  `;
}

function renderCurrentTimeLine(day) {
  const now = new Date();

  if (!sameDay(day, now)) {
    return "";
  }

  const top = minutesSinceStartOfDay(now) * MINUTE_HEIGHT;
  return `<div class="current-time-line" style="top: ${top}px" aria-hidden="true"></div>`;
}

function renderTimeDayColumn(day, events) {
  const timedEvents = sortEvents(
    events.filter((event) => !event.all_day && eventOccursOnDay(event, day))
  );
  const dateInput = toDateInput(day);
  const slots = Array.from({ length: 24 }, (_, hour) => `
    <button
      class="time-slot"
      type="button"
      data-action="new-event"
      data-date="${dateInput}"
      data-hour="${hour}"
      aria-label="Criar evento em ${dateInput} às ${String(hour).padStart(2, "0")}:00"
    ></button>
  `).join("");

  return `
    <div class="time-day-column" data-date="${dateInput}">
      ${slots}
      ${timedEvents.map((event) => renderTimedEvent(event, day)).join("")}
      ${renderCurrentTimeLine(day)}
    </div>
  `;
}

function renderTimeView(state, events) {
  const days = state.view === "day"
    ? [startOfDay(state.currentDate)]
    : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(state.currentDate), index));

  return `
    <div class="time-view" style="--day-count: ${days.length}">
      <div class="time-view-header">
        <div class="time-view-corner"></div>
        ${days.map((day) => `
          <div class="time-day-heading ${sameDay(day, new Date()) ? "is-today" : ""}">
            <small>${escapeHtml(capitalize(formatWeekday(day, "short").replace(".", "")))}</small>
            <strong>${day.getDate()}</strong>
          </div>
        `).join("")}
      </div>

      <div class="all-day-row">
        <div class="all-day-label">Dia inteiro</div>
        ${days.map((day) => renderAllDayCell(day, events)).join("")}
      </div>

      <div class="time-grid">
        <div class="time-labels">${renderTimeLabels()}</div>
        <div class="time-columns">
          ${days.map((day) => renderTimeDayColumn(day, events)).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderError(message) {
  return `
    <div class="calendar-error-state">
      <div class="calendar-error-card">
        <h2>Não foi possível carregar o calendário</h2>
        <p>${escapeHtml(message)}</p>
        <button class="primary-button" type="button" data-action="retry-events">Tentar novamente</button>
      </div>
    </div>
  `;
}

function renderLoading() {
  return `
    <div class="calendar-loading">
      <div class="calendar-loading-card">
        <div class="calendar-loading-spinner" aria-hidden="true"></div>
        <strong>Carregando eventos</strong>
      </div>
    </div>
  `;
}

export function renderCalendar(root, state) {
  if (!root) {
    return;
  }

  if (state.loadingEvents && state.events.length === 0) {
    root.innerHTML = renderLoading();
    return;
  }

  if (state.lastError && state.events.length === 0) {
    root.innerHTML = renderError(state.lastError);
    return;
  }

  const events = visibleEvents(state);
  root.innerHTML = state.view === "month"
    ? renderMonthView(state, events)
    : renderTimeView(state, events);

  if (state.view !== "month") {
    const initialScroll = state.view === "day" ? 7 * HOUR_HEIGHT : 6 * HOUR_HEIGHT;
    root.scrollTop = initialScroll;
  }
}

export function renderMiniCalendar(root, state) {
  if (!root) {
    return;
  }

  const { start } = monthGridRange(state.currentDate);
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));

  root.innerHTML = `
    <div class="mini-calendar-header">
      <span>${escapeHtml(capitalize(formatMonthTitle(state.currentDate)))}</span>
    </div>
    <div class="mini-calendar-weekdays" aria-hidden="true">
      ${["S", "T", "Q", "Q", "S", "S", "D"].map((day) => `<span>${day}</span>`).join("")}
    </div>
    <div class="mini-calendar-grid">
      ${days.map((day) => {
        const classes = ["mini-day"];

        if (!sameMonth(day, state.currentDate)) {
          classes.push("is-outside");
        }

        if (sameDay(day, new Date())) {
          classes.push("is-today");
        }

        if (sameDay(day, state.currentDate)) {
          classes.push("is-selected");
        }

        return `
          <button
            class="${classes.join(" ")}"
            type="button"
            data-mini-date="${toDateInput(day)}"
            aria-label="Selecionar ${toDateInput(day)}"
          >${day.getDate()}</button>
        `;
      }).join("")}
    </div>
  `;
}

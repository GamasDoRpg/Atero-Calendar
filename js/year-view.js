import {
  addDays,
  capitalize,
  createDate,
  eventOccursOnDay,
  formatMonthName,
  monthGridRange,
  sameDay,
  sameMonth,
  toDateInput,
  YEAR_LIMITS
} from "./date-utils.js?v=3";

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
const DEFAULT_COLOR = "#00c7df";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : DEFAULT_COLOR;
}

function visibleEvents(state) {
  const visibleCalendarIds = new Set(
    state.calendars
      .filter((calendar) => calendar.visible)
      .map((calendar) => calendar.id)
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

function renderEventDots(events) {
  if (!events.length) {
    return "";
  }

  const dots = events.slice(0, 3).map((event) => `
    <span style="--event-color: ${safeColor(event.color)}"></span>
  `).join("");

  return `<span class="year-event-dots" aria-hidden="true">${dots}</span>`;
}

function renderDay(day, monthDate, events) {
  if (!sameMonth(day, monthDate)) {
    return `<span class="year-day is-empty" aria-hidden="true"></span>`;
  }

  const dateInput = toDateInput(day);
  const dayEvents = events.filter((event) => eventOccursOnDay(event, day));
  const classes = ["year-day"];

  if (sameDay(day, new Date())) {
    classes.push("is-today");
  }

  if (dayEvents.length) {
    classes.push("has-events");
  }

  return `
    <button
      class="${classes.join(" ")}"
      type="button"
      data-action="open-day"
      data-date="${dateInput}"
      aria-label="Abrir ${dateInput}${dayEvents.length ? `, ${dayEvents.length} evento${dayEvents.length === 1 ? "" : "s"}` : ""}"
    >
      <span class="year-day-number">${day.getDate()}</span>
      ${renderEventDots(dayEvents)}
    </button>
  `;
}

function renderMonth(year, month, events) {
  const monthDate = createDate(year, month, 1);
  const { start } = monthGridRange(monthDate);
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const monthInput = toDateInput(monthDate);
  const monthName = capitalize(formatMonthName(monthDate));

  return `
    <section class="year-month" aria-label="${escapeHtml(monthName)} de ${year}">
      <button
        class="year-month-title"
        type="button"
        data-action="open-month"
        data-date="${monthInput}"
      >${escapeHtml(monthName)}</button>

      <div class="year-month-weekdays" aria-hidden="true">
        ${WEEKDAYS.map((weekday) => `<span>${weekday}</span>`).join("")}
      </div>

      <div class="year-month-grid">
        ${days.map((day) => renderDay(day, monthDate, events)).join("")}
      </div>
    </section>
  `;
}

export function renderYearCalendar(root, state) {
  if (!root) {
    return;
  }

  const year = state.currentDate.getFullYear();
  const events = visibleEvents(state);

  root.innerHTML = `
    <div class="year-view">
      <div class="year-view-toolbar">
        <div class="year-view-heading">
          <span>Visão anual</span>
          <strong>${year}</strong>
        </div>

        <div class="year-view-actions">
          <button
            class="year-skip-button"
            type="button"
            data-action="shift-year"
            data-amount="-10"
            aria-label="Voltar dez anos"
          >−10 anos</button>

          <form class="year-jump-form" data-year-jump-form>
            <label for="year-jump-input">Ir para o ano</label>
            <input
              id="year-jump-input"
              name="year"
              type="number"
              inputmode="numeric"
              min="${YEAR_LIMITS.min}"
              max="${YEAR_LIMITS.max}"
              step="1"
              value="${year}"
              aria-label="Ano entre ${YEAR_LIMITS.min} e ${YEAR_LIMITS.max}"
            >
            <button class="year-go-button" type="submit">Ir</button>
          </form>

          <button
            class="year-skip-button"
            type="button"
            data-action="shift-year"
            data-amount="10"
            aria-label="Avançar dez anos"
          >+10 anos</button>
        </div>
      </div>

      <div class="year-grid">
        ${Array.from({ length: 12 }, (_, month) => renderMonth(year, month, events)).join("")}
      </div>
    </div>
  `;

  root.scrollTop = 0;
}

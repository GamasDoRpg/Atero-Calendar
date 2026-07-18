import {
  addMinutes,
  endOfDay,
  parseLocalDate,
  roundToNextMinutes,
  startOfDay,
  toDateInput,
  toTimeInput
} from "./date-utils.js?v=3";
import {
  createEvent,
  deleteEvent,
  getEventById,
  updateEvent
} from "./events.js?v=3";
import { getState } from "./state.js?v=3";

const DEFAULT_COLOR = "#00c7df";

let elements = null;
let notify = () => {};

function queryElements() {
  const dialog = document.querySelector("#event-dialog");

  if (!dialog) {
    return null;
  }

  return {
    dialog,
    form: dialog.querySelector("#event-form"),
    id: dialog.querySelector("#event-id"),
    title: dialog.querySelector("#event-title"),
    allDay: dialog.querySelector("#event-all-day"),
    startDate: dialog.querySelector("#event-start-date"),
    startTime: dialog.querySelector("#event-start-time"),
    endDate: dialog.querySelector("#event-end-date"),
    endTime: dialog.querySelector("#event-end-time"),
    calendar: dialog.querySelector("#event-calendar"),
    color: dialog.querySelector("#event-color"),
    location: dialog.querySelector("#event-location"),
    description: dialog.querySelector("#event-description"),
    mode: dialog.querySelector("#event-dialog-mode"),
    heading: dialog.querySelector("#event-dialog-title"),
    deleteButton: dialog.querySelector("#delete-event-button"),
    closeButton: dialog.querySelector("#close-event-dialog"),
    cancelButton: dialog.querySelector("#cancel-event-button"),
    saveButton: dialog.querySelector("#save-event-button"),
    timeFields: [...dialog.querySelectorAll(".time-field")],
    titleError: dialog.querySelector('[data-error-for="title"]'),
    periodError: dialog.querySelector('[data-error-for="period"]')
  };
}

function populateCalendars(selectedId = "default") {
  const calendars = getState().calendars;
  elements.calendar.innerHTML = calendars.map((calendar) => `
    <option value="${calendar.id}">${calendar.name}</option>
  `).join("");
  elements.calendar.value = calendars.some((calendar) => calendar.id === selectedId)
    ? selectedId
    : calendars[0]?.id || "default";
}

function setAllDayMode(allDay) {
  elements.allDay.checked = allDay;

  for (const field of elements.timeFields) {
    field.hidden = allDay;
  }

  elements.startTime.required = !allDay;
  elements.endTime.required = !allDay;
}

function clearErrors() {
  elements.titleError.textContent = "";
  elements.periodError.textContent = "";
}

function showErrors(errors) {
  elements.titleError.textContent = errors.title || "";
  elements.periodError.textContent = errors.period || "";
}

function defaultPeriod(date = new Date(), hour = null) {
  const source = new Date(date);

  if (!Number.isInteger(hour) && source.getHours() === 0 && source.getMinutes() === 0) {
    const now = new Date();

    if (toDateInput(source) === toDateInput(now)) {
      source.setHours(now.getHours(), now.getMinutes(), 0, 0);
    } else {
      source.setHours(9, 0, 0, 0);
    }
  }

  const start = roundToNextMinutes(source, 30);

  if (Number.isInteger(hour)) {
    start.setHours(hour, 0, 0, 0);
  }

  const end = addMinutes(start, 60);
  return { start, end };
}

function fillFormForCreate({ date = new Date(), hour = null, allDay = false } = {}) {
  const { start, end } = defaultPeriod(date, hour);
  elements.form.reset();
  elements.id.value = "";
  elements.mode.textContent = "Novo compromisso";
  elements.heading.textContent = "Criar evento";
  elements.deleteButton.hidden = true;
  elements.startDate.value = toDateInput(start);
  elements.startTime.value = toTimeInput(start);
  elements.endDate.value = toDateInput(end);
  elements.endTime.value = toTimeInput(end);
  elements.color.value = DEFAULT_COLOR;
  populateCalendars("default");
  setAllDayMode(allDay);
  clearErrors();
}

function fillFormForEdit(event) {
  const startsAt = new Date(event.starts_at);
  const endsAt = new Date(event.ends_at);
  elements.form.reset();
  elements.id.value = event.id;
  elements.mode.textContent = "Editar compromisso";
  elements.heading.textContent = event.title;
  elements.deleteButton.hidden = false;
  elements.title.value = event.title;
  elements.startDate.value = toDateInput(startsAt);
  elements.startTime.value = toTimeInput(startsAt);
  elements.endDate.value = toDateInput(endsAt);
  elements.endTime.value = toTimeInput(endsAt);
  elements.color.value = event.color;
  elements.location.value = event.location || "";
  elements.description.value = event.description || "";
  populateCalendars(event.calendar_id);
  setAllDayMode(event.all_day);
  clearErrors();
}

function collectFormValue() {
  const allDay = elements.allDay.checked;
  let startsAt = parseLocalDate(
    elements.startDate.value,
    allDay ? "00:00" : elements.startTime.value
  );
  let endsAt = parseLocalDate(
    elements.endDate.value,
    allDay ? "00:00" : elements.endTime.value
  );

  if (allDay && startsAt && endsAt) {
    startsAt = startOfDay(startsAt);
    endsAt = endOfDay(endsAt);
  }

  return {
    calendar_id: elements.calendar.value,
    title: elements.title.value,
    description: elements.description.value,
    location: elements.location.value,
    starts_at: startsAt?.toISOString() || "",
    ends_at: endsAt?.toISOString() || "",
    all_day: allDay,
    color: elements.color.value
  };
}

function setSaving(saving) {
  elements.dialog.classList.toggle("is-saving", saving);
  elements.saveButton.disabled = saving;
  elements.deleteButton.disabled = saving;
  elements.saveButton.textContent = saving ? "Salvando…" : "Salvar evento";
}

async function handleSubmit(event) {
  event.preventDefault();
  clearErrors();
  setSaving(true);

  try {
    const id = elements.id.value;
    const result = id
      ? await updateEvent(id, collectFormValue())
      : await createEvent(collectFormValue());

    if (!result.valid) {
      showErrors(result.errors);
      return;
    }

    elements.dialog.close();
    notify(id ? "Evento atualizado." : "Evento criado.", "success");
  } catch (error) {
    console.error("Erro ao salvar evento:", error);
    notify(error?.message || "Não foi possível salvar o evento.", "error");
  } finally {
    setSaving(false);
  }
}

async function handleDelete() {
  const eventId = elements.id.value;

  if (!eventId) {
    return;
  }

  const confirmed = window.confirm("Excluir este evento? Essa ação não poderá ser desfeita.");

  if (!confirmed) {
    return;
  }

  setSaving(true);

  try {
    await deleteEvent(eventId);
    elements.dialog.close();
    notify("Evento excluído.", "success");
  } catch (error) {
    console.error("Erro ao excluir evento:", error);
    notify(error?.message || "Não foi possível excluir o evento.", "error");
  } finally {
    setSaving(false);
  }
}

export function configureModal({ onNotify } = {}) {
  elements = queryElements();
  notify = onNotify || notify;

  if (!elements) {
    throw new Error("O modal de eventos não foi encontrado.");
  }

  elements.form.addEventListener("submit", handleSubmit);
  elements.allDay.addEventListener("change", () => setAllDayMode(elements.allDay.checked));
  elements.closeButton.addEventListener("click", () => elements.dialog.close());
  elements.cancelButton.addEventListener("click", () => elements.dialog.close());
  elements.deleteButton.addEventListener("click", handleDelete);
  elements.dialog.addEventListener("close", clearErrors);
}

export function openNewEvent(options = {}) {
  fillFormForCreate(options);
  elements.dialog.showModal();
  window.setTimeout(() => elements.title.focus(), 0);
}

export function openEvent(eventId) {
  const event = getEventById(eventId);

  if (!event) {
    notify("Esse evento não está mais disponível.", "error");
    return;
  }

  fillFormForEdit(event);
  elements.dialog.showModal();
  window.setTimeout(() => elements.title.focus(), 0);
}

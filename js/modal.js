import {
  addMinutes,
  roundToNextMinutes,
  toDateInput,
  toTimeInput
} from "./date-utils.js?v=4";
import { createEvent, deleteEvent, getEventById, updateEvent } from "./events.js?v=4";
import { getState } from "./state.js?v=4";
import {
  isValidTimeZone,
  toZonedDateInput,
  toZonedTimeInput,
  zonedDateTimeToDate
} from "./timezone-utils.js?v=4";

let elements = null;
let notify = () => {};
let onChanged = async () => {};

function queryElements() {
  const dialog = document.querySelector("#event-dialog");
  if (!dialog) return null;
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
    timezone: dialog.querySelector("#event-timezone"),
    recurrence: dialog.querySelector("#event-recurrence"),
    recurrenceInterval: dialog.querySelector("#event-recurrence-interval"),
    recurrenceUntil: dialog.querySelector("#event-recurrence-until"),
    recurrenceCount: dialog.querySelector("#event-recurrence-count"),
    recurrenceAdvanced: dialog.querySelector("#recurrence-advanced"),
    recurrenceWeekdays: dialog.querySelector("#recurrence-weekdays"),
    weekdayInputs: [...dialog.querySelectorAll("[data-recurrence-weekday]")],
    reminderInputs: [...dialog.querySelectorAll("[data-reminder-minutes]")],
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
    periodError: dialog.querySelector('[data-error-for="period"]'),
    recurrenceError: dialog.querySelector('[data-error-for="recurrence"]'),
    timezoneError: dialog.querySelector('[data-error-for="timezone"]')
  };
}

function populateCalendars(selectedId = null) {
  const calendars = getState().calendars;
  elements.calendar.innerHTML = calendars.map((calendar) => `
    <option value="${calendar.id}">${calendar.name}${calendar.is_default ? " — padrão" : ""}</option>
  `).join("");
  const fallback = calendars.find((calendar) => calendar.is_default)?.id || calendars[0]?.id || "";
  elements.calendar.value = calendars.some((calendar) => calendar.id === selectedId) ? selectedId : fallback;
}

function setAllDayMode(allDay) {
  elements.allDay.checked = allDay;
  for (const field of elements.timeFields) field.hidden = allDay;
  elements.startTime.required = !allDay;
  elements.endTime.required = !allDay;
}

function updateRecurrenceMode() {
  const frequency = elements.recurrence.value;
  elements.recurrenceAdvanced.hidden = frequency === "none";
  elements.recurrenceWeekdays.hidden = frequency !== "weekly";
}

function clearErrors() {
  elements.titleError.textContent = "";
  elements.periodError.textContent = "";
  elements.recurrenceError.textContent = "";
  elements.timezoneError.textContent = "";
}

function showErrors(errors) {
  elements.titleError.textContent = errors.title || "";
  elements.periodError.textContent = errors.period || "";
  elements.recurrenceError.textContent = errors.recurrence || "";
  elements.timezoneError.textContent = errors.timezone || "";
}

function defaultPeriod(date = new Date(), hour = null) {
  const source = new Date(date);
  if (!Number.isInteger(hour) && source.getHours() === 0 && source.getMinutes() === 0) {
    const now = new Date();
    if (toDateInput(source) === toDateInput(now)) source.setHours(now.getHours(), now.getMinutes(), 0, 0);
    else source.setHours(9, 0, 0, 0);
  }
  const start = roundToNextMinutes(source, 30);
  if (Number.isInteger(hour)) start.setHours(hour, 0, 0, 0);
  return { start, end: addMinutes(start, 60) };
}

function resetRecurrence() {
  elements.recurrence.value = "none";
  elements.recurrenceInterval.value = "1";
  elements.recurrenceUntil.value = "";
  elements.recurrenceCount.value = "";
  elements.weekdayInputs.forEach((input) => { input.checked = false; });
  updateRecurrenceMode();
}

function resetReminders(values = []) {
  const selected = new Set(values.map(Number));
  elements.reminderInputs.forEach((input) => {
    input.checked = selected.has(Number(input.dataset.reminderMinutes));
  });
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
  elements.color.value = "#00c7df";
  elements.timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  populateCalendars();
  setAllDayMode(allDay);
  resetRecurrence();
  resetReminders([]);
  clearErrors();
}

function fillFormForEdit(event) {
  const startsAt = new Date(event.is_recurring_occurrence ? event.series_starts_at : event.starts_at);
  const endsAt = new Date(event.is_recurring_occurrence ? event.series_ends_at : event.ends_at);
  elements.form.reset();
  elements.id.value = event.id;
  elements.mode.textContent = event.recurrence_frequency !== "none" ? "Editar série recorrente" : "Editar compromisso";
  elements.heading.textContent = event.title;
  elements.deleteButton.hidden = false;
  elements.title.value = event.title;
  elements.startDate.value = toZonedDateInput(startsAt, event.timezone);
  elements.startTime.value = toZonedTimeInput(startsAt, event.timezone);
  elements.endDate.value = toZonedDateInput(endsAt, event.timezone);
  elements.endTime.value = toZonedTimeInput(endsAt, event.timezone);
  elements.color.value = event.color;
  elements.timezone.value = event.timezone;
  elements.location.value = event.location || "";
  elements.description.value = event.description || "";
  populateCalendars(event.calendar_id);
  setAllDayMode(event.all_day);
  elements.recurrence.value = event.recurrence_frequency;
  elements.recurrenceInterval.value = String(event.recurrence_interval || 1);
  elements.recurrenceUntil.value = event.recurrence_until ? toZonedDateInput(new Date(event.recurrence_until), event.timezone) : "";
  elements.recurrenceCount.value = event.recurrence_count ? String(event.recurrence_count) : "";
  const weekdays = new Set(event.recurrence_by_weekday || []);
  elements.weekdayInputs.forEach((input) => {
    input.checked = weekdays.has(Number(input.dataset.recurrenceWeekday));
  });
  resetReminders(event.reminder_minutes || []);
  updateRecurrenceMode();
  clearErrors();
}

function collectFormValue() {
  const allDay = elements.allDay.checked;
  const timezone = elements.timezone.value.trim();
  const validTimezone = isValidTimeZone(timezone);
  const startsAt = validTimezone
    ? zonedDateTimeToDate(elements.startDate.value, allDay ? "00:00" : elements.startTime.value, timezone)
    : null;
  const endsAt = validTimezone
    ? zonedDateTimeToDate(elements.endDate.value, allDay ? "23:59" : elements.endTime.value, timezone)
    : null;
  const recurrenceUntilDate = elements.recurrenceUntil.value && validTimezone
    ? zonedDateTimeToDate(elements.recurrenceUntil.value, "23:59", timezone)
    : null;
  return {
    calendar_id: elements.calendar.value,
    title: elements.title.value,
    description: elements.description.value,
    location: elements.location.value,
    starts_at: startsAt?.toISOString() || "",
    ends_at: endsAt?.toISOString() || "",
    all_day: allDay,
    timezone,
    color: elements.color.value,
    recurrence_frequency: elements.recurrence.value,
    recurrence_interval: Number(elements.recurrenceInterval.value || 1),
    recurrence_until: recurrenceUntilDate && !Number.isNaN(recurrenceUntilDate.getTime())
      ? recurrenceUntilDate.toISOString()
      : null,
    recurrence_count: elements.recurrenceCount.value ? Number(elements.recurrenceCount.value) : null,
    recurrence_by_weekday: elements.weekdayInputs
      .filter((input) => input.checked)
      .map((input) => Number(input.dataset.recurrenceWeekday)),
    reminder_minutes: elements.reminderInputs
      .filter((input) => input.checked)
      .map((input) => Number(input.dataset.reminderMinutes))
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
    const result = id ? await updateEvent(id, collectFormValue()) : await createEvent(collectFormValue());
    if (!result.valid) {
      showErrors(result.errors);
      return;
    }
    elements.dialog.close();
    notify(id ? "Evento atualizado." : "Evento criado.", "success");
    await onChanged();
  } catch (error) {
    console.error("Erro ao salvar evento:", error);
    notify(error?.message || "Não foi possível salvar o evento.", "error");
  } finally {
    setSaving(false);
  }
}

async function handleDelete() {
  const eventId = elements.id.value;
  if (!eventId) return;
  const event = getEventById(eventId);
  const recurring = event?.recurrence_frequency && event.recurrence_frequency !== "none";
  if (!confirm(recurring ? "Excluir toda esta série recorrente?" : "Excluir este evento?")) return;
  setSaving(true);
  try {
    await deleteEvent(eventId);
    elements.dialog.close();
    notify(recurring ? "Série excluída." : "Evento excluído.", "success");
    await onChanged();
  } catch (error) {
    notify(error?.message || "Não foi possível excluir o evento.", "error");
  } finally {
    setSaving(false);
  }
}

export function configureModal({ onNotify, onEventChanged } = {}) {
  elements = queryElements();
  notify = onNotify || notify;
  onChanged = onEventChanged || onChanged;
  if (!elements) throw new Error("O modal de eventos não foi encontrado.");
  elements.form.addEventListener("submit", handleSubmit);
  elements.allDay.addEventListener("change", () => setAllDayMode(elements.allDay.checked));
  elements.recurrence.addEventListener("change", updateRecurrenceMode);
  elements.closeButton.addEventListener("click", () => elements.dialog.close());
  elements.cancelButton.addEventListener("click", () => elements.dialog.close());
  elements.deleteButton.addEventListener("click", handleDelete);
  elements.dialog.addEventListener("close", clearErrors);
}

export function openNewEvent(options = {}) {
  if (!getState().calendars.length) {
    notify("Crie um calendário antes de adicionar eventos.", "error");
    return;
  }
  fillFormForCreate(options);
  elements.dialog.showModal();
  setTimeout(() => elements.title.focus(), 0);
}

export function openEvent(eventId) {
  const event = getEventById(eventId);
  if (!event) {
    notify("Esse evento não está mais disponível.", "error");
    return;
  }
  fillFormForEdit(event);
  elements.dialog.showModal();
  setTimeout(() => elements.title.focus(), 0);
}

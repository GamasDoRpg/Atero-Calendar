import {
  createCalendar as apiCreateCalendar,
  deleteCalendar as apiDeleteCalendar,
  getPersistenceMode,
  listCalendars,
  updateCalendar as apiUpdateCalendar
} from "./api.js?v=4";
import {
  getState,
  removeCalendarFromState,
  setState,
  updateCalendarVisibility,
  upsertCalendarInState
} from "./state.js?v=4";

let elements = null;
let notify = () => {};
let onChanged = async () => {};

function normalizeCalendar(calendar) {
  return {
    id: String(calendar.id),
    name: String(calendar.name || "Calendário").trim().slice(0, 80),
    color: /^#[0-9a-f]{6}$/i.test(calendar.color) ? calendar.color : "#00c7df",
    visible: calendar.visible !== false,
    is_default: Boolean(calendar.is_default ?? calendar.isDefault),
    created_at: calendar.created_at || null,
    updated_at: calendar.updated_at || null
  };
}

export async function loadCalendars() {
  setState({ loadingCalendars: true });
  try {
    const calendars = (await listCalendars()).map(normalizeCalendar);
    setState({ calendars, loadingCalendars: false, persistenceMode: getPersistenceMode() });
    return calendars;
  } catch (error) {
    setState({ loadingCalendars: false });
    throw error;
  }
}

function queryElements() {
  const dialog = document.querySelector("#calendar-dialog");
  if (!dialog) return null;
  return {
    dialog,
    form: dialog.querySelector("#calendar-form"),
    id: dialog.querySelector("#calendar-id"),
    title: dialog.querySelector("#calendar-dialog-title"),
    name: dialog.querySelector("#calendar-name"),
    color: dialog.querySelector("#calendar-color"),
    visible: dialog.querySelector("#calendar-visible"),
    isDefault: dialog.querySelector("#calendar-default"),
    deleteButton: dialog.querySelector("#delete-calendar-button"),
    closeButton: dialog.querySelector("#close-calendar-dialog"),
    cancelButton: dialog.querySelector("#cancel-calendar-button"),
    saveButton: dialog.querySelector("#save-calendar-button"),
    error: dialog.querySelector("#calendar-form-error")
  };
}

function setSaving(saving) {
  elements.dialog.classList.toggle("is-saving", saving);
  elements.saveButton.disabled = saving;
  elements.deleteButton.disabled = saving;
  elements.saveButton.textContent = saving ? "Salvando…" : "Salvar";
}

function openCreate() {
  elements.form.reset();
  elements.id.value = "";
  elements.title.textContent = "Novo calendário";
  elements.name.value = "";
  elements.color.value = "#00c7df";
  elements.visible.checked = true;
  elements.isDefault.checked = getState().calendars.length === 0;
  elements.deleteButton.hidden = true;
  elements.error.textContent = "";
  elements.dialog.showModal();
  setTimeout(() => elements.name.focus(), 0);
}

function openEdit(calendarId) {
  const calendar = getState().calendars.find((item) => item.id === calendarId);
  if (!calendar) return;
  elements.form.reset();
  elements.id.value = calendar.id;
  elements.title.textContent = "Editar calendário";
  elements.name.value = calendar.name;
  elements.color.value = calendar.color;
  elements.visible.checked = calendar.visible;
  elements.isDefault.checked = calendar.is_default;
  elements.deleteButton.hidden = false;
  elements.error.textContent = "";
  elements.dialog.showModal();
}

async function submit(event) {
  event.preventDefault();
  const name = elements.name.value.trim();
  if (!name) {
    elements.error.textContent = "Dê um nome ao calendário.";
    return;
  }
  setSaving(true);
  elements.error.textContent = "";
  try {
    const id = elements.id.value;
    const payload = {
      name,
      color: elements.color.value,
      visible: elements.visible.checked,
      is_default: elements.isDefault.checked
    };
    const result = id
      ? await apiUpdateCalendar(id, payload)
      : await apiCreateCalendar(payload);
    if (payload.is_default) {
      setState({ calendars: getState().calendars.map((item) => ({ ...item, is_default: false })) });
    }
    upsertCalendarInState(normalizeCalendar(result));
    elements.dialog.close();
    notify(id ? "Calendário atualizado." : "Calendário criado.", "success");
    await onChanged();
  } catch (error) {
    elements.error.textContent = error?.message || "Não foi possível salvar o calendário.";
  } finally {
    setSaving(false);
  }
}

async function remove() {
  const id = elements.id.value;
  if (!id || !confirm("Excluir este calendário e todos os eventos dele?")) return;
  setSaving(true);
  try {
    await apiDeleteCalendar(id);
    removeCalendarFromState(id);
    elements.dialog.close();
    notify("Calendário excluído.", "success");
    await loadCalendars();
    await onChanged();
  } catch (error) {
    elements.error.textContent = error?.message || "Não foi possível excluir o calendário.";
  } finally {
    setSaving(false);
  }
}

export async function setCalendarVisibility(calendarId, visible) {
  const current = getState().calendars.find((item) => item.id === calendarId);
  if (!current) return;
  updateCalendarVisibility(calendarId, visible);
  try {
    const updated = normalizeCalendar(await apiUpdateCalendar(calendarId, { visible }));
    upsertCalendarInState(updated);
  } catch (error) {
    updateCalendarVisibility(calendarId, !visible);
    notify(error?.message || "Não foi possível atualizar a visibilidade.", "error");
  }
}

export function configureCalendarManager({ onNotify, onCalendarChanged } = {}) {
  elements = queryElements();
  notify = onNotify || notify;
  onChanged = onCalendarChanged || onChanged;
  if (!elements) throw new Error("O gerenciador de calendários não foi encontrado.");
  document.querySelector("#new-calendar-button")?.addEventListener("click", openCreate);
  document.querySelector("#calendar-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-calendar-edit]");
    if (button) openEdit(button.dataset.calendarEdit);
  });
  elements.form.addEventListener("submit", submit);
  elements.deleteButton.addEventListener("click", remove);
  elements.closeButton.addEventListener("click", () => elements.dialog.close());
  elements.cancelButton.addEventListener("click", () => elements.dialog.close());
}

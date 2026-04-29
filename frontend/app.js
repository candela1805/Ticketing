const API_BASE = "https://localhost:7264/api/v1";
const DEFAULT_IMAGE = "ImagenCards.png";
const DEFAULT_USER_ID = 1;
const AVAILABLE_STATUS = "Available";
const RESERVED_STATUS = "Reserved";
const SEATS_PER_ROW = 10;
const DEFAULT_EVENT_SECTORS = [
  { name: "General", price: 10000, capacity: 50 },
  { name: "VIP", price: 20000, capacity: 30 }
];

let seatsState = [];
let selectedSeatIds = new Set();

document.addEventListener("DOMContentLoaded", init);

function init() {
  if (document.getElementById("eventsList")) {
    loadEvents();
  }

  const toggleCreateEventButton = document.getElementById("toggleCreateEventBtn");
  if (toggleCreateEventButton) {
    toggleCreateEventButton.addEventListener("click", toggleCreateEventForm);
  }

  const createEventForm = document.getElementById("createEventForm");
  if (createEventForm) {
    createEventForm.addEventListener("submit", createEventFromForm);
    setDefaultEventDate();
  }

  const confirmButton = document.getElementById("confirmBtn");
  if (confirmButton) {
    confirmButton.addEventListener("click", confirmSelection);
  }

  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("eventId");

  if (eventId && document.getElementById("seatsGrid")) {
    loadSeats(eventId);
  }
}

function toggleCreateEventForm() {
  const form = document.getElementById("createEventForm");
  if (!form) {
    return;
  }

  form.hidden = !form.hidden;
}

function setDefaultEventDate() {
  const eventDateInput = document.getElementById("eventDate");
  if (!eventDateInput) {
    return;
  }

  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setMinutes(0, 0, 0);
  eventDateInput.value = toDateTimeLocalValue(date);
}

async function createEventFromForm(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = document.getElementById("createEventBtn");

  try {
    if (submitButton) {
      submitButton.disabled = true;
    }

    const createdEvent = await createEvent(buildCreateEventPayload(form));
    setCreateEventMessage(`Evento creado: ${createdEvent.name}`);
    form.reset();
    setDefaultEventDate();
    await loadEvents();
  } catch (error) {
    console.error("[ERROR]:", error);
    setCreateEventMessage(error.message || "No se pudo crear el evento", true);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

function buildCreateEventPayload(form) {
  const formData = new FormData(form);

  return {
    name: String(formData.get("eventName")).trim(),
    venue: String(formData.get("eventVenue")).trim(),
    eventDate: new Date(String(formData.get("eventDate"))).toISOString(),
    sectors: DEFAULT_EVENT_SECTORS
  };
}

async function createEvent(payload) {
  return fetchJson(`${API_BASE}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function setCreateEventMessage(message, isError = false) {
  const text = document.getElementById("createEventMessage");
  if (!text) {
    return;
  }

  text.textContent = message;
  text.classList.toggle("error", isError);
}

async function loadEvents() {
  const eventsList = document.getElementById("eventsList");
  if (!eventsList) {
    return;
  }

  try {
    const events = await fetchJson(`${API_BASE}/events`);
    eventsList.replaceChildren(...events.map(createEventCard));
  } catch (error) {
    console.error("[ERROR]:", error);
  }
}

function createEventCard(eventItem) {
  const card = document.createElement("article");
  card.className = "event-card";
  card.tabIndex = 0;
  card.addEventListener("click", () => openSeatMap(eventItem));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSeatMap(eventItem);
    }
  });

  const image = document.createElement("div");
  image.className = "event-image";
  image.style.backgroundImage = `url("${DEFAULT_IMAGE}")`;

  const content = document.createElement("div");
  content.className = "event-content";

  const title = document.createElement("h3");
  title.textContent = eventItem.name;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "event-btn";
  button.textContent = "Ver asientos";

  content.append(
    title,
    createInfoLine("Lugar", eventItem.venue),
    createInfoLine("Fecha", formatDate(eventItem.eventDate)),
    button
  );
  card.append(image, content);

  return card;
}

function createInfoLine(label, value) {
  const paragraph = document.createElement("p");
  const strong = document.createElement("strong");

  strong.textContent = `${label}:`;
  paragraph.append(strong, ` ${value}`);

  return paragraph;
}

function openSeatMap(eventItem) {
  const eventName = encodeURIComponent(eventItem.name);
  window.location.href = `butacas.html?eventId=${eventItem.id}&name=${eventName}`;
}

async function loadSeats(eventId) {
  const seatsGrid = document.getElementById("seatsGrid");
  if (!seatsGrid) {
    return;
  }

  const eventTitle = document.getElementById("selectedEventText");
  const params = new URLSearchParams(window.location.search);
  const eventName = params.get("name");

  if (eventTitle && eventName) {
    eventTitle.textContent = eventName;
  }

  try {
    selectedSeatIds.clear();
    seatsState = await fetchJson(`${API_BASE}/events/${eventId}/seats`);
    renderSeats();
    updateSelectionText();
  } catch (error) {
    console.error("[ERROR]:", error);
  }
}

function renderSeats() {
  const seatsGrid = document.getElementById("seatsGrid");
  if (!seatsGrid) {
    return;
  }

  seatsGrid.replaceChildren();

  const sectors = groupSeatsBySector(seatsState);

  for (const [sectorName, rows] of sectors) {
    const title = document.createElement("h3");
    title.className = "sector-title";
    title.textContent = sectorName;
    seatsGrid.appendChild(title);

    for (const [rowKey, rowSeats] of rows) {
      for (let index = 0; index < rowSeats.length; index += SEATS_PER_ROW) {
        const seatsChunk = rowSeats.slice(index, index + SEATS_PER_ROW);
        seatsGrid.appendChild(createSeatRow(rowKey, seatsChunk));
      }
    }
  }
}

function groupSeatsBySector(seats) {
  return seats.reduce((sectors, seat) => {
    const sectorName = seat.sector.name;

    if (!sectors.has(sectorName)) {
      sectors.set(sectorName, new Map());
    }

    const rows = sectors.get(sectorName);
    if (!rows.has(seat.rowIdentifier)) {
      rows.set(seat.rowIdentifier, []);
    }

    rows.get(seat.rowIdentifier).push(seat);
    return sectors;
  }, new Map());
}

function createSeatRow(rowKey, rowSeats) {
  const row = document.createElement("div");
  row.className = "row";

  const label = document.createElement("span");
  label.className = "row-label";
  label.textContent = rowKey;
  row.appendChild(label);

  rowSeats.forEach((seat) => row.appendChild(createSeatButton(seat)));

  return row;
}

function createSeatButton(seat) {
  const button = document.createElement("button");
  const isSelected = selectedSeatIds.has(seat.id);

  button.type = "button";
  button.className = ["seat", seat.status.toLowerCase(), isSelected ? "selected" : ""]
    .filter(Boolean)
    .join(" ");
  button.textContent = seat.seatNumber;

  if (seat.status !== AVAILABLE_STATUS) {
    button.disabled = true;
    return button;
  }

  button.addEventListener("click", () => toggleSeatSelection(seat.id));
  return button;
}

function toggleSeatSelection(seatId) {
  if (selectedSeatIds.has(seatId)) {
    selectedSeatIds.delete(seatId);
  } else {
    selectedSeatIds.add(seatId);
  }

  updateSelectionText();
  renderSeats();
}

async function confirmSelection() {
  const confirmButton = document.getElementById("confirmBtn");

  if (selectedSeatIds.size === 0) {
    alert("Selecciona al menos una butaca");
    return;
  }

  try {
    if (confirmButton) {
      confirmButton.disabled = true;
    }

    for (const seatId of selectedSeatIds) {
      await createReservation(seatId);
      markSeatAsReserved(seatId);
    }

    selectedSeatIds.clear();
    updateSelectionText();
    renderSeats();
    alert("Reserva realizada con exito");
  } catch (error) {
    console.error("[ERROR]:", error);
    alert("Error al reservar");
  } finally {
    if (confirmButton) {
      confirmButton.disabled = false;
    }
  }
}

async function createReservation(seatId) {
  await fetchJson(`${API_BASE}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: DEFAULT_USER_ID,
      seatId
    })
  });
}

function markSeatAsReserved(seatId) {
  const seat = seatsState.find((currentSeat) => currentSeat.id === seatId);

  if (seat) {
    seat.status = RESERVED_STATUS;
  }
}

function updateSelectionText() {
  const text = document.getElementById("selectedSeatsText");
  if (!text) {
    return;
  }

  const selectedLabels = Array.from(selectedSeatIds)
    .map(getSeatLabel)
    .join(", ");

  text.textContent = selectedLabels
    ? `Butacas seleccionadas: ${selectedLabels}`
    : "Butacas seleccionadas: Ninguna";
}

function getSeatLabel(seatId) {
  const seat = seatsState.find((currentSeat) => currentSeat.id === seatId);
  return seat ? `${seat.rowIdentifier}${seat.seatNumber}` : seatId;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json();
}

async function getErrorMessage(response) {
  try {
    const data = await response.json();
    return data.message || "Error en la solicitud";
  } catch {
    return "Error en la solicitud";
  }
}

function formatDate(dateValue) {
  return new Date(dateValue).toLocaleString("es-AR");
}

function toDateTimeLocalValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

const API_BASE = "https://localhost:7264/api/v1";
const DEFAULT_IMAGE = "ImagenCards.png";
const AUTH_USER_KEY = "ticketing.authUser";
const CART_KEY = "ticketing.cart";

const ADMIN_ROLE = "Admin";
const EMPLOYEE_ROLE = "Employee";
const CLIENT_ROLE = "Client";
const AVAILABLE_STATUS = "Available";
const RESERVED_STATUS = "Reserved";
const SOLD_STATUS = "Sold";
const SEATS_PER_ROW = 10;
const QR_PAYMENT_ACCOUNT = "0110091430009131891179";
const QR_PAYMENT_CONCEPT = "Ticketing";
const CASH_TOKEN_PREFIX = "EF";
const TICKET_PREFIX = "ENT";
const DEFAULT_EVENT_SECTORS = [
  { name: "General", price: 10000, capacity: 50 },
  { name: "VIP", price: 20000, capacity: 30 }
];

let seatsState = [];
let selectedSeatIds = new Set();
let currentUser = null;
let cartReservations = [];
let cartTimerId = null;

function redirectAdminToManagementPage() {
  if (currentUser?.role !== ADMIN_ROLE) {
    return false;
  }

  const pageName =
    window.location.pathname.split("/").pop().toLowerCase() || "index.html";

  if (pageName === "index.html") {
    return false;
  }

  window.location.href = "index.html";
  return true;
}

async function init() {

  initializeAuth();

  if (redirectAdminToManagementPage()) {
    return;
  }

  loadCartFromStorage();
  updateNavbar();
  renderPurchasedTickets();
  updateCartTotalUI();
  renderUIByRole();

  const profileIcon = document.getElementById("profileIcon");
  const payAllBtn = document.getElementById("payAllBtn");

  if (payAllBtn) {
    payAllBtn.addEventListener("click", payAllReservations);
  }

  const profileDropdown = document.getElementById("profileDropdown");

  if (profileIcon && profileDropdown) {

    profileIcon.addEventListener("click", () => {

      // si no está logueado → login
      if (!currentUser) {
        window.location.href = "login.html";
        return;
      }

      profileDropdown.classList.toggle("hidden");
    });

    // cerrar al clickear afuera
    document.addEventListener("click", (event) => {

      const inside =
        profileIcon.contains(event.target) ||
        profileDropdown.contains(event.target);

      if (!inside) {
        profileDropdown.classList.add("hidden");
      }
    });
  }

  if (document.getElementById("eventsList")) {
    loadEvents();
  }

  const toggleCreateEventButton =
    document.getElementById("toggleCreateEventBtn");

  if (toggleCreateEventButton) {
    toggleCreateEventButton.addEventListener("click", toggleCreateEventForm);
  }

  const createEventForm =
    document.getElementById("createEventForm");

  if (createEventForm) {
    createEventForm.addEventListener("submit", createEventFromForm);
    setDefaultEventDate();
  }

  const toggleCreateEmployeeButton =
    document.getElementById("toggleCreateEmployeeBtn");

  if (toggleCreateEmployeeButton) {
    toggleCreateEmployeeButton.addEventListener("click", toggleCreateEmployeeForm);
  }

  const createEmployeeForm =
    document.getElementById("createEmployeeForm");

  if (createEmployeeForm) {
    createEmployeeForm.addEventListener("submit", createEmployeeFromForm);
  }

  const toggleClientRegisterButton =
    document.getElementById("toggleClientRegisterBtn");

  if (toggleClientRegisterButton) {
    toggleClientRegisterButton.addEventListener("click", toggleClientRegisterForm);
  }

  const clientRegisterForm =
    document.getElementById("clientRegisterForm");

  if (clientRegisterForm) {
    clientRegisterForm.addEventListener("submit", createClientFromForm);
  }

  const confirmButton =
    document.getElementById("confirmBtn");

  if (confirmButton) {
    confirmButton.addEventListener("click", confirmSelection);
  }

  const sellButton =
    document.getElementById("sellBtn");

  if (sellButton) {
    sellButton.addEventListener("click", sellSelection);
  }

  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("eventId");

  if (eventId && document.getElementById("seatsGrid")) {
    loadSeats(eventId);
  }

  const searchInput =
    document.getElementById("searchEvents");

  if (searchInput) {
    searchInput.addEventListener("input", filterEvents);
  }

  applyRoleVisibility();
}

function getTicketsKey() {
  return `ticketing.tickets.${currentUser.id}`;
}

function initializeAuth() {
  const storedUser = localStorage.getItem(AUTH_USER_KEY);
  currentUser = storedUser ? JSON.parse(storedUser) : null;

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", login);
  }

  const logoutButton = document.getElementById("logoutBtn");
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }
}

function applyRoleVisibility() {
  const loginForm = document.getElementById("loginForm");
  const sessionPanel = document.getElementById("sessionPanel");
  const activeUserName = document.getElementById("activeUserName");

  if (loginForm) {
    loginForm.hidden = Boolean(currentUser);
  }

  if (sessionPanel) {
    sessionPanel.hidden = !currentUser;
  }

  if (activeUserName) {
    activeUserName.textContent = currentUser ? currentUser.name : "";
  }

  const roleText = document.getElementById("activeUserRole");
  if (roleText) {
    roleText.textContent = currentUser ? translateRole(currentUser.role) : "Sin usuario";
  }

  const employeeAdmin = document.getElementById("employeeAdmin");
  if (employeeAdmin) {
    employeeAdmin.hidden = currentUser?.role !== ADMIN_ROLE;
  }

  const clientRegisterPanel = document.getElementById("clientRegisterPanel");
  if (clientRegisterPanel) {
    clientRegisterPanel.hidden = Boolean(currentUser);
  }


  const createEventButton = document.getElementById("toggleCreateEventBtn");
  if (createEventButton) {
    createEventButton.disabled = !canManageEvents();
  }

  const reserveButton = document.getElementById("confirmBtn");
  const purchaseButton = document.getElementById("purchaseBtn");
  const sellButton = document.getElementById("sellBtn");

  if (reserveButton) {
    reserveButton.hidden = currentUser?.role !== CLIENT_ROLE;
  }

  if (purchaseButton) {
    purchaseButton.hidden = currentUser?.role !== CLIENT_ROLE;
  }

  if (sellButton) {
    sellButton.hidden = !canSellSeats();
  }

  const adminPanel = document.getElementById("adminPanel");

if (adminPanel) {
  adminPanel.hidden = currentUser?.role !== ADMIN_ROLE;
}
}

async function login(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const loginMessage = document.getElementById("loginMessage");

  try {
    if (loginMessage) {
      loginMessage.textContent = "";
    }

    currentUser = await fetchJson(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(formData.get("email")).trim(),
        password: String(formData.get("password"))
      })
    });

    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));

    form.reset();
    renderUIByRole();
    window.location.href = "index.html";

  } catch (error) {
    console.error("[ERROR]:", error);
    if (loginMessage) {
      loginMessage.textContent = error.message || "No se pudo ingresar";
    }
  }
}

function logout() {
  localStorage.removeItem(AUTH_USER_KEY);

  currentUser = null;
  cartReservations = [];

  saveCartToStorage();
  renderUIByRole();

  window.location.href = "index.html";
}

function saveCartToStorage() {

  localStorage.setItem(
    CART_KEY,
    JSON.stringify(cartReservations)
  );
}

function loadCartFromStorage() {

  const storedCart =
    localStorage.getItem(CART_KEY);

  cartReservations =
  storedCart
    ? JSON.parse(storedCart)
        .filter(
          (reservation) =>
            reservation.expiresAt > Date.now()
        )
    : [];

  renderCartPage();
}


function translateRole(role) {
  const roles = {
    [ADMIN_ROLE]: "Admin",
    [EMPLOYEE_ROLE]: "Empleado",
    [CLIENT_ROLE]: "Cliente"
  };

  return roles[role] || role;
}

function canManageEvents() {
  return currentUser?.role === EMPLOYEE_ROLE || currentUser?.role === ADMIN_ROLE;
}

function canSellSeats() {
  return currentUser?.role === EMPLOYEE_ROLE;
}

function toggleCreateEventForm() {
  if (!canManageEvents()) {
    setCreateEventMessage("Solo empleados pueden crear eventos", true);
    return;
  }

  const form = document.getElementById("createEventForm");
  if (!form) {
    return;
  }

  form.hidden = !form.hidden;
}

function toggleCreateEmployeeForm() {
  if (currentUser?.role !== ADMIN_ROLE) {
    setCreateEmployeeMessage("Solo admin puede crear empleados", true);
    return;
  }

  const form = document.getElementById("createEmployeeForm");
  if (!form) {
    return;
  }

  form.hidden = !form.hidden;

  if (!form.hidden) {
    setCreateEmployeeMessage("");
  }
}

function toggleClientRegisterForm() {
  const form = document.getElementById("clientRegisterForm");
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

  if (!currentUser || !canManageEvents()) {
    setCreateEventMessage("Solo empleados pueden crear eventos", true);
    return;
  }

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
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": String(currentUser.id)
    },
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

async function createEmployeeFromForm(event) {
  event.preventDefault();

  if (!currentUser || currentUser.role !== ADMIN_ROLE) {
    setCreateEmployeeMessage("Solo admin puede crear empleados", true);
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);
  const submitButton = document.getElementById("createEmployeeBtn");

  try {
    if (submitButton) {
      submitButton.disabled = true;
    }

    const employee = await fetchJson(`${API_BASE}/users/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminUserId: currentUser.id,
        name: String(formData.get("employeeName")).trim(),
        email: String(formData.get("employeeEmail")).trim(),
        password: String(formData.get("employeePassword")),
        documentNumber: String(formData.get("employeeDocumentNumber")).trim(),
        phone: String(formData.get("employeePhone")).trim()
      })
    });

    setCreateEmployeeMessage(`Empleado creado: ${employee.name}`);
    form.reset();
    await loadUsers();
  } catch (error) {
    console.error("[ERROR]:", error);
    setCreateEmployeeMessage(error.message || "No se pudo crear el empleado", true);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

function setCreateEmployeeMessage(message, isError = false) {
  const text = document.getElementById("createEmployeeMessage");
  if (!text) {
    return;
  }

  text.textContent = message;
  text.classList.toggle("error", isError);
}

async function createClientFromForm(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  try {
    const client = await fetchJson(`${API_BASE}/users/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("clientName")).trim(),
        email: String(formData.get("clientEmail")).trim(),
        password: String(formData.get("clientPassword"))
      })
    });

    currentUser = client;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
    form.reset();
    setClientRegisterMessage("Cliente creado. Ya podes comprar entradas.");
    applyRoleVisibility();
  } catch (error) {
    console.error("[ERROR]:", error);
    setClientRegisterMessage(error.message || "No se pudo crear el cliente", true);
  }
}

function setClientRegisterMessage(message, isError = false) {
  const text = document.getElementById("clientRegisterMessage");
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
    eventsList.textContent = "Cargando eventos...";
    const events = await fetchJson(`${API_BASE}/events`);

    if (events.length === 0) {
      eventsList.textContent = "No hay eventos cargados.";
      return;
    }

    eventsList.replaceChildren(...events.map(createEventCard));
  } catch (error) {
    console.error("[ERROR]:", error);
    eventsList.textContent = "No se pudieron cargar los eventos. Verifica que el backend y MySQL esten corriendo.";
  }
}

function filterEvents(event) {

  const text = event.target.value.toLowerCase();

  const cards = document.querySelectorAll(".event-card");

  cards.forEach((card) => {

    const title =
      card.querySelector("h3").textContent.toLowerCase();

    const visible = title.includes(text);

    card.style.display = visible
      ? "flex"
      : "none";
  });
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
  if (!seatsGrid) return;

  seatsGrid.replaceChildren();

  const sectors = groupSeatsBySector(seatsState);

  for (const [sectorName, rows] of sectors) {

    for (const [rowKey, rowSeats] of rows) {
      const headerId = `sector-${sectorName}`;

      if (!document.getElementById(headerId)) {
        const header = document.createElement("div");
        header.id = headerId;
        header.className = "sector-header";

        const price = rowSeats[0]?.sector?.price ?? 0;

        header.innerHTML = `
          <h3>${sectorName}</h3>
          <span> Precio: $${price}</span>
        `;

        seatsGrid.appendChild(header);
      }

      for (let i = 0; i < rowSeats.length; i += SEATS_PER_ROW) {
        const chunk = rowSeats.slice(i, i + SEATS_PER_ROW);
        seatsGrid.appendChild(createSeatRow(rowKey, chunk));
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

  const price = seat.sector?.price ?? 0;

  button.type = "button";
  button.className = [
    "seat",
    seat.status.toLowerCase(),
    isSelected ? "selected" : ""
  ]
    .filter(Boolean)
    .join(" ");

  if (seat.status !== AVAILABLE_STATUS) {
    button.disabled = true;
  }

  // 👇 contenido visual (número + precio)
  button.innerHTML = `
    <span class="seat-number">${seat.seatNumber}</span>
  `;

  if (seat.status === AVAILABLE_STATUS) {
    button.addEventListener("click", () => toggleSeatSelection(seat.id));
  }

  return button;
}

function toggleSeatSelection(seatId) {
  
  if (!currentUser) {
    showLoginToast();
    return;
  }

  const isEmployee = currentUser?.role === EMPLOYEE_ROLE;

  if (isEmployee) {

  const toast = document.getElementById("toast");

  if (toast) {

    toast.hidden = false;

    toast.innerHTML = `
      El staff no puede reservar butacas
    `;

    clearTimeout(showLoginToast.timeoutId);

    showLoginToast.timeoutId = setTimeout(() => {
      toast.hidden = true;
    }, 3000);
  }

  return;
}
  

  if (selectedSeatIds.has(seatId)) {
    selectedSeatIds.delete(seatId);
  } else {
    selectedSeatIds.add(seatId);
  }

  updateSelectionText();
  renderSeats();
}
function showLoginToast() {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.hidden = false;

  toast.innerHTML = `
    Debes iniciar sesión para seleccionar butacas
    <br><br>
    <button class="toast-login-btn" onclick="window.location.href='login.html'">
      Iniciar sesión
    </button>
  `;

  window.clearTimeout(showLoginToast.timeoutId);

showLoginToast.timeoutId = window.setTimeout(() => {
  toast.hidden = true;
}, 5000);
}

async function confirmSelection() {
  await submitSeatSelection("reservar", "reservadas", "reservar", createReservation, document.getElementById("confirmBtn"));
}


async function sellSelection() {
  await submitSeatSelection("vender", "vendidas", "vender", sellSeat, document.getElementById("sellBtn"));
}

async function submitSeatSelection(actionName, successName, errorName, action, button) {
  if (selectedSeatIds.size === 0) {
    alert("Selecciona al menos una butaca");
    return;
  }

  if (!currentUser) {
    alert("Ingresa con tu usuario para operar butacas");
    return;
  }

  try {
    if (button) {
      button.disabled = true;
    }

    for (const seatId of selectedSeatIds) {
      await action(seatId);
    }

    selectedSeatIds.clear();
    updateSelectionText();
    renderSeats();
    alert(`Butacas ${successName} con exito`);
  } catch (error) {
    console.error("[ERROR]:", error);
    if (error.status === 409) {
      showToast("Asiento ya no disponible");
      await refreshCurrentSeats();
    } else {
      alert(`Error al ${errorName}: ${error.message || "operacion rechazada"}`);
    }
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

async function createReservation(seatId) {
  const result = await submitSeatAction(`${API_BASE}/reservations`, seatId);
  updateSeatStatus(seatId, result.seatStatus || RESERVED_STATUS);
  addReservationToCart(result);
}

async function sellSeat(seatId) {
  const result = await submitSeatAction(`${API_BASE}/reservations/sell`, seatId);
  updateSeatStatus(seatId, result.seatStatus || SOLD_STATUS);
}

async function submitSeatAction(url, seatId) {
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: currentUser.id,
      seatId
    })
  });
}

function updateSeatStatus(seatId, status) {
  const seat = seatsState.find((currentSeat) => currentSeat.id === seatId);

  if (seat) {
    seat.status = status;
  }
}

function updateNavbar() {

  const authButtons =
    document.getElementById("authButtons");

  const myTicketsBtn =
    document.getElementById("myTicketsBtn");

  const profileDropdown =
    document.getElementById("profileDropdown");

  const profileName =
    document.getElementById("profileName");

  const profileEmail =
    document.getElementById("profileEmail");

  const profileRole =
    document.getElementById("profileRole");

  const cartBtn =
    document.getElementById("cartBtn");

  const adminPanelBtn =
    document.getElementById("adminPanelBtn");

  const tabStaff =
    document.getElementById("tabStaff");

  // ================= SIN LOGIN =================

  if (!currentUser) {

    authButtons?.classList.remove("hidden");
    myTicketsBtn?.classList.add("hidden");
    cartBtn?.classList.add("hidden");
    profileDropdown?.classList.add("hidden");

    // ocultar admin también
    adminPanelBtn?.classList.add("hidden");
    tabStaff?.classList.add("hidden");

    return;
  }

  // ================= CON LOGIN =================

  const isAdmin = currentUser.role === ADMIN_ROLE;
  const isStaff = isStaffUser(currentUser);

  authButtons?.classList.add("hidden");
  myTicketsBtn?.classList.toggle("hidden", isStaff);
  cartBtn?.classList.toggle("hidden", isStaff);
  adminPanelBtn?.classList.toggle("hidden", !isStaff);
  tabStaff?.classList.toggle("hidden", !isAdmin);

  // ================= PERFIL =================

  if (profileName) {
    profileName.innerHTML =
      `<strong>${currentUser.name}</strong>`;
  }

  if (profileEmail) {
    profileEmail.innerHTML =
      `<span>📧 ${currentUser.email}</span>`;
  }

  if (profileRole) {
    profileRole.innerHTML =
      `<span>🎭 ${translateRole(currentUser.role)}</span>`;
  }
}

function addReservationToCart(reservation) {
  const seat = seatsState.find((currentSeat) => currentSeat.id === reservation.seatId);
  const label = seat ? `${seat.rowIdentifier}${seat.seatNumber}` : reservation.seatId;

 cartReservations.push({

  reservationId:
    reservation.reservationId,

  seatId:
    reservation.seatId,

  label,

  eventName:
    document.getElementById("selectedEventText")
      ?.textContent || "Evento",

  eventDate:
    formatDate(new Date()),

  eventImage:
    DEFAULT_IMAGE,

  expiresAt:
    new Date(reservation.expiresAt).getTime(),

  price:
   seatsState.find(s => s.id === reservation.seatId)?.sector?.price || 0

});

  renderCart();
  saveCartToStorage();
  startCartTimer();
}

function renderCart() {
  const cartPanel = document.getElementById("cartPanel");
  const cartSeatsText = document.getElementById("cartSeatsText");

  if (!cartPanel || !cartSeatsText) {
    return;
  }

  cartReservations = cartReservations.filter((reservation) => reservation.expiresAt > Date.now());
  saveCartToStorage();
  cartPanel.hidden = cartReservations.length === 0;

  if (cartReservations.length === 0) {
    cartSeatsText.textContent = "Sin reservas activas";
    stopCartTimer();
    return;
  }

  cartSeatsText.textContent = `Butacas reservadas: ${cartReservations
    .map((reservation) => reservation.label)
    .join(", ")}`;
  updateCartTimer();
  const cartTotal = document.getElementById("cartTotal");

if (cartTotal) {
  const total = cartReservations.reduce(
    (acc, r) => acc + (r.price || 0),
    0
  );

  cartTotal.textContent = `Total: $${total}`;
}
}

function renderCartPage() {
  const container = document.getElementById("cartItems");
  const footerContainer = document.getElementById("cartFooterContainer");
  const summary = document.getElementById("cartSummary");

  if (!container || !footerContainer) return;

  container.innerHTML = "";
  footerContainer.innerHTML = ""; 

  if (cartReservations.length === 0) {
    container.innerHTML = `<p class="empty-cart-msg">No hay reservas activas</p>`;
    updateCartTotalUI(); 
    return; 
  }

  cartReservations.forEach((reservation) => {
    const card = document.createElement("div");
    card.className = "ticket-card";

    card.innerHTML = `
      <div class="ticket-title">
        <i class="fa-solid fa-ticket"></i> ${reservation.eventName || 'Evento'} 
      </div>

      <div class="ticket-info">
        Butaca: <strong>${reservation.label}</strong>
      </div>

      <div class="ticket-status">
        Reservada
      </div>

      <div class="ticket-timer cart-countdown" data-expires="${reservation.expiresAt}">
        <i class="fa-solid fa-clock"></i> ${formatRemainingTime(reservation.expiresAt)}
      </div>

      <div class="ticket-price">
        <i class="fa-solid fa-dollar-sign"></i> Precio: $${reservation.price}
      </div>

      <button class="pay-btn">Pagar</button>
    `;

    const payBtn = card.querySelector(".pay-btn");
    payBtn.addEventListener("click", () => simulatePayment(reservation));
    container.appendChild(card);
  });

  // El banner de 5 min solo se agrega si hay reservas
  footerContainer.innerHTML = `
    <div class="cart-footer-info">
      <div class="info-icon"><i class="fa-regular fa-clock"></i></div>
      <div class="info-text">
        <p class="info-title">Tus reservas se mantienen por 5 minutos.</p>
        <p class="info-subtitle">Si el tiempo se agota, las butacas volverán a estar disponibles.</p>
      </div>
    </div>
  `;

  startCartTimer();
  updateCartTotalUI();
}

function renderPurchasedTickets() {
  const container = document.getElementById("ticketsList");

  if (!container) {
    return;
  }

  const storedTickets = localStorage.getItem(getTicketsKey());
  const tickets = storedTickets ? JSON.parse(storedTickets) : [];

  container.innerHTML = "";

  if (tickets.length === 0) {
    container.innerHTML = `
      <p>No tienes entradas compradas</p>
    `;
    return;
  }

  tickets.forEach((ticket) => {
    const card = document.createElement("div");
    card.className = "ticket-card";

    const barcodeData = ticket.barcodeData || buildTicketBarcodeData(ticket);
    const barcodeUrl = ticket.barcodeUrl || getBarcodeUrl(barcodeData);

    card.innerHTML = `
      <img class="ticket-event-image" src="${ticket.eventImage || DEFAULT_IMAGE}" alt="${escapeHtml(ticket.eventName || "Evento")}">

      <div class="ticket-title">
        ${escapeHtml(ticket.eventName || "Evento")}
      </div>

      <div class="ticket-info">
        Titular: <strong>${escapeHtml(ticket.holderName || ticket.buyerName || currentUser?.name || "Cliente")}</strong>
      </div>

      <div class="ticket-info">
        Comprador: ${escapeHtml(ticket.buyerName || currentUser?.name || "Cliente")}
      </div>

      <div class="ticket-info">
        Butaca: <strong>${escapeHtml(ticket.label || "-")}</strong>
      </div>

      <div class="ticket-info">
        Fecha del evento: ${escapeHtml(ticket.eventDate || "Próximamente")}
      </div>

      <div class="ticket-info">
        Método: ${escapeHtml(ticket.paymentMethod || "Pago")}
      </div>

      <div class="ticket-status sold">
        Pagada
      </div>

      <div class="ticket-qr">
        <img class="ticket-barcode-image" src="${barcodeUrl}" alt="Código de barras de entrada">
        <small>${escapeHtml(ticket.ticketId || barcodeData)}</small>
      </div>
    `;

    container.appendChild(card);
  });
}

async function paySingleReservation(reservation) {
  if (!reservation) {
    alert("No hay reserva");
    return;
  }

  simulatePayment(reservation);
}

function payAllReservations() {
    if (cartReservations.length === 0) {
        showToast("El carrito está vacío.");
        return;
    }

    // Guardamos el array completo de reservas en sessionStorage
    sessionStorage.setItem(
        "pendingPayment",
        JSON.stringify(cartReservations)
    );

    // Redirigimos a la interfaz de pagos que ya creamos
    window.location.href = "pagos.html";
}

function generateReceipt({ user, tickets, total, method, paymentId, cashToken }) {
  const date = new Date().toLocaleString("es-AR");
  const ticketCards = tickets.map((ticket, index) => `
    <section class="print-ticket">
      <div class="ticket-top">
        <img class="ticket-image" src="${ticket.eventImage}" alt="${escapeHtml(ticket.eventName)}">
        <div>
          <p class="ticket-kicker">Entrada ${index + 1} de ${tickets.length}</p>
          <h2>${escapeHtml(ticket.eventName)}</h2>
          <p><strong>Fecha del evento:</strong> ${escapeHtml(ticket.eventDate)}</p>
          <p><strong>Butaca:</strong> ${escapeHtml(ticket.label)}</p>
        </div>
      </div>

      <div class="ticket-details">
        <p><strong>Titular:</strong> ${escapeHtml(ticket.holderName)}</p>
        <p><strong>Comprador:</strong> ${escapeHtml(user.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(user.email || "-")}</p>
        <p><strong>Método:</strong> ${escapeHtml(method)}</p>
        <p><strong>Precio:</strong> $${ticket.price}</p>
        <p><strong>Fecha de compra:</strong> ${escapeHtml(date)}</p>
        <p><strong>ID entrada:</strong> ${escapeHtml(ticket.ticketId)}</p>
        ${cashToken ? `<p><strong>Token efectivo:</strong> ${escapeHtml(cashToken)}</p>` : ""}
      </div>

      <div class="barcode-box">
        <img src="${ticket.barcodeUrl}" alt="Código de barras">
        <small>${escapeHtml(ticket.barcodeData)}</small>
      </div>
    </section>
  `).join("");

  return `
    <style>
      .tickets-document { font-family: Arial, sans-serif; color: #111827; }
      .tickets-summary { max-width: 760px; margin: 0 auto 18px; text-align: left; border: 1px solid #d1d5db; padding: 14px; border-radius: 8px; }
      .tickets-summary h1 { font-size: 24px; margin: 0 0 8px; text-align: center; }
      .tickets-summary p { margin: 4px 0; }
      .print-ticket { max-width: 760px; margin: 0 auto 18px; padding: 18px; border: 2px solid #111827; border-radius: 10px; background: #fff; page-break-after: always; text-align: left; }
      .ticket-top { display: grid; grid-template-columns: 170px 1fr; gap: 16px; align-items: center; }
      .ticket-image { width: 170px; height: 110px; object-fit: cover; border-radius: 8px; border: 1px solid #d1d5db; }
      .ticket-kicker { margin: 0 0 4px; color: #2563eb; font-weight: 700; text-transform: uppercase; font-size: 12px; }
      .print-ticket h2 { margin: 0 0 8px; font-size: 24px; }
      .ticket-details { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin-top: 16px; }
      .ticket-details p { margin: 0; }
      .barcode-box { margin-top: 16px; text-align: center; border-top: 1px dashed #9ca3af; padding-top: 14px; }
      .barcode-box img { max-width: 100%; height: 72px; object-fit: contain; }
      .barcode-box small { display: block; margin-top: 6px; word-break: break-all; font-size: 11px; }
      @media print {
        body { background: #fff; }
        body > *:not(#receiptModal) { display: none !important; }
        #receiptModal { position: static !important; display: block !important; background: #fff !important; }
        #receiptModal .modal-content { max-width: none !important; width: auto !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; padding: 0 !important; }
        .modal-actions { display: none !important; }
        .print-ticket { break-after: page; }
      }
    </style>
    <div class="tickets-document">
      <div class="tickets-summary">
        <h1>Entradas emitidas</h1>
        <p><strong>ID pago:</strong> ${escapeHtml(paymentId)}</p>
        <p><strong>Comprador:</strong> ${escapeHtml(user.name)}</p>
        <p><strong>Método:</strong> ${escapeHtml(method)}</p>
        <p><strong>Total:</strong> $${total}</p>
        ${cashToken ? `<p><strong>Token efectivo:</strong> ${escapeHtml(cashToken)}</p>` : ""}
      </div>
      ${ticketCards}
    </div>
  `;
}

function downloadReceipt(htmlContent) {

  const blob = new Blob([htmlContent], { type: "text/html" });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = `entradas_${Date.now()}.html`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}


// =========================
// 💳 FUNCION PRINCIPAL PAGO
// =========================
function simulatePayment(reservation) {

    if (reservation.expiresAt <= Date.now()) {
        showToast("Esta reserva ha expirado.");
        return;
    }

    sessionStorage.setItem(
        "pendingPayment",
        JSON.stringify(reservation)
    );

    window.location.href = "pagos.html";
}

function buildQrPaymentPayload(totalAmount) {
    return [
        `CBU/CVU destino: ${QR_PAYMENT_ACCOUNT}`,
        `Monto total: $${totalAmount}`,
        "Moneda: ARS",
        `Concepto: ${QR_PAYMENT_CONCEPT}`
    ].join("\n");
}

function getPaymentMethodLabel(method) {
    const labels = {
        Tarjeta: "Tarjeta de Crédito/Débito",
        QR: "Pago con QR",
        Efectivo: "Efectivo (Rapipago)"
    };

    return labels[method] || method;
}

function isStaffUser(user = currentUser) {
    return user?.role === EMPLOYEE_ROLE || user?.role === ADMIN_ROLE;
}

function generateCashPaymentToken() {
    const randomValues = new Uint32Array(2);
    window.crypto.getRandomValues(randomValues);
    return `${CASH_TOKEN_PREFIX}-${Date.now().toString(36).toUpperCase()}-${randomValues[0].toString(36).toUpperCase()}${randomValues[1].toString(36).toUpperCase()}`;
}

function getAssetUrl(assetPath) {
    return new URL(assetPath || DEFAULT_IMAGE, window.location.href).href;
}

function getBarcodeUrl(data) {
    return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(data)}&code=Code128&translate-esc=on`;
}

function buildTicketBarcodeData(ticket) {
    return [
        `ID:${ticket.ticketId || "-"}`,
        `EVENTO:${ticket.eventName || "-"}`,
        `TITULAR:${ticket.holderName || "-"}`,
        `COMPRADOR:${ticket.buyerName || "-"}`,
        `BUTACA:${ticket.label || "-"}`
    ].join("|");
}

function buildPurchasedTicket({ reservation, holderName, buyer, paymentMethod, paymentId, cashToken, index }) {
    const ticketId = `${TICKET_PREFIX}-${Date.now().toString(36).toUpperCase()}-${index + 1}`;
    const ticket = {
        ticketId,
        paymentId,
        reservationId: reservation.reservationId,
        label: reservation.label,
        eventName: reservation.eventName || "Evento",
        eventDate: reservation.eventDate || "Próximamente",
        eventImage: getAssetUrl(reservation.eventImage || DEFAULT_IMAGE),
        holderName,
        buyerName: buyer.name,
        buyerEmail: buyer.email,
        price: reservation.price || 0,
        paymentMethod,
        cashToken,
        purchaseDate: new Date().toLocaleString("es-AR")
    };

    ticket.barcodeData = buildTicketBarcodeData(ticket);
    ticket.barcodeUrl = getBarcodeUrl(ticket.barcodeData);

    return ticket;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// =========================
// 💳 PAGOS.HTML INIT
// =========================
function initPaymentPage() {
    initializeAuth();

    // 1. REFERENCIAS DE ELEMENTOS
    const methodSelector = document.getElementById("methodSelector");
    const methodDetails = document.getElementById("methodDetails");
    const totalBtn = document.getElementById("totalBtn");
    const summary = document.getElementById("paymentSummary");
    const form = document.getElementById("paymentForm");
    const confirmBtn = document.getElementById("confirmPaymentBtn");
    const ticketHolders = document.getElementById("ticketHolders");

    const rawData = JSON.parse(sessionStorage.getItem("pendingPayment"));
    
    // Normalizamos: siempre trabajamos con un Array (reservationsToPay)
    if (!rawData) {
        alert("No hay datos de reserva.");
        window.location.href = "index.html";
        return;
    }

    if (!currentUser) {
        alert("Iniciá sesión para finalizar el pago.");
        window.location.href = "Login.html";
        return;
    }

    const reservationsToPay = Array.isArray(rawData) ? rawData : [rawData];

    let lastGeneratedHtml = "";

    // -------------------------
    // 2. RESUMEN DE CARGA
    // -------------------------
    const totalAmount = reservationsToPay.reduce((acc, r) => acc + (r.price || 0), 0);
    const eventNames = [...new Set(reservationsToPay.map(r => r.eventName || "Evento"))].join(", ");
    const labels = reservationsToPay.map(r => r.label).join(", ");

    summary.innerHTML = `
        <strong>Eventos:</strong> ${eventNames} <br>
        <strong>Butacas:</strong> ${labels}
    `;
    totalBtn.textContent = `$${totalAmount}`;
    const cashPaymentToken = generateCashPaymentToken();

    if (ticketHolders) {
        ticketHolders.innerHTML = `
            <h3>Titulares de las entradas</h3>
            ${reservationsToPay.map((reservation, index) => `
                <label for="ticketHolder${index}">
                    Entrada ${index + 1} - Butaca ${escapeHtml(reservation.label || "-")}
                </label>
                <input
                    id="ticketHolder${index}"
                    class="ticket-holder-input"
                    type="text"
                    value="${escapeHtml(currentUser.name || "")}"
                    placeholder="Nombre y apellido del titular"
                    required
                >
            `).join("")}
        `;
    }

    // -------------------------
    // 3. UI DINÁMICA DE MÉTODOS
    // -------------------------
    function renderMethod() {
        const method = methodSelector.value;
        if (method === "Tarjeta") {
            methodDetails.innerHTML = `
                <input type="text" placeholder="Número de Tarjeta" maxlength="16" required>
                <div style="display:flex; gap:10px;">
                    <input type="text" placeholder="MM/AA" maxlength="5" required style="width:50%;">
                    <input type="password" placeholder="CVV" maxlength="3" required style="width:50%;">
                </div>
                <input type="text" placeholder="Nombre del Titular" required>
            `;
        } else if (method === "QR") {
            const qrPayload = buildQrPaymentPayload(totalAmount);
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(qrPayload)}`;

            methodDetails.innerHTML = `
                <div class="qr-payment">
                    <p class="qr-payment-title">Escaneá el QR para pagar</p>
                    <img class="qr-payment-image" src="${qrUrl}" alt="QR de pago">
                    <div class="qr-payment-data">
                        <span>Total</span>
                        <strong>$${totalAmount}</strong>
                        <span>CBU/CVU destino</span>
                        <strong>${QR_PAYMENT_ACCOUNT}</strong>
                    </div>
                    <small>El QR incluye la cuenta destino y el total exacto.</small>
                </div>
            `;
        } else if (method === "Efectivo") {
            if (isStaffUser()) {
                methodDetails.innerHTML = `
                    <div class="cash-payment staff-cash-payment">
                        <p>Monto a cobrar</p>
                        <strong>$${totalAmount}</strong>
                        <span>Pago realizado en efectivo</span>
                    </div>
                `;
            } else {
                methodDetails.innerHTML = `
                    <div class="cash-payment">
                        <p>Token único para pago en efectivo</p>
                        <strong>${cashPaymentToken}</strong>
                        <span>Total: $${totalAmount}</span>
                        <small>Presentá este token para pagar en Pago Fácil, Rapipago o en la puerta.</small>
                    </div>
                `;
            }
        }
    }

    methodSelector.addEventListener("change", renderMethod);
    renderMethod();

    // -------------------------
    // 4. PROCESO DE PAGO (SUBMIT)
    // -------------------------
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Procesando...";

        try {
            const purchasedTickets = [];
            let firstPaymentId = "";
            const selectedPaymentMethod = methodSelector.value;
            const paymentMethodLabel = getPaymentMethodLabel(selectedPaymentMethod);
            const cashToken = selectedPaymentMethod === "Efectivo" ? cashPaymentToken : null;
            const ticketHolderNames = reservationsToPay.map((_, index) => {
                const input = document.getElementById(`ticketHolder${index}`);
                return input?.value.trim() || "";
            });

            if (ticketHolderNames.some((name) => !name)) {
                throw new Error("Completá el nombre del titular de cada entrada");
            }

            // Procesamos cada reserva con el backend
            for (const [index, res] of reservationsToPay.entries()) {
                const response = await fetchJson(`${API_BASE}/payments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: currentUser.id,
                        reservationId: res.reservationId,
                        amount: res.price,
                        paymentMethod: paymentMethodLabel
                    })
                });

                const paymentId = response.id || response.paymentId || `PAY-${Date.now()}-${index + 1}`;
                if (!firstPaymentId) firstPaymentId = paymentId;

                purchasedTickets.push(buildPurchasedTicket({
                    reservation: res,
                    holderName: ticketHolderNames[index],
                    buyer: currentUser,
                    paymentMethod: paymentMethodLabel,
                    paymentId,
                    cashToken,
                    index
                }));
            }

            // Generamos el comprobante con la lista (uno o muchos)
            lastGeneratedHtml = generateReceipt({
                user: currentUser,
                tickets: purchasedTickets,
                total: totalAmount,
                method: paymentMethodLabel,
                paymentId: firstPaymentId || "ID-" + Date.now(),
                cashToken
            });

            // Mostramos el modal de éxito
            document.getElementById("receiptPreview").innerHTML = lastGeneratedHtml;
            document.getElementById("receiptModal").style.display = "flex";

            // Actualizamos historial local
            savePurchasedTickets(purchasedTickets);
            
            // Limpiamos del carrito solo lo que se pagó
            const idsPagados = reservationsToPay.map(r => r.reservationId);
            cartReservations = cartReservations.filter(r => !idsPagados.includes(r.reservationId));
            
            saveCartToStorage();
            sessionStorage.removeItem("pendingPayment");

            // Si tienes un contador en el carrito, lo actualizamos
            if (typeof renderCart === "function") renderCart();

        } catch (error) {
            console.error(error);
            alert("Error al procesar el pago: " + error.message);
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `Confirmar Pago de <span id="totalBtn">$${totalAmount}</span>`;
        }
    });

    // 5. EVENTOS DEL MODAL
    document.getElementById("printBtn").onclick = () => {
        window.print();
    };

    document.getElementById("downloadBtn").onclick = () => {
        downloadReceipt(lastGeneratedHtml);
    };

    document.getElementById("closeModalBtn").onclick = () => {
        window.location.href = "index.html";
    };
}



// =========================
// 🚀 ACTIVACIÓN SOLO PAGOS
// =========================
if (window.location.pathname.includes("pagos.html")) {
    document.addEventListener("DOMContentLoaded", initPaymentPage);
}


// --- FUNCIONES DE SOPORTE Y UTILIDADES ---


function savePurchasedTickets(newTickets) {
    const storedTickets = localStorage.getItem(getTicketsKey());
    const tickets = storedTickets ? JSON.parse(storedTickets) : [];
    tickets.push(...newTickets);
    localStorage.setItem(getTicketsKey(), JSON.stringify(tickets));
}

function startCartTimer() {
    if (cartTimerId) return;
    cartTimerId = window.setInterval(() => {
        const elements = document.querySelectorAll(".cart-countdown");
        const now = Date.now();
        elements.forEach((element) => {
            const expiresAt = Number(element.dataset.expires);
            const diff = expiresAt - now;
            if (diff <= 0) {
                element.textContent = "00:00";
                return;
            }
            element.textContent = formatCountdown(Math.ceil(diff / 1000));
        });
    }, 1000);
}

function stopCartTimer() {
    if (!cartTimerId) return;
    window.clearInterval(cartTimerId);
    cartTimerId = null;
}

async function updateCartTimer() {
    const cartTimer = document.getElementById("cartTimer");
    if (!cartTimer || cartReservations.length === 0) return;

    const nextExpiration = Math.min(...cartReservations.map((reservation) => reservation.expiresAt));
    const remainingSeconds = Math.max(0, Math.ceil((nextExpiration - Date.now()) / 1000));

    cartTimer.textContent = formatCountdown(remainingSeconds);

    if (remainingSeconds === 0) {
        cartReservations = cartReservations.filter((reservation) => reservation.expiresAt > Date.now());
        saveCartToStorage();
        showToast("La reserva venció y el asiento volvió a estar disponible");
        renderCart();
        await refreshCurrentSeats();
    }
}

function formatCountdown(totalSeconds) {
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function formatRemainingTime(expiresAt) {
    const remainingSeconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    return formatCountdown(remainingSeconds);
}

async function refreshCurrentSeats() {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("eventId");
    if (!eventId || !document.getElementById("seatsGrid")) return;
    selectedSeatIds.clear();
    await loadSeats(eventId);
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
        toast.hidden = true;
    }, 3500);
}

function updateSelectionText() {
    const text = document.getElementById("selectedSeatsText");
    if (!text) return;
    const selectedLabels = Array.from(selectedSeatIds).map(getSeatLabel).join(", ");
    text.textContent = selectedLabels ? `Butacas seleccionadas: ${selectedLabels}` : "Butacas seleccionadas: Ninguna";
}

function getSeatLabel(seatId) {
    const seat = seatsState.find((currentSeat) => currentSeat.id === seatId);
    return seat ? `${seat.rowIdentifier}${seat.seatNumber}` : seatId;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);

  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text);
  }

  if (!res.ok) {
    throw new Error(data?.message || `Error: ${res.status}`);
  }

  return data;
}

function formatDate(dateValue) {
    return new Date(dateValue).toLocaleString("es-AR");
}

function toDateTimeLocalValue(date) {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
}

function getCartTotal() {
    return cartReservations.reduce((total, r) => total + (r.price || 0), 0);
}

function updateCartTotalUI() {
    const total = cartReservations.reduce((acc, r) => acc + (r.price || 0), 0);
    const totalText = document.getElementById("cartTotalText");
    if (totalText) {
        totalText.textContent = `$${total}`;
        totalText.style.color = total === 0 ? "#6c757d" : "#28a745";
    }
}

async function renderUsersTables() {
    try {
        const allUsers = await fetchJson(`${API_BASE}/users`);

        const clients = allUsers.filter(u => 
            String(u.role).toLowerCase() === 'client' || 
            String(u.role).toLowerCase() === 'cliente' || 
            u.role === 0
        );

        const clientsTable = document.getElementById("clientsListTable");
        
        if (clientsTable) {
            if (clients.length === 0) {
                clientsTable.innerHTML = `<tr><td colspan="3">No hay clientes registrados</td></tr>`;
            } else {
                clientsTable.innerHTML = clients.map(c => `
                    <tr>
                        <td>${c.name}</td>
                        <td>${c.email}</td>
                        <td>
                            <button class="btn-del" onclick="deleteUser(${c.id})">Eliminar</button>
                        </td>
                    </tr>
                `).join("");
            }
        }
    } catch (error) {
        console.error("Error en renderUsersTables:", error);
    }
}

function renderUIByRole() {
  const user = currentUser;
  const authButtons = document.getElementById("authButtons");
  const myTicketsBtn = document.getElementById("myTicketsBtn");
  const cartBtn = document.getElementById("cartBtn");
  const adminPanelBtn = document.getElementById("adminPanelBtn");
  const tabStaff = document.getElementById("tabStaff");
  const staffPanel = document.getElementById("staffPanel");
  const mainClientView = document.getElementById("mainClientView");
  const closeAdminButton = document.querySelector(".btn-close-admin");

  // ================= NO LOGUEADO =================
  if (!user) {
    authButtons?.classList.remove("hidden");
    myTicketsBtn?.classList.add("hidden");
    cartBtn?.classList.add("hidden");
    adminPanelBtn?.classList.add("hidden");
    tabStaff?.classList.add("hidden");

    if (mainClientView) {
      mainClientView.hidden = false;
    }

    if (staffPanel) {
      staffPanel.hidden = true;
      staffPanel.classList.add("hidden");
    }

    closeAdminButton?.classList.remove("hidden");
    return;
  }

  // ================= LOGUEADO =================
  const isStaff = isStaffUser(user);
  const isAdmin = user.role === ADMIN_ROLE;

  const backHomeBtn = document.getElementById("backHomeBtn");

  authButtons?.classList.add("hidden");
  myTicketsBtn?.classList.toggle("hidden", isStaff);
  cartBtn?.classList.toggle("hidden", isStaff);
  adminPanelBtn?.classList.toggle("hidden", !isStaff);
  tabStaff?.classList.toggle("hidden", !isAdmin);
  closeAdminButton?.classList.toggle("hidden", isAdmin);

backHomeBtn?.classList.toggle(
  "hidden",
  currentUser.role !== EMPLOYEE_ROLE
);

  if (mainClientView) {
    mainClientView.hidden = isAdmin;
  }

  if (staffPanel) {
    staffPanel.hidden = !isAdmin;
    staffPanel.classList.toggle("hidden", !isAdmin);
  }

  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const profileRole = document.getElementById("profileRole");

  if (profileName) profileName.textContent = user.name;
  if (profileEmail) profileEmail.textContent = user.email;
  if (profileRole) profileRole.textContent = translateRole(user.role);

  if (isAdmin && document.getElementById("tab-staff")) {
    switchTab("staff");
  }
}

function mostrar(seccion) {
  
  document.querySelectorAll(".seccion").forEach(s => {
    s.classList.add("hidden");
  });

 
  const target = document.getElementById(seccion);
  if (target) {
    target.classList.remove("hidden");
  }


  if (seccion === 'clientes' || seccion === 'empleados') {
    renderUsersTables(); 
  } else if (seccion === 'eventos') {
    // Aquí llamarías a la función que carga tus eventos
    // loadEvents(); 
  } else if (seccion === 'pagos') {
    // Aquí la que cargue los pagos
    // loadPayments();
  }
}

function crearEvento() {
  alert("Abrir formulario de evento");
}

function openStaffPanel() {

  if (!currentUser ||
      (currentUser.role !== ADMIN_ROLE &&
       currentUser.role !== EMPLOYEE_ROLE)) {
    alert("No autorizado");
    return;
  }

  const isAdmin = currentUser.role === ADMIN_ROLE;
  const mainClientView = document.getElementById("mainClientView");
  const staffPanel = document.getElementById("staffPanel");
  const closeAdminButton = document.querySelector(".btn-close-admin");

  if (mainClientView) {
    mainClientView.hidden = true;
  }

  if (staffPanel) {
    staffPanel.hidden = false;
    staffPanel.classList.remove("hidden");
  }

  closeAdminButton?.classList.toggle("hidden", isAdmin);

  if (currentUser.role === EMPLOYEE_ROLE) {
  document.getElementById("adminPanelBtn")
    ?.classList.add("hidden");
}

  if (currentUser.role === EMPLOYEE_ROLE) {
  document.getElementById("backStoreBtn")
    ?.classList.remove("hidden");
}  

  switchTab(isAdmin ? "staff" : "events");
}

function closeAdminPanel() {
  if (currentUser?.role === ADMIN_ROLE) {
    return;
  }

  const staffPanel = document.getElementById("staffPanel");
  const mainClientView = document.getElementById("mainClientView");

  if (staffPanel) {
    staffPanel.hidden = true;
    staffPanel.classList.add("hidden");
  }

  if (mainClientView) {
    mainClientView.hidden = false;
  }

  document.getElementById("backStoreBtn")
    ?.classList.add("hidden");

  const user = currentUser;

  if (user &&
     (user.role === ADMIN_ROLE ||
      user.role === EMPLOYEE_ROLE)) {

    document.getElementById("adminPanelBtn")
      ?.classList.remove("hidden");
  }
}

let events = [];
let eventSectors = [];
let users = [];
let payments = [];

function renderAdminEvents() {

  const tbody =
    document.getElementById("adminEventsList");

  if (!tbody) return;

  tbody.innerHTML = "";

  events.forEach((ev) => {

    const sectorsText =
      ev.sectors
        ?.map(s => `${s.name} ($${s.price})`)
        .join(" | ")
      || "-";

    tbody.innerHTML += `

      <tr>

        <td>
          ${ev.name}
        </td>

        <td>
          ${formatDate(ev.eventDate)}
        </td>

        <td>
          ${ev.venue || "-"}
        </td>

        <td>
          ${sectorsText}
        </td>

        <td>
          ${ev.status}
        </td>

        <td>

          <button
            class="btn-edit"
            onclick="editEvent('${ev.id}')"
          >
            Editar
          </button>

          <button
            class="btn-del"
            onclick="deleteEvent('${ev.id}')"
          >
            Eliminar
          </button>

        </td>

      </tr>
    `;
  });
}

function openEventModal(mode = "create") {
  const form = document.getElementById("eventForm");
  const title = document.getElementById("modalTitle");

  if (mode === "create" && form) {
    form.reset();
    delete form.dataset.editing;
    eventSectors = [{ name: "General", price: 10000, capacity: 50 }];
    renderSectorList();
  }

  if (title) {
    title.textContent = mode === "edit" ? "Editar Evento" : "Nuevo Evento";
  }

  document.getElementById("eventModal")?.classList.remove("hidden");
}

function closeEventModal() {
  document.getElementById("eventModal")?.classList.add("hidden");
}

document.getElementById("eventForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const form = e.currentTarget;
        const editingId = form.dataset.editing;

        // 1. Captura de datos
        const name = document.getElementById("evName")?.value?.trim();
        const venue = document.getElementById("evVenue")?.value?.trim();
        const dateValue = document.getElementById("evDate")?.value;
        const status = document.getElementById("evStatus")?.value || "Active";

        if (!name || !venue || !dateValue) {
            alert("Por favor, completa todos los campos del evento.");
            return;
        }

        const sectors = (getSectorsFromDOM() || []).map(s => ({
            id: s.id,
            name: s.name,
            price: parseFloat(s.price) || 0,
            capacity: parseInt(s.capacity, 10) || 0
        }));

        const payload = {
            name,
            venue,
            eventDate: new Date(dateValue).toISOString(),
            status,
            sectors
        };

        const url = editingId ? `${API_BASE}/events/${editingId}` : `${API_BASE}/events`;
        const method = editingId ? "PUT" : "POST";

        await fetchJson(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "X-User-Id": String(currentUser.id)
            },
            body: JSON.stringify(payload)
        });

        // 6. Éxito: Actualizar UI y limpiar
        await loadAdminEvents();
        await loadEvents();
        
        switchTab("events");
        closeEventModal();
        form.reset();
        delete form.dataset.editing;
        
        eventSectors = [];
        renderSectorList();

        alert(editingId ? "Evento actualizado con éxito" : "Evento creado con éxito");

    } catch (error) {
        console.error("Error en el guardado:", error);
        alert(error.message);
    }
});

function editEvent(eventId) {
  const ev = events.find(e => e.id == eventId);
  if (!ev) return;

  document.getElementById("evName").value = ev.name || "";
  document.getElementById("evVenue").value = ev.venue || "";
  document.getElementById("evDate").value = ev.eventDate?.slice(0, 16) || "";
  document.getElementById("evStatus").value = ev.status || "Active";

  eventSectors = ev.sectors?.length
    ? ev.sectors.map((sector) => ({
        id: sector.id || null,
        name: sector.name || "",
        price: sector.price || 0,
        capacity: sector.capacity || 1
      }))
    : [{ name: "General", price: 10000, capacity: 50 }];
  renderSectorList();

  const form = document.getElementById("eventForm");
  form.dataset.editing = eventId;

  openEventModal("edit");
}



async function deleteEvent(eventId) {
  if (!confirm("¿Eliminar evento?")) return;

  try {
    await fetch(`${API_BASE}/events/${eventId}`, {
      method: "DELETE",
      headers: {
        "X-User-Id": currentUser.id
      }
    });

    await loadAdminEvents();
    await loadEvents();

    alert("Evento eliminado correctamente");

  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

function renderEvents() {
  const container = document.getElementById("eventsContainer");
  if (!container) return;

  container.innerHTML = events.map(ev => `
    <div class="event-card">
      <h3>${ev.name}</h3>
      <p>${ev.venue || ""}</p>
    </div>
  `).join("");
}

function renderClients() {
  const tbody = document.getElementById("clientsListTable");
  if (!tbody) return;

  tbody.innerHTML = "";

  users
    .filter(u => u.role === "Client")
    .forEach(u => {
      tbody.innerHTML += `
        <tr>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td>
            <button class="btn-del" onclick="deleteUser(${u.id})">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    });
}

function renderStaff() {
  const tbody = document.getElementById("staffListTable");
  if (!tbody) return;

  tbody.innerHTML = "";

  users
    .filter(u => u.role === "Employee" || u.role === "Admin")
    .forEach(u => {
      tbody.innerHTML += `
        <tr>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td>${u.role}</td>
          <td>
            ${
              u.role === "Admin"
                ? `<span>Protegido</span>`
                : `<button class="btn-del" onclick="deleteUser(${u.id})">
                    Eliminar
                   </button>`
            }
          </td>
        </tr>
      `;
    });
}

function renderPayments() {
  const container = document.getElementById("paymentsLog");
  if (!container) return;

  container.innerHTML = "";

  payments.forEach(p => {
    container.innerHTML += `
      <div style="padding:10px;border-bottom:1px solid #333">
        <b>${p.user}</b> compró ${p.event} - $${p.amount}
      </div>
    `;
  });
}

function switchTab(tab) {

  document.querySelectorAll(".tab-content")
    .forEach(t => t.classList.add("hidden"));

  document.getElementById(`tab-${tab}`)?.classList.remove("hidden");

  document.querySelectorAll(".tab-btn")
    .forEach(button => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });

  if (tab === "events") loadAdminEvents();
  if (tab === "users") loadUsers();
  if (tab === "staff") loadUsers();
  if (tab === "payments") loadPayments();
}

async function loadAdminEvents() {
  try {
    events = await fetchJson(`${API_BASE}/events`);
    renderAdminEvents();
  } catch (e) {
    console.error(e);
  }
}

async function loadUsers() {
  try {
    users = await fetchJson(`${API_BASE}/users`);
    renderClients();
    renderStaff();
  } catch (e) {
    console.error(e);
  }
}

async function loadPayments() {
  try {
    payments = await fetchJson(`${API_BASE}/payments`);
    renderPayments();
  } catch (e) {
    console.error(e);
  }
}



window.addSector = function () {
  const container = document.getElementById("sectorsContainer");

  if (!container) {
    return;
  }

  const div = document.createElement("div");
  div.className = "sector-item";

  div.innerHTML = `
    <input type="text" class="sector-name" placeholder="Nombre sector" required>
    <input type="number" class="sector-price" placeholder="Precio" required>
    <input type="number" class="sector-capacity" placeholder="Capacidad" required>
    <button type="button" onclick="this.parentElement.remove()">Eliminar</button>
  `;

  container.appendChild(div);
};


function renderSectorList() {
  const container = document.getElementById("sectorsContainer");
  if (!container) return;

  container.innerHTML = eventSectors.map((s, i) => `
    <div class="sector-item" data-sector-id="${Number(s.id) || ""}">
      <input
        type="text"
        class="sector-name"
        placeholder="Nombre sector"
        value="${escapeHtmlAttribute(s.name || "")}"
        required
      >
      <input
        type="number"
        class="sector-price"
        placeholder="Precio"
        value="${Number(s.price) || 0}"
        required
      >
      <input
        type="number"
        class="sector-capacity"
        placeholder="Capacidad"
        value="${Number(s.capacity) || 1}"
        required
      >
      <button type="button" onclick="removeSector(${i})">Eliminar</button>
    </div>
  `).join("");
}

function removeSector(index) {
  const sectors = Array.from(document.querySelectorAll("#sectorsContainer .sector-item"));
  sectors[index]?.remove();
}


function getSectorsFromDOM() {
  const sectors = document.querySelectorAll("#sectorsContainer .sector-item");

  const result = Array.from(sectors).map(div => {
    const id = Number(div.dataset.sectorId) || null;
    const name = div.querySelector(".sector-name")?.value?.trim();
    const price = Number(div.querySelector(".sector-price")?.value);
    const capacity = Number(div.querySelector(".sector-capacity")?.value);

    return { id, name, price, capacity };
  });

  // validación UX (ANTES de enviar)
  for (const s of result) {
    if (!s.name) throw new Error("Sector sin nombre");

    if (s.price <= 0) {
      throw new Error("El precio debe ser mayor a 0");
    }

    if (s.capacity <= 0) {
      throw new Error("La capacidad debe ser mayor a 0");
    }

    if (s.capacity > 200) {
      throw new Error("La capacidad máxima por sector es 200");
    }
  }

  return result;
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function deleteUser(userId) {
    if (!confirm("¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/users/${userId}`, {
            method: "DELETE",
            headers: {
                "X-User-Id": currentUser.id // Para validar quién borra
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Error al eliminar usuario");
        }

        alert("Usuario eliminado con éxito");
        
        // Recargamos la lista de usuarios para actualizar la tabla
        await loadUsers(); 

    } catch (error) {
        console.error("Error:", error);
        alert(error.message);
    }
}

document.addEventListener("DOMContentLoaded", init);

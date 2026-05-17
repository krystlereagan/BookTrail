const STORAGE_KEY = "booktrail.records.v1";

const state = {
  books: [],
  activeCode: null,
  user: null,
  useLocalFallback: false,
};

const views = document.querySelectorAll(".view");
const tabs = document.querySelectorAll(".tab");
const registerForm = document.querySelector("#register-form");
const lookupForm = document.querySelector("#lookup-form");
const bookDetail = document.querySelector("#book-detail");
const bookList = document.querySelector("#book-list");
const detailTemplate = document.querySelector("#detail-template");
const printButton = document.querySelector("#print-button");
const copyButton = document.querySelector("#copy-button");
const seedButton = document.querySelector("#seed-button");
const labelQr = document.querySelector("#label-qr");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const profilePanel = document.querySelector("#profile-panel");
const accountChip = document.querySelector("#account-chip");
const manageTab = document.querySelector("#manage-tab");
const manageContent = document.querySelector("#manage-content");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) {
    showMessage(registerForm, "Please sign in before registering a book.");
    showView("account");
    return;
  }

  const formData = new FormData(registerForm);
  const payload = {
    title: clean(formData.get("title")),
    author: clean(formData.get("author")),
    note: clean(formData.get("note")),
    library: clean(formData.get("library")),
    place: clean(formData.get("place")),
  };

  try {
    const book = state.useLocalFallback ? createLocalBook(payload) : await apiRequest("/api/books", "POST", payload);
    upsertBook(book);
    state.activeCode = book.code;
    updateLabel(book);
    renderLibrary();
    renderBookDetail(book);
    registerForm.reset();
  } catch (error) {
    showMessage(registerForm, error.message);
  }
});

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await lookupBook(clean(document.querySelector("#lookup-code").value).toUpperCase());
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = {
    email: clean(formData.get("email")),
    password: clean(formData.get("password")),
  };

  try {
    const data = state.useLocalFallback ? localLogin(payload) : await apiRequest("/api/auth/login", "POST", payload);
    state.user = data.user;
    loginForm.reset();
    renderAuth();
    showView("register");
  } catch (error) {
    showMessage(loginForm, error.message);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const payload = {
    name: clean(formData.get("name")),
    email: clean(formData.get("email")),
    password: clean(formData.get("password")),
    role: clean(formData.get("role")),
    inviteCode: clean(formData.get("inviteCode")),
    libraryName: clean(formData.get("libraryName")),
  };

  try {
    const data = state.useLocalFallback ? localSignup(payload) : await apiRequest("/api/auth/register", "POST", payload);
    state.user = data.user;
    signupForm.reset();
    renderAuth();
    showView("register");
  } catch (error) {
    showMessage(signupForm, error.message);
  }
});

printButton.addEventListener("click", () => window.print());

copyButton.addEventListener("click", async () => {
  const book = findBook(state.activeCode);
  if (!book) return;
  await navigator.clipboard.writeText(getTrackLink(book.code));
  copyButton.textContent = "Copied";
  setTimeout(() => {
    copyButton.textContent = "Copy tracking link";
  }, 1400);
});

seedButton.addEventListener("click", async () => {
  const existing = await lookupBook("BT-SAMPLE", { quiet: true });
  if (existing) return;

  const sample = {
    code: "BT-SAMPLE",
    title: "The Secret Garden",
    author: "Frances Hodgson Burnett",
    note: "A classic for readers who like a little mystery and a lot of green things growing.",
    createdAt: "2026-03-19T10:30:00.000Z",
    stops: [
      {
        library: "Spruce & 7th Little Library",
        place: "Fort Collins, CO",
        reader: "Maya",
        note: "Registered with a fresh label and a bookmark tucked inside.",
        date: "2026-03-19T10:30:00.000Z",
      },
      {
        library: "Red Door Book Box",
        place: "Longmont, CO",
        reader: "Jon",
        note: "Read it on a rainy weekend. Passing it along for another family.",
        date: "2026-04-08T16:15:00.000Z",
      },
      {
        library: "Sunflower Library",
        place: "Boulder, CO",
        reader: "Ari",
        note: "Found beside the picture books. Left it near the park trail.",
        date: "2026-05-02T12:05:00.000Z",
      },
    ],
  };

  upsertBook(sample);
  state.activeCode = sample.code;
  saveLocalBooks();
  updateLabel(sample);
  renderLibrary();
  renderBookDetail(sample);
  showView("lookup");
});

async function init() {
  try {
    const session = await apiRequest("/api/auth/session");
    state.user = session.user;
  } catch {
    state.useLocalFallback = true;
    state.user = loadLocalUser();
  }

  try {
    state.books = await apiRequest("/api/books");
  } catch (error) {
    state.useLocalFallback = true;
    state.books = loadLocalBooks();
    showGlobalMessage("Using local demo storage. Add Vercel KV environment variables to enable shared production data.");
  }

  renderAuth();
  renderLibrary();
  await openTrackedRecord();
}

async function lookupBook(code, options = {}) {
  if (!code) return null;
  const localBook = findBook(code);

  try {
    const book = state.useLocalFallback ? localBook : await apiRequest(`/api/books?code=${encodeURIComponent(code)}`);
    if (!book) throw new Error("No book was found for that code.");
    upsertBook(book);
    state.activeCode = book.code;
    document.querySelector("#lookup-code").value = book.code;
    renderBookDetail(book);
    showView("lookup");
    return book;
  } catch (error) {
    if (!options.quiet) {
      bookDetail.hidden = false;
      bookDetail.innerHTML = `<div class="panel empty-state">${escapeHtml(error.message)}</div>`;
      showView("lookup");
    }
    return null;
  }
}

function showView(name) {
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === name));
  views.forEach((view) => view.classList.toggle("is-active", view.id === `${name}-view`));
  if (name === "library") renderLibrary();
  if (name === "manage") renderManage();
}

function updateLabel(book) {
  const link = getTrackLink(book.code);
  document.querySelector("#label-book-title").textContent = book.title;
  document.querySelector("#label-book-author").textContent = `by ${book.author}`;
  document.querySelector("#label-code").textContent = book.code;
  document.querySelector("#label-url").textContent = link;
  labelQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}`;
  labelQr.hidden = false;
  printButton.disabled = false;
  copyButton.disabled = false;
}

function renderBookDetail(book) {
  const fragment = detailTemplate.content.cloneNode(true);
  fragment.querySelector("[data-book-title]").textContent = book.title;
  fragment.querySelector("[data-book-meta]").textContent = `by ${book.author}`;
  fragment.querySelector("[data-code]").textContent = book.code;

  const form = fragment.querySelector("[data-checkin-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      code: book.code,
      place: clean(formData.get("place")),
      reader: clean(formData.get("reader")) || "A reader",
      note: clean(formData.get("note")),
    };

    try {
      const updatedBook = state.useLocalFallback ? addLocalStop(book.code, payload) : await apiRequest("/api/checkins", "POST", payload);
      upsertBook(updatedBook);
      renderBookDetail(updatedBook);
      renderLibrary();
    } catch (error) {
      showMessage(form, error.message);
    }
  });

  const timeline = fragment.querySelector("[data-timeline]");
  book.stops.forEach((stop) => {
    const item = document.createElement("li");
    const title = stop.library && stop.library !== stop.place ? `${stop.library}, ${stop.place}` : stop.place;
    item.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(formatDate(stop.date))} by ${escapeHtml(stop.reader || "A reader")}</span>
      ${stop.note ? `<p>${escapeHtml(stop.note)}</p>` : ""}
    `;
    timeline.append(item);
  });

  bookDetail.replaceChildren(fragment);
  bookDetail.hidden = false;
}

function renderLibrary() {
  bookList.replaceChildren();
  if (!state.books.length) {
    bookList.innerHTML = `<div class="empty-state">No books registered yet. Create one on the Register tab.</div>`;
    return;
  }

  state.books.forEach((book) => {
    const card = document.createElement("article");
    card.className = "book-card";
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(book.title)}</h3>
        <p>${escapeHtml(book.author)} · ${book.stops.length} ${book.stops.length === 1 ? "stop" : "stops"} · ${escapeHtml(book.code)}</p>
      </div>
      <button type="button">View trail</button>
    `;
    card.querySelector("button").addEventListener("click", () => lookupBook(book.code));
    bookList.append(card);
  });
}

async function apiRequest(path, method = "GET", body) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The server could not complete that request.");
  return data;
}

function renderAuth() {
  if (state.user) {
    accountChip.textContent = `${state.user.name} · ${state.user.role}`;
    loginForm.hidden = true;
    signupForm.hidden = true;
    profilePanel.hidden = false;
    profilePanel.innerHTML = `
      <div class="profile-actions">
        <div>
          <p class="eyebrow">Signed in</p>
          <h2>${escapeHtml(state.user.name)}</h2>
          <p>${escapeHtml(state.user.email)} · ${escapeHtml(state.user.role)}</p>
        </div>
        <button type="button" id="logout-button">Sign out</button>
      </div>
    `;
    profilePanel.querySelector("#logout-button").addEventListener("click", logout);
  } else {
    accountChip.textContent = "Signed out";
    loginForm.hidden = false;
    signupForm.hidden = false;
    profilePanel.hidden = true;
  }

  const canManage = ["steward", "admin"].includes(state.user?.role);
  manageTab.hidden = !canManage;
}

async function logout() {
  if (!state.useLocalFallback) {
    await apiRequest("/api/auth/logout", "POST", {});
  }
  state.user = null;
  localStorage.removeItem("booktrail.localUser.v1");
  renderAuth();
  showView("account");
}

async function renderManage() {
  if (!["steward", "admin"].includes(state.user?.role)) {
    manageContent.innerHTML = `<div class="empty-state">Sign in as a library steward or admin to manage BookTrail.</div>`;
    return;
  }

  const bookRows = state.books
    .map(
      (book) => `
        <article class="admin-row">
          <div>
            <h3>${escapeHtml(book.title)}</h3>
            <p>${escapeHtml(book.author)} · ${escapeHtml(book.code)} · ${book.stops.length} stops</p>
          </div>
          <button type="button" data-code="${escapeHtml(book.code)}">View trail</button>
        </article>
      `,
    )
    .join("");

  let adminTools = "";
  if (state.user.role === "admin") {
    try {
      const data = state.useLocalFallback ? { users: [state.user] } : await apiRequest("/api/admin/users");
      adminTools = `
        <div class="section-heading">
          <p class="eyebrow">Admin</p>
          <h2>User roles</h2>
        </div>
        <div class="admin-list">
          ${data.users.map(renderUserRow).join("")}
        </div>
      `;
    } catch (error) {
      adminTools = `<div class="status-banner">${escapeHtml(error.message)}</div>`;
    }
  }

  manageContent.innerHTML = `
    <div class="section-heading">
      <p class="eyebrow">${state.user.role === "admin" ? "All books" : "Steward view"}</p>
      <h2>Registered books</h2>
    </div>
    <div class="admin-list">${bookRows || `<div class="empty-state">No books are registered yet.</div>`}</div>
    ${adminTools}
  `;

  manageContent.querySelectorAll("[data-code]").forEach((button) => {
    button.addEventListener("click", () => lookupBook(button.dataset.code));
  });
  manageContent.querySelectorAll("[data-role-user]").forEach((select) => {
    select.addEventListener("change", () => updateUserRole(select.dataset.roleUser, select.value));
  });
}

function renderUserRow(user) {
  return `
    <article class="admin-row">
      <div>
        <h3>${escapeHtml(user.name)}</h3>
        <p>${escapeHtml(user.email)} · joined ${escapeHtml(formatDate(user.createdAt))}</p>
      </div>
      <select data-role-user="${escapeHtml(user.id)}">
        <option value="user" ${user.role === "user" ? "selected" : ""}>User</option>
        <option value="steward" ${user.role === "steward" ? "selected" : ""}>Steward</option>
        <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
      </select>
    </article>
  `;
}

async function updateUserRole(id, role) {
  try {
    await apiRequest("/api/admin/users", "PATCH", { id, role });
    await renderManage();
  } catch (error) {
    showGlobalMessage(error.message);
  }
}

function localSignup(payload) {
  const user = {
    id: "local-user",
    name: payload.name,
    email: payload.email,
    role: payload.role === "admin" || payload.role === "steward" ? payload.role : "user",
    libraryName: payload.libraryName,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem("booktrail.localUser.v1", JSON.stringify(user));
  return { user };
}

function localLogin(payload) {
  const user =
    loadLocalUser() || {
      id: "local-user",
      name: payload.email.split("@")[0] || "Local user",
      email: payload.email,
      role: "admin",
      libraryName: "",
      createdAt: new Date().toISOString(),
    };
  localStorage.setItem("booktrail.localUser.v1", JSON.stringify(user));
  return { user };
}

function loadLocalUser() {
  try {
    return JSON.parse(localStorage.getItem("booktrail.localUser.v1"));
  } catch {
    return null;
  }
}

function createLocalBook(payload) {
  const now = new Date().toISOString();
  const book = {
    code: createCode(),
    title: payload.title,
    author: payload.author,
    note: payload.note,
    createdAt: now,
    stops: [
      {
        place: payload.place,
        library: payload.library,
        reader: "Registered",
        note: "The journey starts here.",
        date: now,
      },
    ],
  };
  upsertBook(book);
  saveLocalBooks();
  return book;
}

function addLocalStop(code, payload) {
  const book = findBook(code);
  if (!book) throw new Error("No book was found for that code.");
  book.stops.unshift({
    place: payload.place,
    library: payload.place,
    reader: payload.reader,
    note: payload.note,
    date: new Date().toISOString(),
  });
  saveLocalBooks();
  return book;
}

function loadLocalBooks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLocalBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.books));
}

function upsertBook(book) {
  const index = state.books.findIndex((item) => item.code === book.code);
  if (index >= 0) {
    state.books[index] = book;
  } else {
    state.books.unshift(book);
  }
}

function findBook(code) {
  return state.books.find((book) => book.code.toUpperCase() === code.toUpperCase());
}

function createCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = `BT-${Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
  } while (findBook(code));
  return code;
}

function getTrackLink(code) {
  return `${location.origin}/track/${encodeURIComponent(code)}`;
}

async function openTrackedRecord() {
  const pathMatch = location.pathname.match(/^\/track\/([^/]+)$/);
  const hashMatch = location.hash.match(/^#track\/(.+)$/);
  const code = pathMatch?.[1] || hashMatch?.[1];
  if (!code) return;
  document.querySelector("#lookup-code").value = decodeURIComponent(code).toUpperCase();
  await lookupBook(decodeURIComponent(code).toUpperCase());
}

function showGlobalMessage(message) {
  const banner = document.createElement("div");
  banner.className = "status-banner";
  banner.textContent = message;
  document.querySelector("main").prepend(banner);
}

function showMessage(container, message) {
  const existing = container.querySelector(".status-banner");
  if (existing) existing.remove();
  const banner = document.createElement("div");
  banner.className = "status-banner";
  banner.textContent = message;
  container.prepend(banner);
}

function clean(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();

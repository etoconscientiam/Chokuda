const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQs9es85_FKgTgEVkNBb2NqcINPWyN6ofxMUYbrLeuFiTD2R49-37t-3TyahkR_PYsgs4wBSknAol0R/pub?gid=0&single=true&output=csv";
let allEvents = [];
let filteredEvents = [];
let map;
const filters = {
  search: "",
  category: "all",
  price: "all"
};

const goingStorageKey = "events-going";
const savedStorageKey = "events-saved";
const goingEvents = loadStoredSet(goingStorageKey);
const savedEvents = loadStoredSet(savedStorageKey);
let toastElement = null;
let toastTimeoutId = null;
let storageSupport = null;

function isStorageAvailable() {
  if (storageSupport !== null) {
    return storageSupport;
  }
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    storageSupport = false;
    return storageSupport;
  }
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    storageSupport = true;
  } catch (error) {
    console.warn("Локальное хранилище недоступно", error);
    storageSupport = false;
  }
  return storageSupport;
}

function loadStoredSet(storageKey) {
  if (!isStorageAvailable()) {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch (error) {
    console.warn("Не удалось прочитать сохраненные данные", storageKey, error);
  }
  return new Set();
}

function persistSet(storageKey, set) {
  if (!isStorageAvailable()) {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...set]));
  } catch (error) {
    console.warn("Не удалось сохранить данные", storageKey, error);
  }
}

async function fetchCsvText(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "Accept": "text/csv, text/plain;q=0.9, */*;q=0.8" }
  });
  if (!response.ok) {
    throw new Error(`CSV request failed with status ${response.status}`);
  }
  const text = await response.text();
  if (!text || !text.trim()) {
    throw new Error("CSV file is empty");
  }
  return text;
}

function parseCsvWithPapa(text) {
  if (typeof Papa === "undefined" || typeof Papa.parse !== "function") {
    return null;
  }
  try {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true
    });
    if (Array.isArray(result.data) && result.data.length) {
      if (result.errors && result.errors.length) {
        console.warn("Papa Parse сообщила об ошибках", result.errors);
      }
      return result.data;
    }
  } catch (error) {
    console.warn("Ошибка Papa Parse", error);
  }
  return null;
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsvManually(text) {
  const rows = [];
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedText.split("\n").filter((line) => line.trim().length);
  if (!lines.length) {
    return rows;
  }
  const headers = splitCsvLine(lines[0]).map((header) => header.replace(/^"|"$/g, "").trim());
  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    const record = {};
    headers.forEach((header, index) => {
      const rawValue = values[index] ?? "";
      record[header] = rawValue.replace(/^"|"$/g, "").replace(/""/g, '"').trim();
    });
    rows.push(record);
  }
  return rows;
}

function normalizeEventsData(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => {
      if (!row) return null;
      const normalized = {};
      Object.keys(row).forEach((key) => {
        const value = row[key];
        normalized[key] = typeof value === "string" ? value.trim() : value;
      });
      if (!normalized.Name) {
        return null;
      }
      if (!normalized.Priority) {
        normalized.Priority = "3";
      }
      return normalized;
    })
    .filter(Boolean);
}

async function loadEventsData() {
  const csvText = await fetchCsvText(csvUrl);
  const parsedWithPapa = parseCsvWithPapa(csvText);
  const rows = parsedWithPapa && parsedWithPapa.length ? parsedWithPapa : parseCsvManually(csvText);
  const normalized = normalizeEventsData(rows);
  if (!normalized.length) {
    throw new Error("CSV parsed successfully but no events were found");
  }
  return normalized;
}

function getEventKey(event) {
  const parts = [event.Name, event.Date, event.Time, event.Place, event.Category]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  if (parts.length) {
    return parts.join("::");
  }
  if (typeof event.__rowNum__ !== "undefined") {
    return `row-${event.__rowNum__}`;
  }
  return JSON.stringify(event);
}

function showToast(message) {
  if (!message) return;
  if (!toastElement) {
    toastElement = document.createElement("div");
    toastElement.className = "toast";
    document.body.appendChild(toastElement);
  }
  toastElement.textContent = message;
  toastElement.classList.add("show");
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => {
    toastElement.classList.remove("show");
  }, 2200);
}

// ---------- МОДАЛКА С АНИМАЦИЕЙ + КНОПКОЙ ----------
function openDetailCard(event) {
  const modal = document.getElementById("event-detail");
  document.getElementById("detail-title").textContent = event.Name || "";
  document.getElementById("detail-date").textContent = event.Date || "";
  document.getElementById("detail-time").textContent = event.Time || "";
  document.getElementById("detail-place").textContent = event.Place || "";
  document.getElementById("detail-category").textContent = event.Category || "";
  document.getElementById("detail-cost").textContent = event.Cost || "";
  document.getElementById("detail-desc").textContent = event.Description || "";

  const detailImage = document.getElementById("detail-img");
  detailImage.src = event.Media || "https://via.placeholder.com/600x400?text=No+Image";
  detailImage.alt = event.Name || "";

  const mapBtn = document.getElementById("detail-map-btn");
  mapBtn.onclick = async () => {
    closeDetailCard();
    document.getElementById("map-modal").style.display = "flex";
    const source = filteredEvents.length ? filteredEvents : allEvents;
    await initMap(source);
    const coords = await getEventCoordinates(event);
    if (coords && map) {
      map.setView([coords.lat, coords.lon], 15, { animate: true });
      L.popup()
        .setLatLng([coords.lat, coords.lon])
        .setContent(`<b>${event.Name}</b><br>${event.Place}<br>${event.Date || ""} ${event.Time || ""}`)
        .openOn(map);
    }
    setTimeout(() => map.invalidateSize(), 300);
  };

  modal.style.display = "flex";
  requestAnimationFrame(() => modal.classList.add("show"));
}

function closeDetailCard() {
  const modal = document.getElementById("event-detail");
  modal.classList.remove("show");
  setTimeout(() => {
    modal.style.display = "none";
  }, 300);
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("close-detail");
  const modal = document.getElementById("event-detail");
  if (closeBtn) closeBtn.onclick = closeDetailCard;
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeDetailCard();
    });
  }
});

// ---------- КАРТОЧКИ ----------
function createCard(event, size = 2) {
  const card = document.createElement("div");
  card.className = "card";
  card.addEventListener("click", () => openDetailCard(event));
  if (size === 1) {
    card.innerHTML = `
      <img src="${event.Media || "https://via.placeholder.com/600x400"}" alt="">
      <div class="overlay">
        <div class="overlay-text">
          <h3>${event.Name}</h3>
          <p>${event.Category || ""}${event.Date ? " • " + event.Date : ""}</p>
        </div>
        <div class="card-actions">
          <button type="button" data-action="going">Пойду</button>
          <button type="button" data-action="save">Сохранить</button>
          <button type="button" data-action="share">Поделиться</button>
        </div>
      </div>`;
  } else {
    card.innerHTML = `
      <img src="${event.Media || "https://via.placeholder.com/300x150"}" alt="">
      <div class="info">
        <div class="info-text">
          <h3>${event.Name}</h3>
          <p>${event.Category || ""}${event.Subcategory ? " / " + event.Subcategory : ""}</p>
          <p>${event.Date || ""}${event.Time ? " • " + event.Time : ""}</p>
          <p class="info-place">${event.Place || ""}</p>
        </div>
        <div class="card-actions">
          <button type="button" data-action="going">Пойду</button>
          <button type="button" data-action="save">Сохранить</button>
          <button type="button" data-action="share">Поделиться</button>
        </div>
      </div>`;
  }
  setupCardActions(card, event);
  return card;
}

function setupCardActions(card, event) {
  const actions = card.querySelector(".card-actions");
  if (!actions) return;

  const eventKey = getEventKey(event);
  const goingButton = actions.querySelector('[data-action="going"]');
  const saveButton = actions.querySelector('[data-action="save"]');
  const shareButton = actions.querySelector('[data-action="share"]');

  const updateButtons = () => {
    if (goingButton) {
      const isGoing = goingEvents.has(eventKey);
      goingButton.textContent = isGoing ? "Я иду" : "Пойду";
      goingButton.classList.toggle("is-active", isGoing);
      goingButton.setAttribute("aria-pressed", String(isGoing));
    }
    if (saveButton) {
      const isSaved = savedEvents.has(eventKey);
      saveButton.textContent = isSaved ? "Сохранено" : "Сохранить";
      saveButton.classList.toggle("is-active", isSaved);
      saveButton.setAttribute("aria-pressed", String(isSaved));
    }
  };

  if (goingButton) {
    goingButton.addEventListener("click", (domEvent) => {
      domEvent.stopPropagation();
      domEvent.preventDefault();
      if (goingEvents.has(eventKey)) {
        goingEvents.delete(eventKey);
        showToast("Убрано из списка «Пойду»");
      } else {
        goingEvents.add(eventKey);
        showToast("Добавлено в список «Пойду»");
      }
      persistSet(goingStorageKey, goingEvents);
      updateButtons();
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", (domEvent) => {
      domEvent.stopPropagation();
      domEvent.preventDefault();
      if (savedEvents.has(eventKey)) {
        savedEvents.delete(eventKey);
        showToast("Событие удалено из сохранённых");
      } else {
        savedEvents.add(eventKey);
        showToast("Событие сохранено");
      }
      persistSet(savedStorageKey, savedEvents);
      updateButtons();
    });
  }

  if (shareButton) {
    shareButton.addEventListener("click", async (domEvent) => {
      domEvent.stopPropagation();
      domEvent.preventDefault();
      const baseUrl = window.location.origin ? `${window.location.origin}${window.location.pathname}` : window.location.href;
      const details = [
        event.Name,
        [event.Date, event.Time].filter(Boolean).join(" • "),
        event.Place
      ].filter(Boolean);
      const shareText = details.join(" — ");
      const fallbackText = `${shareText ? shareText + "\n" : ""}${baseUrl}`.trim();

      if (navigator.share) {
        try {
          await navigator.share({
            title: event.Name || "Событие",
            text: shareText || "Смотри какое событие!",
            url: baseUrl
          });
          showToast("Событием поделились");
          return;
        } catch (error) {
          if (error && error.name === "AbortError") {
            return;
          }
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(fallbackText);
          showToast("Ссылка скопирована");
        } catch (error) {
          console.warn("Clipboard API error", error);
          showToast("Не удалось скопировать ссылку");
        }
      } else {
        window.prompt("Скопируйте ссылку на событие", fallbackText);
      }
    });
  }

  if (shareButton) {
    shareButton.setAttribute("aria-label", "Поделиться событием");
  }

  updateButtons();
}

function renderAll(events) {
  const p1 = document.getElementById("priority1");
  const p2 = document.getElementById("priority2");
  const p3 = document.querySelector("#priority3 tbody");
  if (!p1 || !p2 || !p3) return;

  p1.innerHTML = "";
  p2.innerHTML = "";
  p3.innerHTML = "";

  events.forEach((event) => {
    const priority = Number(event.Priority) || 3;
    if (priority === 1) {
      p1.appendChild(createCard(event, 1));
    } else if (priority === 2) {
      p2.appendChild(createCard(event, 2));
    } else {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${event.Name}</td><td>${event.Category || ""}</td><td>${event.Date || ""}</td><td>${event.Time || ""}</td><td>${event.Place || ""}</td><td>${event.Cost || ""}</td>`;
      tr.onclick = () => openDetailCard(event);
      p3.appendChild(tr);
    }
  });

  if (!p1.children.length) {
    p1.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Нет событий в этом разделе.</p>';
  }

  if (!p2.children.length) {
    p2.innerHTML = '<p style="margin:0;color:#666;text-align:center;">События для рекомендации отсутствуют.</p>';
  }

  if (!p3.children.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = '<td colspan="6" style="text-align:center;padding:24px;color:#666;">Ничего не найдено. Попробуйте изменить фильтры.</td>';
    p3.appendChild(emptyRow);
  }
}

function isFreeEvent(cost) {
  if (!cost) return true;
  const normalized = String(cost).toLowerCase();
  if (!normalized.trim()) return true;
  if (normalized.includes("беспл") || normalized.includes("free") || normalized.includes("donation")) {
    return true;
  }
  const digits = normalized.replace(/[^0-9]/g, "");
  if (!digits) return true;
  return Number(digits) === 0;
}

function applyFilters() {
  if (!allEvents.length) {
    filteredEvents = [];
    renderAll(filteredEvents);
    return;
  }
  const searchTerm = filters.search.trim().toLowerCase();
  filteredEvents = allEvents.filter((event) => {
    const categoryValue = (event.Category || "").toLowerCase();
    const combinedText = [event.Name, event.Place, event.Description, event.Category, event.Subcategory]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchTerm || combinedText.includes(searchTerm);
    const matchesCategory = filters.category === "all" || categoryValue === filters.category;
    const matchesPrice = filters.price === "all" || (filters.price === "free" ? isFreeEvent(event.Cost) : !isFreeEvent(event.Cost));

    return matchesSearch && matchesCategory && matchesPrice;
  });

  renderAll(filteredEvents);

  const mapModal = document.getElementById("map-modal");
  if (mapModal && mapModal.style.display === "flex") {
    const source = filteredEvents.length ? filteredEvents : allEvents;
    initMap(source);
    setTimeout(() => map && map.invalidateSize(), 200);
  }
}

function setupFilters(events) {
  const searchInput = document.getElementById("filter-search");
  const categorySelect = document.getElementById("filter-category");
  const priceSelect = document.getElementById("filter-price");
  const resetButton = document.getElementById("filter-reset");

  if (!searchInput || !categorySelect || !priceSelect || !resetButton) return;

  const categories = Array.from(new Set(events
    .map((event) => (event.Category || "").trim())
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.toLowerCase();
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  searchInput.addEventListener("input", (event) => {
    filters.search = event.target.value;
    applyFilters();
  });

  categorySelect.addEventListener("change", (event) => {
    filters.category = event.target.value;
    applyFilters();
  });

  priceSelect.addEventListener("change", (event) => {
    filters.price = event.target.value;
    applyFilters();
  });

  resetButton.addEventListener("click", () => {
    filters.search = "";
    filters.category = "all";
    filters.price = "all";
    searchInput.value = "";
    categorySelect.value = "all";
    priceSelect.value = "all";
    applyFilters();
  });
}

// ---------- ГЕОПАРСЕР ----------
function parseCoordinatesFromText(text) {
  if (!text) return null;
  const regex = /(-?\d{1,2}\.\d+)[, ]+(-?\d{1,3}\.\d+)/;
  const match = text.match(regex);
  if (match) return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
  return null;
}

async function geocodeAddress(address) {
  if (!address) return null;
  const cacheKey = `geo_${address}`;
  const storageEnabled = isStorageAvailable();
  if (storageEnabled) {
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (error) {
      console.warn("Не удалось прочитать кэш геокодера", error);
    }
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  try {
    const response = await fetch(url, { headers: { 'Accept-Language': 'ru' } });
    if (!response.ok) return null;
    const data = await response.json();
    if (data[0]) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      if (storageEnabled) {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(coords));
        } catch (error) {
          console.warn("Не удалось сохранить координаты в кэш", error);
        }
      }
      return coords;
    }
  } catch (error) {
    console.warn("Не удалось геокодировать адрес", address, error);
  }
  return null;
}

async function getEventCoordinates(event) {
  if (event.Lat && event.Lon) {
    return { lat: parseFloat(event.Lat), lon: parseFloat(event.Lon) };
  }
  const parsed = parseCoordinatesFromText(event.Place);
  if (parsed) return parsed;
  return geocodeAddress(event.Place);
}

// ---------- КАРТА ----------
async function initMap(events) {
  if (!map) {
    map = L.map('map').setView([59.93, 30.33], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
  }

  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  for (const event of events) {
    if (!event.Place) continue;
    const coords = await getEventCoordinates(event);
    if (coords) {
      const marker = L.marker([coords.lat, coords.lon]).addTo(map);
      marker.on("click", () => openDetailCard(event));
    }
  }
}

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
document.addEventListener("DOMContentLoaded", () => {
  const openMap = document.getElementById("open-map");
  const closeMap = document.getElementById("close-map");

  if (openMap && closeMap) {
    openMap.onclick = async (event) => {
      event.preventDefault();
      document.getElementById("map-modal").style.display = "flex";
      const source = filteredEvents.length ? filteredEvents : allEvents;
      await initMap(source);
      setTimeout(() => map && map.invalidateSize(), 300);
    };

    closeMap.onclick = () => {
      document.getElementById("map-modal").style.display = "none";
    };
  }

  initializeEvents();
});

function showLoadingError(message) {
  const fallbackMessage = message || "Не удалось загрузить события. Попробуйте обновить страницу позже.";
  const priorityOne = document.getElementById("priority1");
  const priorityTwo = document.getElementById("priority2");
  const tableBody = document.querySelector("#priority3 tbody");
  if (priorityOne) {
    priorityOne.innerHTML = `<p style="margin:0;color:#666;text-align:center;">${fallbackMessage}</p>`;
  }
  if (priorityTwo) {
    priorityTwo.innerHTML = `<p style="margin:0;color:#666;text-align:center;">${fallbackMessage}</p>`;
  }
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#666;">${fallbackMessage}</td></tr>`;
  }
}

async function initializeEvents() {
  try {
    const events = await loadEventsData();
    allEvents = events;
    filteredEvents = [...allEvents];
    setupFilters(allEvents);
    renderAll(filteredEvents);
  } catch (error) {
    console.error("Не удалось загрузить список событий", error);
    allEvents = [];
    filteredEvents = [];
    showLoadingError();
  }
}

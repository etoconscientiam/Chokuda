const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQs9es85_FKgTgEVkNBb2NqcINPWyN6ofxMUYbrLeuFiTD2R49-37t-3TyahkR_PYsgs4wBSknAol0R/pub?gid=0&single=true&output=csv";
let allEvents = [];
let filteredEvents = [];
let map;
const filters = {
  search: "",
  category: "all",
  price: "all"
};

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
  card.onclick = () => openDetailCard(event);
  if (size === 1) {
    card.innerHTML = `
      <img src="${event.Media || "https://via.placeholder.com/600x400"}" alt="">
      <div class="overlay">
        <h3>${event.Name}</h3>
        <p>${event.Category || ""} • ${event.Date || ""}</p>
      </div>`;
  } else {
    card.innerHTML = `
      <img src="${event.Media || "https://via.placeholder.com/300x150"}" alt="">
      <div class="info">
        <div>
          <h3>${event.Name}</h3>
          <p>${event.Category || ""}${event.Subcategory ? " / " + event.Subcategory : ""}</p>
          <p>${event.Date || ""}${event.Time ? " • " + event.Time : ""}</p>
        </div>
        <p style="font-weight:500;color:#007aff;">${event.Place || ""}</p>
      </div>`;
  }
  return card;
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
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  try {
    const response = await fetch(url, { headers: { 'Accept-Language': 'ru' } });
    if (!response.ok) return null;
    const data = await response.json();
    if (data[0]) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      localStorage.setItem(cacheKey, JSON.stringify(coords));
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

  Papa.parse(csvUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      allEvents = (results.data || []).filter((event) => event.Name);
      setupFilters(allEvents);
      filteredEvents = [...allEvents];
      renderAll(filteredEvents);
    },
    error: () => {
      const tableBody = document.querySelector("#priority3 tbody");
      if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6">Не удалось загрузить события. Попробуйте обновить страницу позже.</td></tr>';
      }
    }
  });
});

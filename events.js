const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQs9es85_FKgTgEVkNBb2NqcINPWyN6ofxMUYbrLeuFiTD2R49-37t-3TyahkR_PYsgs4wBSknAol0R/pub?gid=0&single=true&output=csv";
let allEvents = [];
let map;

// ---------- МОДАЛКА С АНИМАЦИЕЙ + КНОПКОЙ ----------
function openDetailCard(e) {
  const modal = document.getElementById("event-detail");
  document.getElementById("detail-title").textContent = e.Name || "";
  document.getElementById("detail-date").textContent = e.Date || "";
  document.getElementById("detail-time").textContent = e.Time || "";
  document.getElementById("detail-place").textContent = e.Place || "";
  document.getElementById("detail-category").textContent = e.Category || "";
  document.getElementById("detail-cost").textContent = e.Cost || "";
  document.getElementById("detail-desc").textContent = e.Description || "";
  document.getElementById("detail-img").src = e.Media || "https://via.placeholder.com/600x400?text=No+Image";

  const mapBtn = document.getElementById("detail-map-btn");
  mapBtn.onclick = async () => {
    closeDetailCard();
    document.getElementById("map-modal").style.display = "flex";
    await initMap(allEvents);
    const coords = await getEventCoordinates(e);
    if (coords && map) {
      map.setView([coords.lat, coords.lon], 15, { animate: true });
      L.popup()
        .setLatLng([coords.lat, coords.lon])
        .setContent(`<b>${e.Name}</b><br>${e.Place}<br>${e.Date || ""} ${e.Time || ""}`)
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
  setTimeout(() => { modal.style.display = "none"; }, 300);
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("close-detail");
  const modal = document.getElementById("event-detail");
  if (closeBtn) closeBtn.onclick = closeDetailCard;
  if (modal) modal.addEventListener("click", (e) => {
    if (e.target === modal) closeDetailCard();
  });
});

// ---------- КАРТОЧКИ ----------
function createCard(e, size = 2) {
  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openDetailCard(e);
  if (size === 1) {
    card.innerHTML = `
      <img src="${e.Media || "https://via.placeholder.com/600x400"}" alt="">
      <div class="overlay">
        <h3>${e.Name}</h3>
        <p>${e.Category || ""} • ${e.Date || ""}</p>
      </div>`;
  } else {
    card.innerHTML = `
      <img src="${e.Media || "https://via.placeholder.com/300x150"}" alt="">
      <div class="info">
        <div>
          <h3>${e.Name}</h3>
          <p>${e.Category || ""}${e.Subcategory ? " / " + e.Subcategory : ""}</p>
          <p>${e.Date || ""}${e.Time ? " • " + e.Time : ""}</p>
        </div>
        <p style="font-weight:500;color:#007aff;">${e.Place || ""}</p>
      </div>`;
  }
  return card;
}

function renderAll(events) {
  const p1 = document.getElementById("priority1");
  const p2 = document.getElementById("priority2");
  const p3 = document.querySelector("#priority3 tbody");
  p1.innerHTML = "";
  p2.innerHTML = "";
  p3.innerHTML = "";
  events.forEach(e => {
    const p = parseInt(e.Priority || 3);
    if (p === 1) p1.appendChild(createCard(e, 1));
    else if (p === 2) p2.appendChild(createCard(e, 2));
    else {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${e.Name}</td><td>${e.Category || ""}</td><td>${e.Date || ""}</td><td>${e.Time || ""}</td><td>${e.Place || ""}</td><td>${e.Cost || ""}</td>`;
      tr.onclick = () => openDetailCard(e);
      p3.appendChild(tr);
    }
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
  const cacheKey = `geo_${address}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data[0]) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      localStorage.setItem(cacheKey, JSON.stringify(coords));
      return coords;
    }
  } catch {}
  return null;
}

async function getEventCoordinates(e) {
  if (e.Lat && e.Lon) return { lat: parseFloat(e.Lat), lon: parseFloat(e.Lon) };
  const coords = parseCoordinatesFromText(e.Place);
  if (coords) return coords;
  return await geocodeAddress(e.Place);
}

// ---------- КАРТА ----------
async function initMap(events) {
  if (!map) {
    map = L.map('map').setView([59.93, 30.33], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
  }
  map.eachLayer(l => { if (l instanceof L.Marker) map.removeLayer(l); });
  for (const e of events) {
    if (!e.Place) continue;
    const coords = await getEventCoordinates(e);
    if (coords) {
      const marker = L.marker([coords.lat, coords.lon]).addTo(map);
      marker.on("click", () => openDetailCard(e));
    }
  }
}

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
document.addEventListener("DOMContentLoaded", () => {
  const openMap = document.getElementById("open-map");
  const closeMap = document.getElementById("close-map");
  if (openMap && closeMap) {
    openMap.onclick = async (e) => {
      e.preventDefault();
      document.getElementById("map-modal").style.display = "flex";
      await initMap(allEvents);
      setTimeout(() => map.invalidateSize(), 300);
    };
    closeMap.onclick = () => {
      document.getElementById("map-modal").style.display = "none";
    };
  }

  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: (results) => {
      allEvents = results.data.filter(e => e.Name);
      renderAll(allEvents);
    }
  });
});

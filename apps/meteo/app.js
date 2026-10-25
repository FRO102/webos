let currentCity = { name: "Lisboa", lat: 38.7167, lon: -9.1333 };
let favorites = [];

function getWeatherDescription(code) {
  const codes = {
    0: "Céu limpo",
    1: "Principalmente limpo",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Nevoeiro",
    48: "Nevoeiro com geada",
    51: "Chuvisco leve",
    53: "Chuvisco moderado",
    55: "Chuvisco denso",
    61: "Chuva fraca",
    63: "Chuva moderada",
    65: "Chuva forte",
    71: "Neve fraca",
    95: "Trovoada"
  };
  return os.i18n.t(codes[code] || "Desconhecido");
}

async function loadFavorites() {
  try {
    const saved = await os.storage.get("favorites");
    if (saved && Array.isArray(saved)) {
      favorites = saved;
    } else {
      favorites = [
        { name: "Lisboa", lat: 38.7167, lon: -9.1333 },
        { name: "Porto", lat: 41.1496, lon: -8.6109 },
        { name: "Coimbra", lat: 40.2033, lon: -8.4103 }
      ];
    }
    renderFavorites();
  } catch (e) {
    console.error("Erro ao carregar favoritos", e);
  }
}

async function saveFavorites() {
  try {
    await os.storage.set("favorites", favorites);
  } catch (e) {
    console.error("Erro ao guardar favoritos", e);
  }
}

function renderFavorites() {
  const container = document.getElementById("favorites-container");
  container.innerHTML = "";
  favorites.forEach(fav => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = fav.name;
    chip.onclick = () => selectCity(fav);
    container.appendChild(chip);
  });
}

async function fetchWeather(lat, lon, name) {
  try {
    os.ui.status(null, "A carregar meteorologia...", "loading");
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
    const data = await res.json();

    document.getElementById("location-name").textContent = name;
    document.getElementById("current-temp").textContent = `${Math.round(data.current.temperature_2m)}°C`;
    document.getElementById("current-desc").textContent = getWeatherDescription(data.current.weather_code);

    const grid = document.getElementById("forecast-grid");
    grid.innerHTML = "";
    
    for (let i = 0; i < data.daily.time.length; i++) {
      const dateStr = data.daily.time[i];
      const dateObj = new Date(dateStr);
      const dayName = dateObj.toLocaleDateString(os.i18n.locale, { weekday: 'short' });
      const max = Math.round(data.daily.temperature_2m_max[i]);
      const min = Math.round(data.daily.temperature_2m_min[i]);
      const code = data.daily.weather_code[i];

      const card = document.createElement("div");
      card.className = "forecast-card";
      card.innerHTML = `
        <div style="font-weight: bold; text-transform: capitalize;">${dayName}</div>
        <div style="font-size: 0.8rem; margin: 4px 0; color: var(--os-muted);">${getWeatherDescription(code)}</div>
        <div><strong>${max}°</strong> / ${min}°</div>
      `;
      grid.appendChild(card);
    }
    os.ui.status(null, "", "success");
  } catch (error) {
    os.notify("Erro ao obter dados meteorológicos.");
    console.error(error);
  }
}

async function searchCity(query) {
  if (!query) return;
  try {
    os.ui.status(null, "A pesquisar cidade...", "loading");
    const language = os.i18n.language === 'en' ? 'en' : 'pt';
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=${language}&format=json`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const loc = data.results[0];
      currentCity = { name: loc.name, lat: loc.latitude, lon: loc.longitude };
      fetchWeather(currentCity.lat, currentCity.lon, currentCity.name);
    } else {
      os.notify("Cidade não encontrada.");
      os.ui.status(null, "", "error");
    }
  } catch (err) {
    os.notify("Erro na pesquisa.");
    console.error(err);
  }
}

function selectCity(city) {
  currentCity = city;
  fetchWeather(city.lat, city.lon, city.name);
}

document.getElementById("search-btn").onclick = () => {
  const query = document.getElementById("search-input").value.trim();
  searchCity(query);
};

document.getElementById("search-input").onkeypress = (e) => {
  if (e.key === "Enter") {
    searchCity(e.target.value.trim());
  }
};

document.getElementById("fav-btn").onclick = () => {
  if (!favorites.some(f => f.name === currentCity.name)) {
    favorites.push(currentCity);
    saveFavorites();
    renderFavorites();
    os.notify(os.i18n.t('Adicionado {city} aos favoritos.').replace('{city}', currentCity.name));
  } else {
    os.notify("Esta cidade já está nos favoritos.");
  }
};

os.i18n.onChange(() => fetchWeather(currentCity.lat, currentCity.lon, currentCity.name));

(async () => {
  await loadFavorites();
  fetchWeather(currentCity.lat, currentCity.lon, currentCity.name);
})();
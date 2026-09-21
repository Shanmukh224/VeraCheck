module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  let lat = req.query ? req.query.lat : null;
  let lon = req.query ? req.query.lon : null;

  // If no lat/lon query params, check body or headers
  if (!lat || !lon) {
    if (req.body && req.body.lat && req.body.lon) {
      lat = req.body.lat;
      lon = req.body.lon;
    }
  }

  // Fallback to approximate IP geolocation if no coordinates provided
  let cityName = "Your Location";
  if (!lat || !lon) {
    try {
      const ipRes = await fetch("https://ipapi.co/json/");
      const ipData = await ipRes.json();
      if (ipData && ipData.latitude && ipData.longitude) {
        lat = ipData.latitude;
        lon = ipData.longitude;
        cityName = ipData.city || ipData.region || "Local Area";
      }
    } catch (e) {
      // Default to New York coordinates if IP lookup fails
      lat = 40.7128;
      lon = -74.0060;
      cityName = "New York";
    }
  }

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&timezone=auto`;
    const response = await fetch(weatherUrl);
    const data = await response.json();
    const current = data.current || {};

    const temp = current.temperature_2m !== undefined ? Math.round(current.temperature_2m) : 22;
    const isDay = current.is_day === 1;
    const code = current.weather_code !== undefined ? current.weather_code : 0;

    // Map WMO Code to Theme Visual State
    let weatherState = 'sunny';
    let conditionLabel = 'Clear';
    let icon = '☀️';

    if (code === 0 || code === 1) {
      if (isDay) {
        weatherState = 'sunny'; conditionLabel = 'Sunny & Clear'; icon = '☀️';
      } else {
        weatherState = 'clear-night'; conditionLabel = 'Clear Night'; icon = '🌙';
      }
    } else if (code === 2 || code === 3) {
      if (isDay) {
        weatherState = 'cloudy'; conditionLabel = 'Partly Cloudy'; icon = '⛅';
      } else {
        weatherState = 'cloudy-night'; conditionLabel = 'Cloudy Night'; icon = '☁️';
      }
    } else if (code === 45 || code === 48) {
      weatherState = 'foggy'; conditionLabel = 'Foggy / Mist'; icon = '🌫️';
    } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      weatherState = 'rainy'; conditionLabel = 'Rainy Showers'; icon = '🌧️';
    } else if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
      weatherState = 'snowy'; conditionLabel = 'Snow Falling'; icon = '❄️';
    } else if (code >= 95 && code <= 99) {
      weatherState = 'stormy'; conditionLabel = 'Thunderstorm'; icon = '⛈️';
    } else {
      weatherState = isDay ? 'sunny' : 'clear-night';
      conditionLabel = isDay ? 'Clear' : 'Clear Night';
      icon = isDay ? '☀️' : '🌙';
    }

    // Try reverse geocoding if cityName not determined yet
    if (cityName === "Your Location" || cityName === "Local Area") {
      try {
        const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        const geoData = await geoRes.json();
        cityName = geoData.city || geoData.locality || geoData.principalSubdivision || cityName;
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      temp,
      isDay,
      weatherCode: code,
      weatherState,
      conditionLabel,
      icon,
      cityName,
      coordinates: { lat, lon }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch weather data" });
  }
};

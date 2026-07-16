/*
 * Online lookups (free, no API key):
 *   - Address autocomplete via Photon / OpenStreetMap  (port of address_lookup.py)
 *   - Sunrise / sunset via Open-Meteo (returns local time, handles DST)
 * Plus shared role normalization (port of import_contacts.normalize_role).
 *
 * Exposes window.CallSheetLookups.
 */
(function () {
  "use strict";

  const PHOTON_API = "https://photon.komoot.io/api/";
  const OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast";

  // ---------- Role normalization (shared with importer) ----------
  const UPPERCASE_ROLES = {
    "dp": "DP", "director of photography": "DP",
    "pa": "PA", "production assistant": "PA",
    "hmu": "HMU", "hair & makeup": "HMU", "hair and makeup": "HMU",
    "ac": "AC", "1st ac": "1st AC", "2nd ac": "2nd AC",
    "ep": "EP", "executive producer": "EP",
    "g&e": "G&E",
  };

  function titleCase(s) {
    return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  }

  function normalizeRole(raw) {
    const key = (raw || "").trim().toLowerCase();
    if (UPPERCASE_ROLES[key]) return UPPERCASE_ROLES[key];
    return titleCase((raw || "").trim());
  }

  // ---------- Address autocomplete ----------
  async function lookupAddress(query, limit) {
    limit = limit || 5;
    const url = `${PHOTON_API}?q=${encodeURIComponent(query)}&limit=${limit}`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`Photon request failed (${resp.status})`);
    const data = await resp.json();
    const results = (data.features || []).map((feature) => {
      const props = feature.properties || {};
      const coords = (feature.geometry && feature.geometry.coordinates) || [null, null];

      const name = props.name || "";
      const houseNumber = props.housenumber || "";
      const street = props.street || "";
      const city = props.city || props.locality || "";
      const state = props.state || "";
      const postcode = props.postcode || "";
      const country = props.country || "";

      let addressLine1 = "";
      if (houseNumber && street) addressLine1 = `${houseNumber} ${street}`;
      else if (street) addressLine1 = street;
      else if (name) addressLine1 = name;

      const cityState = [city, state].filter(Boolean).join(", ");
      const cityStateZip = postcode ? `${cityState} ${postcode}`.trim() : cityState;

      const fullAddress = [addressLine1, cityStateZip, country].filter(Boolean).join(", ");
      const mapsQuery = fullAddress || query;
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

      return {
        name,
        address_line_1: addressLine1,
        address_line_2: "",
        city_state_zip: cityStateZip,
        full_address: fullAddress,
        lat: coords.length > 1 ? coords[1] : null,
        lon: coords.length > 0 ? coords[0] : null,
        maps_url: mapsUrl,
      };
    });
    return { query, results };
  }

  // ---------- Sunrise / sunset ----------
  function formatTime(iso) {
    // iso like "2026-02-06T07:25"
    const m = iso.match(/T(\d{2}):(\d{2})/);
    if (!m) return "";
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${min} ${ampm}`;
  }

  async function lookupSun(lat, lon, dateISO) {
    if (lat == null || lon == null) throw new Error("Coordinates required for sunrise/sunset lookup");
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily: "sunrise,sunset",
      timezone: "auto",
      start_date: dateISO,
      end_date: dateISO,
    });
    const resp = await fetch(`${OPEN_METEO_API}?${params.toString()}`);
    if (!resp.ok) throw new Error(`Open-Meteo request failed (${resp.status})`);
    const data = await resp.json();
    const daily = data.daily || {};
    const sr = (daily.sunrise || [])[0];
    const ss = (daily.sunset || [])[0];
    if (!sr || !ss) throw new Error("No sunrise/sunset data for that date");
    return {
      sunrise: formatTime(sr),
      sunset: formatTime(ss),
      timezone: data.timezone || "",
      date: dateISO,
    };
  }

  window.CallSheetLookups = {
    normalizeRole, lookupAddress, lookupSun, formatTime,
  };
})();

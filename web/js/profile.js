/*
 * Local profile store — browser port of scripts/profile.py.
 * Persists the user's recurring data (crew roster, clients, notes block,
 * preferences) in localStorage. Never leaves the browser.
 *
 * Exposes window.CallSheetProfile.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "callsheet.profile.v1";

  function emptyProfile() {
    return {
      crew: [],
      clients: [],
      notes_block: [
        "Confidentiality: this call sheet and all on-set content are confidential. Do not share externally.",
        "Social media: NO posts, photos, or video from set without Producer approval.",
        "Closed set: no visitors without prior approval from Producer.",
        "Health & safety: dial 911 in any emergency. Nearest hospital listed above.",
        "Respect the location: no smoking/vaping inside, follow all venue rules, leave it cleaner than we found it.",
        "Sustainability: bring a reusable water bottle. Follow local laws for sorting refuse.",
      ],
      preferences: [],
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyProfile();
      const data = JSON.parse(raw);
      const base = emptyProfile();
      return Object.assign(base, data);
    } catch (e) {
      return emptyProfile();
    }
  }

  function write(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function exists() {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  function reset() {
    write(emptyProfile());
    return read();
  }

  function addCrew(entry) {
    const data = read();
    const key = (entry.role || "").toLowerCase() + "|" + (entry.name || "").toLowerCase();
    const idx = data.crew.findIndex(
      (c) => (c.role || "").toLowerCase() + "|" + (c.name || "").toLowerCase() === key
    );
    if (idx >= 0) data.crew[idx] = Object.assign({}, data.crew[idx], entry);
    else data.crew.push(entry);
    write(data);
    return data;
  }

  function removeCrew(role, name) {
    const data = read();
    const key = (role || "").toLowerCase() + "|" + (name || "").toLowerCase();
    data.crew = data.crew.filter(
      (c) => (c.role || "").toLowerCase() + "|" + (c.name || "").toLowerCase() !== key
    );
    write(data);
    return data;
  }

  function addClient(entry) {
    const data = read();
    const name = (entry.name || "").toLowerCase();
    const existing = data.clients.find((c) => (c.name || "").toLowerCase() === name);
    if (existing) {
      const seen = new Set(
        (existing.contacts || []).map((x) => (x.name || "").toLowerCase() + "|" + (x.role || "").toLowerCase())
      );
      (entry.contacts || []).forEach((x) => {
        const k = (x.name || "").toLowerCase() + "|" + (x.role || "").toLowerCase();
        if (!seen.has(k)) existing.contacts.push(x);
      });
    } else {
      data.clients.push(entry);
    }
    write(data);
    return data;
  }

  function addPreference(text) {
    text = (text || "").trim();
    if (!text) return read();
    const data = read();
    if (!data.preferences.includes(text)) data.preferences.push(text);
    write(data);
    return data;
  }

  function removePreference(text) {
    const data = read();
    data.preferences = (data.preferences || []).filter((p) => p !== text);
    write(data);
    return data;
  }

  function setNotesBlock(notes) {
    const data = read();
    data.notes_block = notes;
    write(data);
    return data;
  }

  function exportJson() {
    return JSON.stringify(read(), null, 2);
  }

  function importJson(json) {
    const data = JSON.parse(json);
    const base = emptyProfile();
    write(Object.assign(base, data));
    return read();
  }

  window.CallSheetProfile = {
    STORAGE_KEY, emptyProfile, read, write, exists, reset,
    addCrew, removeCrew, addClient, addPreference, removePreference,
    setNotesBlock, exportJson, importJson,
  };
})();

/*
 * App controller for the Create Call Sheet web app.
 * Renders the guided form, reads it into the `answers` schema, and drives
 * lookups, roster, import and .xlsx generation — all client-side.
 */
(function () {
  "use strict";

  const Profile = window.CallSheetProfile;
  const Lookups = window.CallSheetLookups;
  const Importer = window.CallSheetImporter;
  const Builder = window.CallSheetBuilder;

  const DEPARTMENTS = [
    "PRODUCTION", "CAMERA", "G&E", "SOUND", "ART", "VANITIES",
    "SUPPORT", "CLIENT", "AGENCY", "TALENT / INTERVIEWEES", "VENDORS",
  ];

  const MEALS = ["Breakfast", "Lunch", "Dinner", "Crafty / Snacks", "Water / Coffee"];

  const WARDROBE_DEFAULTS = {
    recommended: "Solid colors that aren't pure white/black. Bring 2-3 options. Neutral, comfortable fit. Layers if outdoors.",
    avoid: "Tight patterns. Visible logos/branding. Pure white/black shirts. Loud jewelry. Strong fragrance.",
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const val = (id) => (document.getElementById(id) || {}).value || "";
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v == null ? "" : v; };

  function mealKey(label) {
    return label.toLowerCase().replace(/ \/ /g, "_").replace(/ /g, "_");
  }

  function status(msg, kind) {
    const el = $("#status");
    el.textContent = msg || "";
    el.className = "status" + (kind ? " " + kind : "");
  }

  // ---------- Day rendering ----------
  function addDay(data) {
    data = data || {};
    const container = $("#days-container");
    const tpl = $("#tpl-day").content.cloneNode(true);
    const fs = tpl.querySelector(".day-fieldset");
    container.appendChild(tpl);
    renumberDays();

    // populate fields
    $$("[data-f]", fs).forEach((input) => {
      if (input.closest("tbody")) return; // table rows handled separately
      const path = input.dataset.f;
      const v = getPath(data, path);
      if (v != null) input.value = v;
    });

    // tables
    (data.on_site_contacts || []).forEach((c) => addOnsiteRow(fs, c));
    (data.schedule || []).forEach((s) => addScheduleRow(fs, s));
    if (!(data.on_site_contacts || []).length) { addOnsiteRow(fs); addOnsiteRow(fs); }
    if (!(data.schedule || []).length) addScheduleRow(fs);

    wireDay(fs);
    return fs;
  }

  function renumberDays() {
    $$(".day-fieldset").forEach((fs, i) => {
      const num = fs.querySelector(".day-num");
      if (num) num.textContent = i + 1;
      const removeBtn = fs.querySelector(".day-remove");
      if (removeBtn) removeBtn.style.display = $$(".day-fieldset").length > 1 ? "" : "none";
    });
  }

  function addOnsiteRow(fs, data) {
    data = data || {};
    const body = fs.querySelector(".onsite-body");
    const row = $("#tpl-onsite-row").content.cloneNode(true);
    $$("[data-f]", row).forEach((i) => { i.value = data[i.dataset.f] || ""; });
    row.querySelector(".row-remove").addEventListener("click", (e) => e.target.closest("tr").remove());
    body.appendChild(row);
  }

  function addScheduleRow(fs, data) {
    data = data || {};
    const body = fs.querySelector(".schedule-body");
    const row = $("#tpl-schedule-row").content.cloneNode(true);
    $$("[data-f]", row).forEach((i) => { i.value = data[i.dataset.f] || ""; });
    row.querySelector(".row-remove").addEventListener("click", (e) => e.target.closest("tr").remove());
    body.appendChild(row);
  }

  const SKELETON = [
    { time: "8:00 AM", activity: "Crew arrives, load in" },
    { time: "8:30 AM", activity: "Set up" },
    { time: "10:00 AM", activity: "Interview 1" },
    { time: "11:00 AM", activity: "Interview 2" },
    { time: "12:00 PM", activity: "Lunch" },
    { time: "1:00 PM", activity: "Interview 3" },
    { time: "2:30 PM", activity: "B-roll" },
    { time: "5:00 PM", activity: "Wrap, break down, load out" },
  ];

  function wireDay(fs) {
    fs.querySelector(".day-remove").addEventListener("click", () => {
      if ($$(".day-fieldset").length <= 1) return;
      fs.remove();
      renumberDays();
    });
    fs.querySelector(".onsite-add").addEventListener("click", () => addOnsiteRow(fs));
    fs.querySelector(".schedule-add").addEventListener("click", () => addScheduleRow(fs));
    fs.querySelector(".schedule-skeleton").addEventListener("click", () => {
      SKELETON.forEach((s) => addScheduleRow(fs, s));
    });

    // Address lookup
    wireLookup(fs, ".addr-search", ".addr-go", ".addr-results", (r) => {
      setDayField(fs, "location.address_line_1", r.address_line_1);
      setDayField(fs, "location.address_line_2", r.address_line_2);
      setDayField(fs, "location.city_state_zip", r.city_state_zip);
      fs._locLat = r.lat; fs._locLon = r.lon;
    }, "");
    wireLookup(fs, ".hosp-search", ".hosp-go", ".hosp-results", (r) => {
      setDayField(fs, "hospital.name", r.name || r.address_line_1);
      setDayField(fs, "hospital.address", [r.address_line_1, r.city_state_zip].filter(Boolean).join(", "));
    }, "hospital ");

    // Sunrise/sunset
    fs.querySelector(".sun-lookup").addEventListener("click", async () => {
      const dateIso = getDayField(fs, "_date_iso");
      let lat = fs._locLat, lon = fs._locLon;
      if (!dateIso) { status("Set the shoot date first (date picker).", "err"); return; }
      try {
        if (lat == null || lon == null) {
          const city = getDayField(fs, "city_for_lookup");
          if (!city) { status("Set a city or search a location first.", "err"); return; }
          status("Looking up city…");
          const res = await Lookups.lookupAddress(city, 1);
          if (!res.results.length) { status("City not found.", "err"); return; }
          lat = res.results[0].lat; lon = res.results[0].lon;
          fs._locLat = lat; fs._locLon = lon;
        }
        status("Looking up sunrise/sunset…");
        const sun = await Lookups.lookupSun(lat, lon, dateIso);
        setDayField(fs, "sunrise", sun.sunrise);
        setDayField(fs, "sunset", sun.sunset);
        status("Sunrise/sunset filled in.", "ok");
      } catch (e) {
        status("Lookup failed: " + e.message + " — enter manually.", "err");
      }
    });
  }

  function wireLookup(fs, searchSel, goSel, resultsSel, onPick, prefix) {
    const input = fs.querySelector(searchSel);
    const go = fs.querySelector(goSel);
    const list = fs.querySelector(resultsSel);
    const run = async () => {
      const q = input.value.trim();
      if (!q) return;
      list.innerHTML = "";
      status("Searching addresses…");
      try {
        const res = await Lookups.lookupAddress((prefix || "") + q, 5);
        if (!res.results.length) { status("No matches.", "err"); return; }
        res.results.forEach((r) => {
          const li = document.createElement("li");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = r.full_address || r.name || r.address_line_1;
          btn.addEventListener("click", () => { onPick(r); list.innerHTML = ""; status("Address applied.", "ok"); });
          li.appendChild(btn);
          list.appendChild(li);
        });
        status("");
      } catch (e) {
        status("Address lookup failed: " + e.message, "err");
      }
    };
    go.addEventListener("click", run);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); run(); } });
  }

  function dayFieldInput(fs, path) {
    return $$("[data-f]", fs).find((i) => !i.closest("tbody") && i.dataset.f === path);
  }
  function setDayField(fs, path, v) { const el = dayFieldInput(fs, path); if (el) el.value = v == null ? "" : v; }
  function getDayField(fs, path) { const el = dayFieldInput(fs, path); return el ? el.value : ""; }

  // ---------- Departments ----------
  function renderDepartments() {
    const container = $("#departments-container");
    container.innerHTML = "";
    DEPARTMENTS.forEach((dept) => {
      const block = document.createElement("div");
      block.className = "dept-block";
      block.dataset.dept = dept;
      const head = document.createElement("div");
      head.className = "dept-head";
      const h = document.createElement("h3");
      h.textContent = dept;
      head.appendChild(h);
      const fromRoster = document.createElement("button");
      fromRoster.type = "button";
      fromRoster.className = "btn btn-sm";
      fromRoster.textContent = "＋ from roster";
      const addRow = document.createElement("button");
      addRow.type = "button";
      addRow.className = "btn btn-sm";
      addRow.textContent = "＋ row";
      head.appendChild(fromRoster);
      head.appendChild(addRow);
      block.appendChild(head);

      const picker = document.createElement("div");
      picker.className = "roster-picker roster-list";
      picker.hidden = true;
      block.appendChild(picker);

      const scroll = document.createElement("div");
      scroll.className = "table-scroll";
      const table = document.createElement("table");
      table.className = "grid-table contact-table";
      table.hidden = true;
      table.innerHTML =
        '<thead><tr><th scope="col">Position</th><th scope="col">Name</th><th scope="col">Pronouns</th><th scope="col">Phone</th><th scope="col">Email</th><th scope="col">Call</th><th scope="col">Wrap</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody class="contact-body"></tbody>';
      scroll.appendChild(table);
      const empty = document.createElement("p");
      empty.className = "muted dept-empty";
      empty.textContent = "No one added yet.";
      block.appendChild(scroll);
      block.appendChild(empty);
      container.appendChild(block);

      addRow.addEventListener("click", () => addContactRow(block));
      fromRoster.addEventListener("click", () => toggleRosterPicker(block, picker));
    });
  }

  function updateDeptVisibility(block) {
    const table = block.querySelector(".contact-table");
    const empty = block.querySelector(".dept-empty");
    const hasRows = block.querySelectorAll(".contact-body tr").length > 0;
    if (table) table.hidden = !hasRows;
    if (empty) empty.hidden = hasRows;
  }

  function toggleRosterPicker(block, picker) {
    picker.hidden = !picker.hidden;
    if (picker.hidden) return;
    picker.innerHTML = "";
    const crew = Profile.read().crew || [];
    if (!crew.length) {
      picker.innerHTML = '<span class="muted">No saved roster yet. Add people in “Your profile &amp; roster”.</span>';
      return;
    }
    crew.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm btn-ghost";
      btn.textContent = `${c.role || "?"} — ${c.name || ""}`;
      btn.addEventListener("click", () => {
        addContactRow(block, { position: c.role, name: c.name, pronouns: c.pronouns, phone: c.phone, email: c.email });
      });
      picker.appendChild(btn);
    });
  }

  function addContactRow(block, data) {
    data = data || {};
    const body = block.querySelector(".contact-body");
    const row = $("#tpl-contact-row").content.cloneNode(true);
    $$("[data-f]", row).forEach((i) => { i.value = data[i.dataset.f] || ""; });
    row.querySelector(".row-remove").addEventListener("click", (e) => { const b = e.target.closest(".dept-block"); e.target.closest("tr").remove(); updateDeptVisibility(b); });
    row.querySelector(".contact-save").addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      const entry = {};
      $$("[data-f]", tr).forEach((i) => { entry[i.dataset.f] = i.value.trim(); });
      const crew = { role: entry.position, name: entry.name, phone: entry.phone, email: entry.email, pronouns: entry.pronouns };
      if (!crew.name && !crew.role) { status("Nothing to save on that row.", "err"); return; }
      Profile.addCrew(crew);
      renderRoster();
      status(`Saved ${crew.name || crew.role} to roster.`, "ok");
    });
    body.appendChild(row);
    updateDeptVisibility(block);
  }

  // ---------- Meals ----------
  function renderMeals() {
    const body = $("#meals-body");
    body.innerHTML = "";
    MEALS.forEach((label) => {
      const key = mealKey(label);
      const tr = document.createElement("tr");
      tr.dataset.mealKey = key;
      tr.innerHTML =
        `<th scope="row">${label}</th>` +
        `<td><input type="text" data-mf="vendor" aria-label="${label} vendor" /></td>` +
        `<td><input type="text" data-mf="phone" aria-label="${label} phone" /></td>` +
        `<td><input type="text" data-mf="time" aria-label="${label} time" /></td>` +
        `<td><input type="text" data-mf="notes" aria-label="${label} notes" /></td>`;
      body.appendChild(tr);
    });
  }

  // ---------- Roster / profile UI ----------
  function renderRoster() {
    const list = $("#roster-list");
    list.innerHTML = "";
    const crew = Profile.read().crew || [];
    if (!crew.length) { list.innerHTML = '<span class="muted">No saved crew yet.</span>'; }
    crew.forEach((c) => {
      const chip = document.createElement("span");
      chip.className = "roster-chip";
      chip.appendChild(document.createTextNode(`${c.role || "?"} — ${c.name || ""}`));
      const rm = document.createElement("button");
      rm.type = "button";
      rm.setAttribute("aria-label", `Remove ${c.name || c.role} from roster`);
      rm.textContent = "✕";
      rm.addEventListener("click", () => { Profile.removeCrew(c.role, c.name); renderRoster(); });
      chip.appendChild(rm);
      list.appendChild(chip);
    });
    renderClientList();
  }

  function renderClientList() {
    const dl = $("#clients-list");
    if (!dl) return;
    dl.innerHTML = "";
    (Profile.read().clients || []).forEach((c) => {
      const o = document.createElement("option");
      o.value = c.name;
      dl.appendChild(o);
    });
  }

  // ---------- Collect answers ----------
  function collectAnswers() {
    const shared = {
      project_name: val("project_name"),
      client: val("client"),
      production_company: val("production_company"),
      agency: val("agency"),
      job_number: val("job_number"),
      contacts_by_department: {},
      wardrobe: { recommended: val("wardrobe_recommended"), avoid: val("wardrobe_avoid") },
      meals: {},
      notes_block: linesOf("notes_block"),
      invoicing: {
        job_reference: val("inv_job_reference"),
        send_to: val("inv_send_to"),
        billing_address: val("inv_billing_address"),
        notes: val("inv_notes"),
      },
    };

    // Departments
    $$(".dept-block").forEach((block) => {
      const dept = block.dataset.dept;
      const rows = [];
      $$(".contact-body tr", block).forEach((tr) => {
        const entry = {};
        $$("[data-f]", tr).forEach((i) => { entry[i.dataset.f] = i.value.trim(); });
        if (Object.values(entry).some(Boolean)) rows.push(entry);
      });
      if (rows.length) shared.contacts_by_department[dept] = rows;
    });

    // Meals
    $$("#meals-body tr").forEach((tr) => {
      const key = tr.dataset.mealKey;
      const entry = {};
      $$("[data-mf]", tr).forEach((i) => { entry[i.dataset.mf] = i.value.trim(); });
      if (Object.values(entry).some(Boolean)) shared.meals[key] = entry;
    });
    const allergies = val("meals_allergies");
    if (allergies) shared.meals.allergies = allergies;

    // Days
    const days = $$(".day-fieldset").map((fs) => {
      const day = { location: {}, hospital: {}, on_site_contacts: [], schedule: [] };
      $$("[data-f]", fs).forEach((input) => {
        if (input.closest("tbody")) return;
        const path = input.dataset.f;
        if (path.startsWith("_")) return; // helper fields
        setPath(day, path, input.value);
      });
      $$(".onsite-body tr", fs).forEach((tr) => {
        const c = {};
        $$("[data-f]", tr).forEach((i) => { c[i.dataset.f] = i.value.trim(); });
        if (Object.values(c).some(Boolean)) day.on_site_contacts.push(c);
      });
      $$(".schedule-body tr", fs).forEach((tr) => {
        const s = {};
        $$("[data-f]", tr).forEach((i) => { s[i.dataset.f] = i.value.trim(); });
        if (Object.values(s).some(Boolean)) day.schedule.push(s);
      });
      return day;
    });

    return { shared, days };
  }

  function linesOf(id) {
    return val(id).split("\n").map((s) => s.trim()).filter(Boolean);
  }

  // ---------- Validation ----------
  function validate(answers) {
    const problems = [];
    if (!answers.shared.project_name) problems.push("Project name is missing.");
    answers.days.forEach((d, i) => {
      const n = i + 1;
      if (!d.date_label) problems.push(`Day ${n}: date is missing.`);
      if (!d.crew_call) problems.push(`Day ${n}: crew call is missing.`);
      if (!(d.location && d.location.address_line_1)) problems.push(`Day ${n}: location address is missing.`);
      if (!(d.hospital && d.hospital.name)) problems.push(`Day ${n}: nearest hospital is missing.`);
    });
    const dept = answers.shared.contacts_by_department;
    if (!dept.PRODUCTION || !dept.PRODUCTION.length) problems.push("At least one Production contact is recommended.");
    if (!dept.CAMERA || !dept.CAMERA.length) problems.push("At least one Camera contact is recommended.");
    return problems;
  }

  // ---------- Generate ----------
  async function generate() {
    const answers = collectAnswers();
    const problems = validate(answers);
    const vEl = $("#validation");
    if (problems.length) {
      vEl.className = "validation";
      vEl.textContent = "Heads up:\n• " + problems.join("\n• ") + "\n\nGenerating anyway — fields left blank show as placeholders.";
    } else {
      vEl.className = "validation ok";
      vEl.textContent = "Looks complete.";
    }
    try {
      status("Building workbook…");
      const proj = (answers.shared.project_name || "CallSheet").replace(/[^\w\-]+/g, "_");
      const date = (answers.days[0] && answers.days[0].date_label ? answers.days[0].date_label : "")
        .replace(/[^\w\-]+/g, "_") || new Date().toISOString().slice(0, 10);
      const filename = `CALLSHEET_${proj}_${date}.xlsx`;
      await Builder.download(answers, filename);
      status("Downloaded " + filename, "ok");
    } catch (e) {
      status("Failed to build: " + e.message, "err");
      vEl.className = "validation";
      vEl.textContent = "Error: " + e.message;
    }
  }

  // ---------- path helpers ----------
  function setPath(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  // ---------- Import ----------
  async function handleImport(file) {
    const results = $("#import-results");
    results.innerHTML = "Reading…";
    try {
      const buf = await file.arrayBuffer();
      const { candidates } = await Importer.fromArrayBuffer(buf);
      if (!candidates.length) { results.innerHTML = '<span class="muted">No contacts found.</span>'; return; }
      results.innerHTML = "";
      const head = document.createElement("p");
      head.className = "help";
      head.textContent = `Found ${candidates.length} candidate(s). Select which to add to your roster:`;
      results.appendChild(head);
      candidates.forEach((c, idx) => {
        const div = document.createElement("div");
        div.className = "import-cand";
        const lab = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = true;
        cb.dataset.idx = idx;
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(` ${c.role} — ${c.name || "(no name)"} ${c.phone || ""} ${c.email || ""}`));
        div.appendChild(lab);
        results.appendChild(div);
      });
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn";
      addBtn.textContent = "Add selected to roster";
      addBtn.addEventListener("click", () => {
        let added = 0;
        $$("input[type=checkbox][data-idx]", results).forEach((cb) => {
          if (!cb.checked) return;
          const c = candidates[parseInt(cb.dataset.idx, 10)];
          Profile.addCrew({ role: c.role, name: c.name, phone: c.phone, email: c.email });
          added++;
        });
        renderRoster();
        status(`Added ${added} contact(s) to roster.`, "ok");
        results.innerHTML = "";
      });
      results.appendChild(addBtn);
    } catch (e) {
      results.textContent = "";
      const span = document.createElement("span");
      span.className = "status err";
      span.textContent = "Import failed: " + e.message;
      results.appendChild(span);
    }
  }

  // ---------- Sample ----------
  const SAMPLE = {
    shared: {
      project_name: "GitHub × ASOS", client: "GitHub", production_company: "MAJORITY",
      agency: "", job_number: "GH-2026-014",
      contacts_by_department: {
        PRODUCTION: [
          { position: "Director / Producer", name: "Alex Perrault", pronouns: "he/him", phone: "+1 206-919-0160", email: "evillollive@github.com", call: "8:00 AM", wrap: "6:00 PM" },
          { position: "Producer (Majority)", name: "Cathleen Alexander", pronouns: "she/her", phone: "+1 213-864-8680", email: "ca@majorityfilm.com", call: "8:00 AM", wrap: "6:00 PM" },
        ],
        CAMERA: [{ position: "DP", name: "Brett Bollier", pronouns: "he/him", phone: "+1 503-866-5518", email: "brett.bollier@gmail.com", call: "8:00 AM", wrap: "6:00 PM" }],
        "G&E": [{ position: "Gaffer", name: "Al Rice", pronouns: "", phone: "+44 7917 606621", email: "al@alricelights.com", call: "8:00 AM", wrap: "6:00 PM" }],
        VANITIES: [{ position: "Hair & Makeup", name: "Dominic Skinner", pronouns: "", phone: "+44 7747 648953", email: "dominiccskinner@gmail.com", call: "9:15 AM", wrap: "5:00 PM" }],
        CLIENT: [{ position: "GitHub", name: "Grace Beatty", pronouns: "", phone: "+34 675 628 689", email: "gracebeatty@github.com", call: "8:30 AM", wrap: "" }],
      },
      wardrobe: WARDROBE_DEFAULTS,
      meals: {
        breakfast: { vendor: "Hotel", phone: "", time: "Pre-shoot", notes: "Please eat before arriving." },
        lunch: { vendor: "TBD on site", phone: "", time: "12:00 PM", notes: "Crew lunch on location." },
        crafty_snacks: { vendor: "", phone: "", time: "All day", notes: "Snacks, coffee, water on set." },
        allergies: "Allergies / dietary restrictions: flag to the Producer in advance.",
      },
      notes_block: Profile.emptyProfile().notes_block,
      invoicing: {
        job_reference: "GH-2026-014", send_to: "ca@majorityfilm.com",
        billing_address: "Majority Film, 1234 Sunset Blvd, Los Angeles CA 90026",
        notes: "Meals up to $35/day reimbursable with receipt.",
      },
    },
    days: [{
      tab_name: "Day 1", date_label: "Friday, February 6, 2026", city_for_lookup: "London",
      crew_call: "8:00 AM",
      location: { address_line_1: "Greater London House", address_line_2: "Hampstead Rd", city_state_zip: "London NW1 7FB, United Kingdom" },
      hospital: { name: "University College Hospital", address: "235 Euston Rd, London NW1 2BU", phone: "020 3456 7890" },
      first_shot: "10:00 AM", wrap: "6:00 PM", lunch: "12:00 PM", sunrise: "7:25 AM", sunset: "5:02 PM", weather: "48°F, partly cloudy",
      parking: "Limited street parking. Loading at front, then NCP Euston Garage (5 min walk).",
      building_access: "Reception on Ground Floor. Sign in for Grace Beatty, badge to Floor 4.",
      on_site_contacts: [
        { name: "Alex Perrault", role: "Director", phone: "+1 206-919-0160" },
        { name: "Cathleen Alexander", role: "Producer", phone: "+1 213-864-8680" },
      ],
      schedule: [
        { time: "8:00 AM", activity: "Crew arrives, load in", location: "Location A", talent: "Crew", notes: "" },
        { time: "10:00 AM", activity: "INTERVIEW 1", location: "Location A", talent: "Dylan Morley", notes: "Interview + B-roll" },
        { time: "12:00 PM", activity: "Lunch", location: "On site", talent: "All", notes: "" },
        { time: "5:00 PM", activity: "Wrap, break down, load out", location: "Both", talent: "All crew", notes: "" },
      ],
    }],
  };

  function loadAnswers(a) {
    setVal("project_name", a.shared.project_name);
    setVal("client", a.shared.client);
    setVal("production_company", a.shared.production_company);
    setVal("agency", a.shared.agency);
    setVal("job_number", a.shared.job_number);
    setVal("wardrobe_recommended", a.shared.wardrobe && a.shared.wardrobe.recommended);
    setVal("wardrobe_avoid", a.shared.wardrobe && a.shared.wardrobe.avoid);
    setVal("notes_block", (a.shared.notes_block || []).join("\n"));
    const inv = a.shared.invoicing || {};
    setVal("inv_job_reference", inv.job_reference);
    setVal("inv_send_to", inv.send_to);
    setVal("inv_billing_address", inv.billing_address);
    setVal("inv_notes", inv.notes);

    // meals
    renderMeals();
    const meals = a.shared.meals || {};
    $$("#meals-body tr").forEach((tr) => {
      const entry = meals[tr.dataset.mealKey] || {};
      $$("[data-mf]", tr).forEach((i) => { i.value = entry[i.dataset.mf] || ""; });
    });
    setVal("meals_allergies", meals.allergies);

    // departments
    renderDepartments();
    const dept = a.shared.contacts_by_department || {};
    $$(".dept-block").forEach((block) => {
      (dept[block.dataset.dept] || []).forEach((c) => addContactRow(block, c));
    });

    // days
    $("#days-container").innerHTML = "";
    (a.days || []).forEach((d) => addDay(d));
    if (!(a.days || []).length) addDay();
  }

  function resetForm() {
    ["project_name","client","production_company","agency","job_number","wardrobe_recommended","wardrobe_avoid","meals_allergies","inv_job_reference","inv_send_to","inv_billing_address","inv_notes"].forEach((id) => setVal(id, ""));
    setVal("notes_block", (Profile.read().notes_block || []).join("\n"));
    renderMeals();
    renderDepartments();
    $("#days-container").innerHTML = "";
    addDay();
    $("#validation").textContent = "";
    status("Form reset.", "");
  }

  // ---------- Init ----------
  function init() {
    renderMeals();
    renderDepartments();
    renderRoster();
    addDay();
    setVal("notes_block", (Profile.read().notes_block || []).join("\n"));
    setVal("profile-notes", (Profile.read().notes_block || []).join("\n"));

    $("#btn-add-day").addEventListener("click", () => addDay());
    $("#btn-generate").addEventListener("click", generate);
    $("#btn-generate-2").addEventListener("click", generate);
    $("#btn-load-sample").addEventListener("click", () => { loadAnswers(SAMPLE); status("Sample loaded.", "ok"); });
    $("#btn-reset").addEventListener("click", resetForm);

    $("#btn-wardrobe-defaults").addEventListener("click", () => {
      setVal("wardrobe_recommended", WARDROBE_DEFAULTS.recommended);
      setVal("wardrobe_avoid", WARDROBE_DEFAULTS.avoid);
    });
    $("#btn-notes-from-profile").addEventListener("click", () => {
      setVal("notes_block", (Profile.read().notes_block || []).join("\n"));
    });

    // Profile: roster add
    $("#btn-roster-add").addEventListener("click", () => {
      const entry = {
        role: val("roster-role").trim(), name: val("roster-name").trim(),
        phone: val("roster-phone").trim(), email: val("roster-email").trim(),
        pronouns: val("roster-pronouns").trim(),
      };
      if (!entry.role && !entry.name) { status("Enter at least a role or name.", "err"); return; }
      Profile.addCrew(entry);
      ["roster-role","roster-name","roster-phone","roster-email","roster-pronouns"].forEach((id) => setVal(id, ""));
      renderRoster();
      status("Added to roster.", "ok");
    });

    $("#btn-notes-save").addEventListener("click", () => {
      const notes = val("profile-notes").split("\n").map((s) => s.trim()).filter(Boolean);
      Profile.setNotesBlock(notes);
      status("Notes saved to profile.", "ok");
    });

    $("#import-file").addEventListener("change", (e) => { if (e.target.files[0]) handleImport(e.target.files[0]); });

    $("#btn-profile-export").addEventListener("click", () => {
      const blob = new Blob([Profile.exportJson()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "callsheet-profile.json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $("#profile-import-file").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        Profile.importJson(await f.text());
        renderRoster();
        setVal("profile-notes", (Profile.read().notes_block || []).join("\n"));
        status("Profile imported.", "ok");
      } catch (err) { status("Import failed: " + err.message, "err"); }
    });
    $("#btn-profile-clear").addEventListener("click", () => {
      if (!confirm("Clear all saved profile data in this browser?")) return;
      Profile.reset();
      renderRoster();
      setVal("profile-notes", (Profile.read().notes_block || []).join("\n"));
      status("Profile cleared.", "ok");
    });

    renderClientList();

    const verEl = document.getElementById("app-version");
    if (verEl && window.__APP_VERSION__) verEl.textContent = window.__APP_VERSION__;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

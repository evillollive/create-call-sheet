/*
 * Call sheet workbook builder — browser port of scripts/build_callsheet.py.
 * Uses ExcelJS (vendored) to render the same styled .xlsx, entirely client-side.
 *
 * Exposes (on window.CallSheetBuilder):
 *   buildWorkbook(answers)            -> ExcelJS.Workbook
 *   writeBuffer(answers)              -> Promise<ArrayBuffer>
 *   download(answers, filename)       -> Promise<void>
 */
(function () {
  "use strict";

  // ---------- Palette / style (matches template). ARGB (alpha-prefixed). ----------
  const INK        = "FF111111";
  const PAPER      = "FFFFFFFF";
  const SUBTLE     = "FFF4F4F5";
  const BAND       = "FF111111";
  const BAND_TEXT  = "FFFFFFFF";
  const ACCENT     = "FFFFD400";
  const ACCENT_INK = "FF111111";
  const RULE       = "FFD4D4D8";
  const DEPT_BG    = "FF27272A";
  const DEPT_FG    = "FFFFFFFF";
  const NOTE_BG    = "FFFEF3C7";
  const INPUT_BG   = "FFFAFAFA";
  const DEEMP_BG   = "FF6B6B6B";
  const DEEMP_FG   = "FFFFFFFF";
  const LINK_FG    = "FF2563EB";
  const MUTE       = "FF6B6B6B";

  const FONT_NAME  = "Arial";
  const COLS       = 14;

  // ---------- small helpers ----------
  function colLetter(n) {
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function mapsUrl(address) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address);
  }

  function font(opts) {
    opts = opts || {};
    const f = { name: FONT_NAME };
    if (opts.size !== undefined) f.size = opts.size;
    if (opts.bold !== undefined) f.bold = opts.bold;
    if (opts.italic !== undefined) f.italic = opts.italic;
    if (opts.color !== undefined) f.color = { argb: opts.color };
    return f;
  }

  function align(opts) {
    opts = opts || {};
    const a = {};
    if (opts.h !== undefined) a.horizontal = opts.h;
    if (opts.v !== undefined) a.vertical = opts.v;
    if (opts.wrap !== undefined) a.wrapText = opts.wrap;
    if (opts.indent !== undefined) a.indent = opts.indent;
    return a;
  }

  function borderAll() {
    const side = { style: "thin", color: { argb: RULE } };
    return { top: side, left: side, right: side, bottom: side };
  }

  function styleCell(cell, opts) {
    if (opts.font) cell.font = opts.font;
    if (opts.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
    if (opts.align) cell.alignment = opts.align;
    if (opts.border) cell.border = opts.border;
  }

  function parseRange(range) {
    // "A9:D11" -> {r1,c1,r2,c2}; "A9" -> single
    const m = range.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
    const colToNum = (s) => {
      let n = 0;
      for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
      return n;
    };
    const c1 = colToNum(m[1]);
    const r1 = parseInt(m[2], 10);
    const c2 = m[3] ? colToNum(m[3]) : c1;
    const r2 = m[4] ? parseInt(m[4], 10) : r1;
    return { r1, c1, r2, c2 };
  }

  // Merge (when needed), style every cell in the rectangle, write value+hyperlink to top-left.
  function paint(ws, range, value, opts) {
    opts = opts || {};
    const { r1, c1, r2, c2 } = parseRange(range);
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(range);
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        styleCell(ws.getCell(r, c), opts);
      }
    }
    const cell = ws.getCell(r1, c1);
    if (value !== undefined && value !== null) {
      if (opts.hyperlink) {
        cell.value = { text: String(value), hyperlink: opts.hyperlink };
      } else {
        cell.value = value;
      }
    } else if (opts.hyperlink) {
      cell.value = { text: "", hyperlink: opts.hyperlink };
    }
    return cell;
  }

  function span(ws, row, cA, cB, value, opts) {
    const range = colLetter(cA) + row + ":" + colLetter(cB) + row;
    return paint(ws, range, value, opts);
  }

  function band(ws, row, text, opts) {
    opts = opts || {};
    span(ws, row, 1, COLS, text, {
      fill: opts.fill || BAND,
      font: font({ size: opts.size || 11, bold: true, color: opts.fg || BAND_TEXT }),
      align: align({ h: "left", v: "center", indent: 1 }),
    });
    ws.getRow(row).height = 22;
  }

  function setColWidths(ws, widths) {
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  }

  const joinNonEmpty = (arr, sep) => arr.filter(Boolean).join(sep);

  // ---------- Day tab ----------
  function buildDayTab(wb, day, shared, tabName, dayIdx, dayTotal) {
    const ws = wb.addWorksheet(tabName, { views: [{ showGridLines: false }] });
    setColWidths(ws, [4, 12, 16, 16, 14, 14, 14, 14, 16, 14, 14, 12, 12, 4]);
    const border = borderAll();

    // ----- Header band -----
    ws.getRow(1).height = 8;
    span(ws, 2, 1, COLS, "CALL SHEET", {
      fill: BAND, font: font({ size: 22, bold: true, color: BAND_TEXT }),
      align: align({ h: "left", v: "center", indent: 2 }),
    });
    ws.getRow(2).height = 38;
    ws.getRow(3).height = 6;

    // Project / Day / Date
    span(ws, 4, 1, 8, shared.project_name || "[ Project Name ]", {
      font: font({ size: 16, bold: true, color: INK }),
      align: align({ h: "left", v: "center" }),
    });
    span(ws, 4, 9, 11, `DAY ${dayIdx} OF ${dayTotal}`, {
      fill: SUBTLE, font: font({ size: 11, bold: true }),
      align: align({ h: "center", v: "center" }), border,
    });
    span(ws, 4, 12, 14, day.date_label || "[ Day/Month/YYYY ]", {
      fill: SUBTLE, font: font({ size: 11, bold: true }),
      align: align({ h: "center", v: "center" }), border,
    });
    ws.getRow(4).height = 26;

    // Client / Production Co / Agency / Job#
    const labels = [
      ["CLIENT", 1, 4, shared.client],
      ["PRODUCTION CO.", 5, 8, shared.production_company],
      ["AGENCY", 9, 11, shared.agency],
      ["JOB #", 12, 14, shared.job_number],
    ];
    labels.forEach(([lab, c1, c2]) => {
      span(ws, 5, c1, c2, lab, {
        font: font({ size: 9, bold: true, color: MUTE }),
        align: align({ h: "left", v: "center", indent: 1 }), fill: PAPER,
      });
    });
    ws.getRow(5).height = 14;
    labels.forEach(([, c1, c2, val]) => {
      span(ws, 6, c1, c2, val || "", {
        fill: INPUT_BG, border, font: font({ size: 11 }),
        align: align({ h: "left", v: "center", indent: 1 }),
      });
    });
    ws.getRow(6).height = 22;

    // ----- AT A GLANCE -----
    ws.getRow(7).height = 10;
    band(ws, 8, "AT A GLANCE");

    const crewCall = day.crew_call || "[ 00:00 AM/PM ]";
    const loc = day.location || {};
    const locText = loc.address_line_1
      ? "LOCATION\n" + joinNonEmpty([loc.address_line_1, loc.address_line_2, loc.city_state_zip], "\n")
      : "LOCATION\n[ Address line 1 ]\n[ City, State ZIP ]";
    const hosp = day.hospital || {};
    const hospText = hosp.name
      ? "NEAREST HOSPITAL\n" + joinNonEmpty([hosp.name, hosp.address, hosp.phone], "\n") + "\nDIAL 911 IN EMERGENCY"
      : "NEAREST HOSPITAL\n[ Hospital ]\n[ Address ]   •   [ Phone ]\nDIAL 911 IN EMERGENCY";

    paint(ws, "A9:D11", `CREW CALL\n${crewCall}`, {
      fill: ACCENT, font: font({ size: 18, bold: true, color: ACCENT_INK }),
      align: align({ h: "center", v: "center", wrap: true }), border,
    });

    const locAddress = joinNonEmpty([loc.address_line_1, loc.address_line_2, loc.city_state_zip], ", ");
    paint(ws, "E9:I11", locText, {
      fill: PAPER, font: font({ size: 12, bold: true, color: locAddress ? LINK_FG : INK }),
      align: align({ h: "center", v: "center", wrap: true }), border,
      hyperlink: locAddress ? mapsUrl(locAddress) : undefined,
    });

    const hospAddress = joinNonEmpty([hosp.name, hosp.address], ", ");
    paint(ws, "J9:N11", hospText, {
      fill: PAPER, font: font({ size: 11, bold: true, color: hospAddress ? LINK_FG : INK }),
      align: align({ h: "center", v: "center", wrap: true }), border,
      hyperlink: hospAddress ? mapsUrl(hospAddress) : undefined,
    });
    [9, 10, 11].forEach((rr) => { ws.getRow(rr).height = 26; });

    // Quick info ribbon
    ws.getRow(12).height = 8;
    const ribbon = [
      ["FIRST SHOT", 1, 3, day.first_shot],
      ["WRAP", 4, 5, day.wrap],
      ["LUNCH", 6, 7, day.lunch],
      ["SUNRISE", 8, 9, day.sunrise],
      ["SUNSET", 10, 11, day.sunset],
      ["WEATHER", 12, 14, day.weather],
    ];
    ribbon.forEach(([lab, c1, c2]) => {
      span(ws, 13, c1, c2, lab, {
        font: font({ size: 9, bold: true, color: MUTE }),
        align: align({ h: "center", v: "center" }),
      });
    });
    ws.getRow(13).height = 14;
    ribbon.forEach(([, c1, c2, val]) => {
      span(ws, 14, c1, c2, val || "", {
        fill: INPUT_BG, border, font: font({ size: 11, bold: true }),
        align: align({ h: "center", v: "center" }),
      });
    });
    ws.getRow(14).height = 22;

    // Weather lookup hyperlink
    const city = (day.city_for_lookup || "").replace(/ /g, "+");
    const dateQ = (day.date_label || "").replace(/ /g, "+");
    const weatherUrl = `https://www.google.com/search?q=weather+${city}+${dateQ}`;
    span(ws, 15, 12, 14, "Check weather →", {
      font: font({ size: 9, italic: true, color: LINK_FG }),
      align: align({ h: "center", v: "center" }), hyperlink: weatherUrl,
    });
    ws.getRow(15).height = 14;

    // ----- LOGISTICS -----
    ws.getRow(16).height = 8;
    band(ws, 17, "LOGISTICS");
    [[1, 7, "PARKING"], [8, 14, "BUILDING ACCESS / LOAD IN"]].forEach(([c1, c2, lab]) => {
      span(ws, 18, c1, c2, lab, {
        font: font({ size: 9, bold: true, color: MUTE }),
        align: align({ h: "left", v: "center", indent: 1 }),
      });
    });
    ws.getRow(18).height = 14;

    const parkingTxt = day.parking || "[ Garage name, address, validation instructions, street vs. lot, what to avoid ]";
    const accessTxt = day.building_access || "[ Reception floor, security check-in, loading dock instructions, who to ask for ]";
    paint(ws, "A19:G21", parkingTxt, {
      fill: INPUT_BG, border, font: font({ size: 10 }),
      align: align({ h: "left", v: "top", wrap: true, indent: 1 }),
    });
    paint(ws, "H19:N21", accessTxt, {
      fill: INPUT_BG, border, font: font({ size: 10 }),
      align: align({ h: "left", v: "top", wrap: true, indent: 1 }),
    });
    [19, 20, 21].forEach((rr) => { ws.getRow(rr).height = 22; });

    // On-site emergency contacts
    span(ws, 22, 1, COLS, "ON-SITE EMERGENCY CONTACTS", {
      font: font({ size: 9, bold: true, color: MUTE }),
      align: align({ h: "left", v: "center", indent: 1 }),
    });
    ws.getRow(22).height = 14;

    const spans = [[1, 3, "NAME"], [4, 5, "ROLE"], [6, 7, "PHONE"], [8, 10, "NAME"], [11, 12, "ROLE"], [13, 14, "PHONE"]];
    spans.forEach(([c1, c2, lab]) => {
      span(ws, 23, c1, c2, lab, {
        fill: SUBTLE, border, font: font({ size: 9, bold: true }),
        align: align({ h: "left", v: "center", indent: 1 }),
      });
    });
    ws.getRow(23).height = 16;

    const onSite = (day.on_site_contacts && day.on_site_contacts.length ? day.on_site_contacts.slice() : [{}, {}]);
    while (onSite.length < 2) onSite.push({});
    [24, 25].forEach((rr, i) => {
      const contact = onSite[i] || {};
      [[1, 3, contact.name], [4, 5, contact.role], [6, 7, contact.phone]].forEach(([c1, c2, val]) => {
        span(ws, rr, c1, c2, val || "", {
          fill: INPUT_BG, border, font: font({ size: 11 }),
          align: align({ h: "left", v: "center", indent: 1 }),
        });
      });
      const extra = onSite[i + 2] || {};
      [[8, 10, extra.name], [11, 12, extra.role], [13, 14, extra.phone]].forEach(([c1, c2, val]) => {
        span(ws, rr, c1, c2, val || "", {
          fill: INPUT_BG, border, font: font({ size: 11 }),
          align: align({ h: "left", v: "center", indent: 1 }),
        });
      });
      ws.getRow(rr).height = 22;
    });

    // ----- SCHEDULE -----
    ws.getRow(26).height = 8;
    band(ws, 27, "SCHEDULE");
    const schedHeaders = [[1, 2, "TIME"], [3, 7, "ACTIVITY"], [8, 10, "LOCATION"], [11, 12, "TALENT"], [13, 14, "NOTES"]];
    schedHeaders.forEach(([c1, c2, lab]) => {
      span(ws, 28, c1, c2, lab, {
        fill: DEPT_BG, border, font: font({ size: 9, bold: true, color: DEPT_FG }),
        align: align({ h: "left", v: "center", indent: 1 }),
      });
    });
    ws.getRow(28).height = 18;

    const schedule = day.schedule || [];
    const rowsNeeded = Math.max(12, schedule.length);
    for (let i = 0; i < rowsNeeded; i++) {
      const rr = 29 + i;
      const item = schedule[i] || {};
      const striped = i % 2 === 0 ? INPUT_BG : PAPER;
      const cells = [
        [1, 2, item.time], [3, 7, item.activity], [8, 10, item.location],
        [11, 12, item.talent], [13, 14, item.notes],
      ];
      cells.forEach(([c1, c2, val]) => {
        span(ws, rr, c1, c2, val || "", {
          fill: striped, border, font: font({ size: 10 }),
          align: align({ h: "left", v: "center", indent: 1, wrap: true }),
        });
      });
      ws.getRow(rr).height = 20;
    }

    let r = 29 + rowsNeeded;

    // ----- CONTACTS -----
    ws.getRow(r).height = 8; r += 1;
    band(ws, r, "CONTACTS  •  CREW, CLIENT, TALENT, VENDORS"); r += 1;

    const contactHeaders = [[1, 3, "POSITION"], [4, 5, "NAME"], [6, 6, "PRONOUNS"], [7, 8, "PHONE"], [9, 12, "EMAIL"], [13, 13, "CALL"], [14, 14, "WRAP"]];
    contactHeaders.forEach(([c1, c2, lab]) => {
      span(ws, r, c1, c2, lab, {
        fill: DEPT_BG, border, font: font({ size: 9, bold: true, color: DEPT_FG }),
        align: align({ h: "left", v: "center", indent: 1 }),
      });
    });
    ws.getRow(r).height = 18; r += 1;

    const contactsByDept = shared.contacts_by_department || {};
    const departmentOrder = [
      "PRODUCTION", "CAMERA", "G&E", "SOUND", "ART", "VANITIES",
      "SUPPORT", "CLIENT", "AGENCY", "TALENT / INTERVIEWEES", "VENDORS",
    ];
    departmentOrder.forEach((dept) => {
      const rows = contactsByDept[dept] || [];
      if (!rows.length) return;
      span(ws, r, 1, COLS, dept, {
        fill: DEPT_BG, font: font({ size: 10, bold: true, color: DEPT_FG }),
        align: align({ h: "left", v: "center", indent: 1 }),
      });
      ws.getRow(r).height = 16; r += 1;
      rows.forEach((entry) => {
        span(ws, r, 1, 3, entry.position || "", { fill: SUBTLE, border, font: font({ size: 10 }), align: align({ h: "left", v: "center", indent: 1 }) });
        span(ws, r, 4, 5, entry.name || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "left", v: "center", indent: 1 }) });
        paint(ws, `F${r}`, entry.pronouns || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "center", v: "center" }) });
        span(ws, r, 7, 8, entry.phone || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "left", v: "center", indent: 1 }) });
        span(ws, r, 9, 12, entry.email || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "left", v: "center", indent: 1 }) });
        paint(ws, `M${r}`, entry.call || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "center", v: "center" }) });
        paint(ws, `N${r}`, entry.wrap || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "center", v: "center" }) });
        ws.getRow(r).height = 19; r += 1;
      });
    });

    // ----- WARDROBE -----
    const wardrobe = shared.wardrobe || {};
    if (wardrobe.recommended || wardrobe.avoid) {
      ws.getRow(r).height = 8; r += 1;
      band(ws, r, "WARDROBE & STYLING GUIDANCE (FOR TALENT)"); r += 1;
      span(ws, r, 1, 7, "RECOMMENDED", { font: font({ size: 9, bold: true, color: MUTE }), align: align({ h: "left", v: "center", indent: 1 }) });
      span(ws, r, 8, 14, "AVOID", { font: font({ size: 9, bold: true, color: MUTE }), align: align({ h: "left", v: "center", indent: 1 }) });
      ws.getRow(r).height = 14; r += 1;
      paint(ws, `A${r}:G${r + 2}`, wardrobe.recommended || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "left", v: "top", wrap: true, indent: 1 }) });
      paint(ws, `H${r}:N${r + 2}`, wardrobe.avoid || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "left", v: "top", wrap: true, indent: 1 }) });
      for (let rr = r; rr < r + 3; rr++) ws.getRow(rr).height = 22;
      r += 3;
    }

    // ----- MEALS -----
    const meals = shared.meals || {};
    if (Object.values(meals).some((v) => v && (typeof v !== "object" || Object.keys(v).length))) {
      ws.getRow(r).height = 8; r += 1;
      band(ws, r, "MEALS  •  CRAFTY  •  ALLERGIES"); r += 1;
      const headers = [[1, 2, "MEAL"], [3, 6, "VENDOR"], [7, 8, "PHONE"], [9, 9, "TIME"], [10, 14, "NOTES"]];
      headers.forEach(([c1, c2, lab]) => {
        span(ws, r, c1, c2, lab, { fill: DEPT_BG, border, font: font({ size: 9, bold: true, color: DEPT_FG }), align: align({ h: "left", v: "center", indent: 1 }) });
      });
      ws.getRow(r).height = 18; r += 1;

      ["Breakfast", "Lunch", "Dinner", "Crafty / Snacks", "Water / Coffee"].forEach((label) => {
        const key = label.toLowerCase().replace(/ \/ /g, "_").replace(/ /g, "_");
        const entry = meals[key] || {};
        span(ws, r, 1, 2, label, { fill: SUBTLE, border, font: font({ size: 10 }), align: align({ h: "left", v: "center", indent: 1 }) });
        span(ws, r, 3, 6, entry.vendor || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "left", v: "center", indent: 1 }) });
        span(ws, r, 7, 8, entry.phone || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "center", v: "center" }) });
        paint(ws, `I${r}`, entry.time || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "center", v: "center" }) });
        span(ws, r, 10, 14, entry.notes || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "left", v: "center", indent: 1 }) });
        ws.getRow(r).height = 20; r += 1;
      });

      const allergies = meals.allergies || "Allergies / dietary restrictions: please flag any to the Producer in advance.";
      span(ws, r, 1, COLS, allergies, { fill: NOTE_BG, border, font: font({ size: 10, italic: true }), align: align({ h: "left", v: "center", indent: 1 }) });
      ws.getRow(r).height = 20; r += 1;
    }

    // ----- NOTES / RULES -----
    const notesBlock = shared.notes_block || [];
    if (notesBlock.length) {
      ws.getRow(r).height = 8; r += 1;
      band(ws, r, "NOTES  •  RULES  •  ETIQUETTE"); r += 1;
      notesBlock.forEach((note) => {
        span(ws, r, 1, COLS, `•  ${note}`, { fill: PAPER, border, font: font({ size: 10 }), align: align({ h: "left", v: "center", wrap: true, indent: 1 }) });
        ws.getRow(r).height = 20; r += 1;
      });
    }

    // ----- INVOICING -----
    const invoicing = shared.invoicing || {};
    if (Object.values(invoicing).some(Boolean)) {
      ws.getRow(r).height = 8; r += 1;
      band(ws, r, "INVOICING"); r += 1;
      const rowsToEmit = [
        ["Job Reference (include on all invoices)", invoicing.job_reference],
        ["Send invoices to (email)", invoicing.send_to],
        ["Billing address", invoicing.billing_address],
        ["Reimbursable / per diem notes", invoicing.notes],
      ];
      rowsToEmit.forEach(([lab, val]) => {
        span(ws, r, 1, 5, lab, { fill: SUBTLE, border, font: font({ size: 10 }), align: align({ h: "left", v: "center", indent: 1 }) });
        span(ws, r, 6, COLS, val || "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "left", v: "center", indent: 1 }) });
        ws.getRow(r).height = 22; r += 1;
      });
    }

    // ----- PRODUCTION REPORT -----
    ws.getRow(r).height = 12; r += 1;
    span(ws, r, 1, COLS, "PRODUCTION REPORT  (fill in during/after filming — optional)", {
      fill: DEEMP_BG, font: font({ size: 10, bold: true, color: DEEMP_FG }),
      align: align({ h: "left", v: "center", indent: 1 }),
    });
    ws.getRow(r).height = 18; r += 1;
    const prFields = [
      ["1st AM Shot", "1st Meal Start", "1st Meal End"],
      ["1st PM Shot", "2nd Meal Start", "2nd Meal End"],
      ["Camera Wrap", "Crew Wrap", "Location Closed"],
    ];
    prFields.forEach(([a, b, c]) => {
      span(ws, r, 1, 2, a, { fill: SUBTLE, border, font: font({ size: 9, color: "FF3F3F46" }), align: align({ h: "left", v: "center", indent: 1 }) });
      span(ws, r, 3, 5, "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "center", v: "center" }) });
      span(ws, r, 6, 7, b, { fill: SUBTLE, border, font: font({ size: 9, color: "FF3F3F46" }), align: align({ h: "left", v: "center", indent: 1 }) });
      span(ws, r, 8, 9, "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "center", v: "center" }) });
      span(ws, r, 10, 11, c, { fill: SUBTLE, border, font: font({ size: 9, color: "FF3F3F46" }), align: align({ h: "left", v: "center", indent: 1 }) });
      span(ws, r, 12, COLS, "", { fill: INPUT_BG, border, font: font({ size: 10 }), align: align({ h: "center", v: "center" }) });
      ws.getRow(r).height = 20; r += 1;
    });
    ws.getRow(r).height = 12;

    // Print + freeze
    ws.pageSetup = {
      orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.3, footer: 0.3 },
    };
    ws.views = [{ state: "frozen", ySplit: 6, showGridLines: false }];
  }

  // ---------- How to use tab ----------
  function buildHowToTab(wb) {
    const ws = wb.addWorksheet("How to use", { views: [{ showGridLines: false }] });
    ws.getColumn(1).width = 4;
    ws.getColumn(2).width = 110;
    const w = (row, text, opts) => {
      opts = opts || {};
      const cell = ws.getCell(row, 2);
      cell.value = text;
      cell.font = { name: FONT_NAME, size: opts.size || 11, bold: !!opts.bold, color: { argb: opts.color || INK } };
      cell.alignment = { horizontal: "left", vertical: "center", wrapText: true };
      ws.getRow(row).height = opts.height || 18;
    };
    w(2, "HOW TO USE THIS WORKBOOK", { size: 18, bold: true, height: 28 });
    w(3, "This call sheet was generated by the Create Call Sheet web app.", { height: 22 });
    w(4, "Each shoot day has its own tab (Day 1, Day 2, etc.).");
    w(5, "");
    w(6, "EDITING", { size: 13, bold: true, height: 24 });
    w(7, "All gray cells are fill-ins. Yellow cells are highlighted call-outs.");
    w(8, "Anything in [ brackets ] is a placeholder — replace with shoot info.");
    w(9, "");
    w(10, "PRINTING", { size: 13, bold: true, height: 24 });
    w(11, "Pages are set to fit-to-width, portrait. Adjust in Print Preview if needed.");
    w(12, "");
    w(13, "WEATHER / SUNRISE", { size: 13, bold: true, height: 24 });
    w(14, "Sunrise and sunset are pre-filled where possible. Weather is left blank — click the 'Check weather' link in the quick-info ribbon to look it up.");
  }

  // ---------- Entry points ----------
  function buildWorkbook(answers) {
    const shared = answers.shared || {};
    const days = answers.days || [];
    if (!days.length) throw new Error("answers.days is required (at least one day)");

    const wb = new ExcelJS.Workbook();
    wb.creator = "create-call-sheet";
    days.forEach((day, i) => {
      const idx = i + 1;
      const tabName = day.tab_name || (days.length > 1 ? `Day ${idx}` : "Call Sheet");
      buildDayTab(wb, day, shared, tabName, idx, days.length);
    });
    buildHowToTab(wb);
    return wb;
  }

  async function writeBuffer(answers) {
    const wb = buildWorkbook(answers);
    return wb.xlsx.writeBuffer();
  }

  async function download(answers, filename) {
    const buffer = await writeBuffer(answers);
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "callsheet.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const api = { buildWorkbook, writeBuffer, download, mapsUrl };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.CallSheetBuilder = api;
})();

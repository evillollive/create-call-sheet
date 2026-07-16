/*
 * Import crew contacts from a past .xlsx — browser port of import_contacts.py.
 * Uses ExcelJS to read the workbook, then applies the same heuristic scanner.
 *
 * Exposes window.CallSheetImporter.
 */
(function () {
  "use strict";

  const norm = () => window.CallSheetLookups.normalizeRole;

  const PHONE_RE = /(\+?\d[\d\-.\s()]{7,}\d)/;
  const PHONE_RE_G = /(\+?\d[\d\-.\s()]{7,}\d)/g;
  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  const EMAIL_RE_G = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

  const ROLE_HINTS = [
    "director", "producer", "ep", "executive producer", "line producer",
    "production manager", "field producer", "dp", "director of photography",
    "1st ac", "2nd ac", "ac", "focus puller", "gaffer", "key grip", "grip",
    "swing", "best boy", "electrician", "sound mixer", "sound", "boom op", "boom",
    "hmu", "hair & makeup", "hair and makeup", "hair", "makeup", "wardrobe stylist", "stylist",
    "art director", "production designer", "set dresser",
    "production assistant", "pa", "driver", "teleprompter",
    "fixer", "local producer", "casting",
    "interviewee", "host", "presenter",
    "creative director", "account manager",
  ];

  const HEADER_NOISE = [
    "call sheet", "at a glance", "logistics", "parking", "building access",
    "schedule", "wardrobe & styling", "meals", "crafty", "allergies",
    "notes", "rules", "etiquette", "invoicing", "production report",
    "how to use", "talent / interviewees", "contacts", "crew",
    "fit-to-width", "check weather", "print preview",
    "recommended", "avoid", "confidentiality", "social media",
    "closed set", "health & safety", "respect the location",
    "sustainability", "on-site emergency",
  ];

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&");
  }

  const ROLE_PATTERNS = ROLE_HINTS.slice().sort((a, b) => b.length - a.length);
  const ROLE_RE = new RegExp("\\b(" + ROLE_PATTERNS.map(escapeRegex).join("|") + ")\\b", "i");

  function isHeaderNoise(line) {
    const low = line.toLowerCase();
    const hasPhone = PHONE_RE.test(line);
    const hasEmail = EMAIL_RE.test(line);
    if (!hasPhone && !hasEmail) {
      for (const noise of HEADER_NOISE) if (low.includes(noise)) return true;
    }
    if (line.length < 20 && !hasPhone && !hasEmail) return true;
    return false;
  }

  function scanText(text) {
    const normalizeRole = norm();
    const out = [];
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (isHeaderNoise(line)) continue;

      const m = ROLE_RE.exec(line);
      if (!m) continue;

      const hitRole = m[1].trim();
      const phones = line.match(PHONE_RE_G) || [];
      const emails = line.match(EMAIL_RE_G) || [];
      if (!phones.length && !emails.length) continue;

      let name = null;
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 3) {
        for (let i = 0; i < parts.length; i++) {
          if (ROLE_RE.test(parts[i])) {
            if (i + 1 < parts.length) {
              const candidate = parts[i + 1].trim();
              const looksPhone = new RegExp("^" + PHONE_RE.source).test(candidate);
              const looksEmail = new RegExp("^" + EMAIL_RE.source).test(candidate);
              if (!looksPhone && !looksEmail) name = candidate;
            }
            break;
          }
        }
      } else {
        let afterRole = line.slice(m.index + m[0].length).replace(/^[\s:|\-—\t]+/, "");
        let cutoff = afterRole.length;
        for (const p of phones) {
          const idx = afterRole.indexOf(p);
          if (idx >= 0) cutoff = Math.min(cutoff, idx);
        }
        for (const e of emails) {
          const idx = afterRole.indexOf(e);
          if (idx >= 0) cutoff = Math.min(cutoff, idx);
        }
        name = afterRole.slice(0, cutoff).replace(/[\s|\t\-—]+$/, "");
      }

      if (name) name = name.replace(/\([^)]*\)/g, "").replace(/^[\s|\t\-—]+|[\s|\t\-—]+$/g, "");

      const entry = {
        role: normalizeRole(hitRole),
        name: name || "",
        phone: phones.length ? phones[0].trim() : "",
        email: emails.length ? emails[0] : "",
        source_line: line.slice(0, 200),
      };
      if (entry.name || entry.phone || entry.email) out.push(entry);
    }
    return out;
  }

  async function fromArrayBuffer(buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const lines = [];
    wb.worksheets.forEach((ws) => {
      ws.eachRow({ includeEmpty: false }, (row) => {
        const cells = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
          let v = cell.value;
          if (v == null) return;
          if (typeof v === "object") {
            if (v.text) v = v.text;
            else if (v.result !== undefined) v = v.result;
            else if (v.richText) v = v.richText.map((t) => t.text).join("");
            else v = String(v);
          }
          const s = String(v).trim();
          if (s) cells.push(s);
        });
        if (cells.length) lines.push(cells.join(" | "));
      });
    });
    const candidates = scanText(lines.join("\n"));
    // De-dupe by (role, name)
    const seen = new Set();
    const deduped = [];
    for (const c of candidates) {
      const key = (c.role || "").toLowerCase() + "|" + (c.name || "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(c);
    }
    return { candidates: deduped };
  }

  window.CallSheetImporter = { scanText, fromArrayBuffer, normalizeRole: null };
})();

---
name: create-call-sheet
description: Interactively build a video production call sheet through a section-by-section interview, then generate a polished .xlsx (optionally .pdf). Use this skill whenever the user wants to create, fill out, draft, or put together a call sheet for a video shoot, photo shoot, commercial, documentary, or any kind of production — including phrasings like "make a call sheet", "I have a shoot next week", "let's build a call sheet for [client/project]", "I need a call sheet for [date/location]", or "draft a call sheet". Handles single-day and multi-day shoots, pulls crew from a local roster, looks up sunrise/sunset for the shoot city, and prompts to save new contacts for future shoots.
---

# Create Call Sheet

You are running an interactive interview to build a call sheet, then producing the final `.xlsx` (and optionally `.pdf`). The output matches a specific visual template the user already approved — your job is to collect answers and call `scripts/build_callsheet.py` to render it.

## Why this skill exists

Producers retype the same info every shoot: same crew, same client, same notes block, same boilerplate. This skill kills that friction by walking the user through the sheet section by section, pulling defaults from a local profile, and only asking for what's genuinely new each shoot. The final deliverable is the same polished workbook every time, but built from fresh answers, not by copy-pasting an old file.

Treat the user like a producer in a hurry. Keep questions tight. Never repeat what you've already learned. Move forward fast.

## Operating principles

- **One section at a time, in order.** Don't jump around. The order below mirrors how a producer thinks about a shoot.
- **Ask if the section is needed first.** Some shoots don't need wardrobe guidance, vendors, etc. Default to "yes, walk through it" but accept "skip" instantly.
- **Use the profile aggressively.** Recurring crew, client contacts, and the standard notes block should come from `profile.py read`, not from re-asking the user.
- **Honor user preferences.** The profile has a `preferences` list of free-form verification rules the user has set. Read them once at the start of the run and apply them throughout — e.g., a rule like "Crew dinners are unusual for me — verify before adding one" means you should push back if a dinner slot starts appearing in either the schedule or the meals section. Quote the rule when you push back so the user knows why.
- **Confirm in bulk, edit in detail.** Once you've drafted a section's data, summarize it back and ask "good?" rather than confirming each field one by one.
- **Save new entries** to the profile when the user introduces a new crew member, client, or vendor — prompt for it: "Save Brett (DP) to your roster for next time?"
- **Capture new preferences when they emerge.** If the user says something like "I almost never have X, double-check that next time" or "stop assuming Y" — offer to save it: `profile.py add-preference "..."`.
- **Never echo personal contact data into chat unnecessarily.** Show enough to confirm; don't dump the whole roster.

## Setup: profile + working directory

Before the first question, check whether the user has a profile configured:

```bash
python <skill-path>/scripts/profile.py status
```

If `profile_exists` is false, ask the user where to put their profile. Suggest the default (`~/.callsheet/profile.yaml`) and accept any path they prefer. Then:

```bash
python <skill-path>/scripts/profile.py set-path "<their chosen path>"
```

If they decline a profile entirely, proceed without one — every section just becomes "ask the user."

Once the profile is configured, load it and **read the `preferences` list now**. Keep these in mind throughout the walkthrough — they override generic defaults whenever they apply.

Also install dependencies if not already present (do this quietly, only first time):

```bash
pip install --quiet openpyxl astral pyyaml pdfplumber
```

## The walkthrough

Walk the user through these sections **in order**. For each, first ask "Need this section? (yes / skip / edit later)", then collect inputs only if yes.

### 1. Setup (always)

Collect:
- Project name
- Client (offer profile clients as quick picks)
- Production company
- Agency (optional)
- Job number / reference (optional)
- Number of shoot days

### 2. Per day — loop this N times

For each day, ask:
- Day label (default "Day X")
- Date (full: "Friday, February 6, 2026")
- City (for sunrise/sunset lookup)
- Crew call time
- Location: address line 1, line 2 (optional), city/state/ZIP
- Parking instructions
- Building access / load in instructions
- On-site emergency contacts (suggest reusing the director + producer from the contacts step if those have been collected)

**Auto-lookup: sunrise/sunset.** Once you have city + date:

```bash
python <skill-path>/scripts/sunrise_sunset.py "<city>" <YYYY-MM-DD>
```

If the city isn't in the database, ask the user for a nearby major city or skip.

**Auto-lookup: nearest hospital.** Once you have the location address, do a web search for "nearest hospital to <address>" and surface 1–3 candidates with name + address + phone. Ask the user to confirm one. If you can't find anything reliable, tell the user and ask them to fill it in.

**Weather:** leave blank in the answers object. The sheet includes a "Check weather →" hyperlink to Google for the user to fill in closer to the date.

**Schedule:** ask for time blocks. Accept them in any format ("8a–9a setup", "10:00 AM interview Dylan", etc.) and normalize. Suggest a sensible default skeleton (Crew arrives → Set up → Interview 1 → … → Wrap) and let the user edit. Aim for at least 8 blocks for a half/full day.

### 3. Contacts (shared across all days)

Pull `profile.py read` and surface crew by department. For each department:
- Show suggested contacts from the profile (e.g., "DP — Brett Bollier, +1 503... — use?")
- Ask: confirm, swap, add new, or skip
- For new contacts, prompt: "Save [name] (role) to your roster for next time?" If yes, call `profile.py add-crew '{...}'`

Departments in order: PRODUCTION, CAMERA, G&E, SOUND, ART, VANITIES, SUPPORT, CLIENT, AGENCY, TALENT / INTERVIEWEES, VENDORS. Skip any department the user says they don't need.

### 4. Wardrobe & styling (talent-facing)

Only ask if the shoot involves talent on camera. Pull defaults from profile if present; otherwise offer the template defaults:

- Recommended: "Solid colors that aren't pure white/black. Bring 2-3 options. Neutral, comfortable fit. Layers if outdoors."
- Avoid: "Tight patterns. Visible logos/branding. Pure white/black shirts. Loud jewelry. Strong fragrance."

Let the user edit either field.

### 5. Meals

For each meal (Breakfast, Lunch, Dinner, Crafty/Snacks, Water/Coffee): vendor, phone, time, notes. Most shoots only fill Lunch + Crafty. Skip the rest if the user says so. Always include the allergy reminder unless the user removes it.

### 6. Notes / rules

Load the standard notes block from the profile. Read it back to the user and ask: "Use as-is, or want to tweak for this shoot?" Edits are per-shoot, not saved to profile unless they explicitly say "update my default."

### 7. Invoicing

Job reference (default to the project's job number), send-to email, billing address, reimbursement notes. Pull defaults from profile if the production company matches.

### 8. Pre-save validation

Before building, scan the assembled `answers` object for missing critical fields:
- Project name
- Each day: date, crew call, location address, hospital
- At least one Production contact and one Camera contact

If anything's missing, list it and ask if the user wants to fill in now, leave as placeholder, or proceed anyway.

### 9. Save

Default output path comes from the user's config. If not set, ask:
- "Where should I save? (default: `~/Documents/Call Sheets/`)"
- "Filename pattern: `CALLSHEET_<Project>_<YYYY-MM-DD>.xlsx`"

Write the answers JSON to a temp path, then:

```bash
python <skill-path>/scripts/build_callsheet.py /tmp/answers.json "<output path>"
```

Tell the user where the file landed (use a `computer://` link if you're in Cowork).

### 10. PDF (opt-in)

Ask: "Export PDF too?" If yes:

```bash
python <skill-path>/scripts/export_pdf.py "<xlsx path>"
```

If LibreOffice isn't installed, tell the user how to install it (e.g., `brew install --cask libreoffice`) and offer to skip.

### 11. Profile updates (silent confirmation at the end)

Summarize: "Added these new contacts to your roster: …. Updated client defaults: …." Brief, one sentence.

## Importing contacts from a past sheet

If the user says "I have an old call sheet, can you pull the crew from it?" — yes:

```bash
python <skill-path>/scripts/import_contacts.py "<path to old sheet>"
```

Returns a JSON of `candidates`. Show them to the user, ask which to keep, then add each kept entry via `profile.py add-crew`. Always confirm; the parser is heuristic and will surface noise alongside real contacts.

## Data contract: `answers` JSON

The builder consumes a JSON object with this shape (see `examples/sample_answers.json` for a complete realistic example):

```
{
  "shared": {
    "project_name": "...",
    "client": "...",
    "production_company": "...",
    "agency": "...",
    "job_number": "...",
    "contacts_by_department": { "PRODUCTION": [...], "CAMERA": [...], ... },
    "wardrobe": { "recommended": "...", "avoid": "..." },
    "meals": { "breakfast": {...}, "lunch": {...}, ... , "allergies": "..." },
    "notes_block": ["...", "..."],
    "invoicing": { "job_reference": "...", "send_to": "...", "billing_address": "...", "notes": "..." }
  },
  "days": [
    {
      "tab_name": "Day 1",
      "date_label": "Friday, February 6, 2026",
      "city_for_lookup": "London",
      "crew_call": "8:00 AM",
      "location": { "address_line_1": "...", "address_line_2": "...", "city_state_zip": "..." },
      "hospital": { "name": "...", "address": "...", "phone": "..." },
      "first_shot": "10:00 AM",
      "wrap": "6:00 PM",
      "lunch": "12:00 PM",
      "sunrise": "7:25 AM",
      "sunset": "5:02 PM",
      "weather": "",
      "parking": "...",
      "building_access": "...",
      "on_site_contacts": [{"name":"...","role":"...","phone":"..."}, ...],
      "schedule": [{"time":"...","activity":"...","location":"...","talent":"...","notes":"..."}, ...]
    }
  ]
}
```

Anything optional can be omitted or empty-string. The builder draws section banners and skips empty optional sections to keep the sheet clean.

## When NOT to use this skill

- The user wants to *edit* an existing call sheet, not build a new one. (In that case, edit the .xlsx directly.)
- The user wants a one-off summary email, Slack message, or PDF only — no spreadsheet involved.
- The user wants only contact-list management (just call `profile.py` directly).

## Reference

- `scripts/build_callsheet.py` — renders the workbook from answers JSON
- `scripts/profile.py` — local profile (crew, clients, notes block)
- `scripts/sunrise_sunset.py` — astral-based daylight lookup
- `scripts/import_contacts.py` — extracts crew from a past sheet (.pdf or .xlsx)
- `scripts/export_pdf.py` — xlsx → pdf via LibreOffice
- `examples/sample_answers.json` — complete reference of the data contract

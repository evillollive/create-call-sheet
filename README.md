# create-call-sheet

A Copilot agent skill that interactively builds professional video-production call sheets. It walks the user through a section-by-section interview — project info, locations, schedule, crew, meals, wardrobe, notes, invoicing — then renders a polished `.xlsx` workbook (and optionally `.pdf`).

> There's also a **no-AI browser version** in [`web/`](web/) that produces the same
> workbook entirely client-side and deploys to GitHub Pages. [Jump to the web app →](#web-app-no-ai-runs-in-the-browser)

## Quick start

### Prerequisites

- Python 3.10+

```bash
pip install -r requirements.txt
```

## How it works

The agent invokes the scripts in `create-call-sheet/scripts/`:

| Script | Purpose |
|---|---|
| `build_callsheet.py` | Renders the `.xlsx` workbook from a JSON answers object |
| `profile.py` | Manages the user's local profile (crew roster, clients, notes, preferences) |
| `sunrise_sunset.py` | Offline sunrise/sunset lookup via the `astral` library |
| `import_contacts.py` | Extracts crew contacts from a past call sheet (`.xlsx` or `.pdf`) with automatic role normalization (DP, PA, HMU, etc.) |
| `address_lookup.py` | Address autocomplete via Photon/OpenStreetMap (free, no API key) |
| `export_pdf.py` | Converts `.xlsx` → `.pdf` via LibreOffice (optional) |

### Key features

- **Google Maps hyperlinks** — Location and hospital cells in the exported spreadsheet are clickable links that open in Google Maps
- **Role normalization** — Standard abbreviations (DP, PA, HMU, AC, EP, G&E) are always uppercase; "hair & makeup" → HMU; "grip" → G&E department
- **Address autocomplete** — Validate and complete addresses using OpenStreetMap data via the Photon API (free, no API key, no data stored remotely)
- **Weather support** — Weather field included in the quick-info ribbon of each day tab

## Repo structure

```
create-call-sheet/
├── create-call-sheet/
│   ├── SKILL.md          # Full skill definition (the agent reads this)
│   ├── README.md         # Skill-level readme
│   ├── scripts/          # Python scripts the agent calls
│   │   ├── build_callsheet.py
│   │   ├── profile.py
│   │   ├── sunrise_sunset.py
│   │   ├── import_contacts.py
│   │   ├── address_lookup.py
│   │   └── export_pdf.py
│   └── examples/         # Sample answers JSON + output xlsx
├── web/                  # Browser app (no AI, no server) — see below
├── tests/                # Unit tests
├── requirements.txt      # Python dependencies
└── README.md             # This file
```

## Web app (no AI, runs in the browser)

`web/` is a standalone, fully client-side version of the skill. Instead of an AI
interview it uses a guided form, and it renders the **exact same styled `.xlsx`**
via a JavaScript port of `build_callsheet.py` (using [ExcelJS](https://github.com/exceljs/exceljs),
vendored locally). Everything runs in the browser — no build step, no backend, no
API keys, and no data leaves the machine except the two optional lookups below.

### Features

- **Same workbook output** — one tab per shoot day plus a "How to use" tab, with
  Google Maps hyperlinks, striped schedule, department contacts, meals, and a
  production report block. Output verified cell-for-cell against the Python builder.
- **Local profile & roster** — crew, clients, notes, and preferences are saved in
  `localStorage` and reusable across call sheets.
- **Import from a past call sheet** — drop in a previous `.xlsx` to pull in contacts
  with automatic role normalization (DP, PA, HMU, G&E, …).
- **Optional free lookups (no key)** — address autocomplete via
  [Photon/OpenStreetMap](https://photon.komoot.io) and sunrise/sunset via
  [Open-Meteo](https://open-meteo.com). Both are optional; manual entry always works.
- **Accessible & hardened** — passes axe-core (WCAG 2.0/2.1 A & AA, 0 violations)
  and ships a strict Content-Security-Policy.

### Run locally

```bash
cd web
python3 -m http.server 8000
# open http://localhost:8000
```

Or open with any static file server. Click **Load sample** to see a complete example.

### Deploy to GitHub Pages

A workflow at `.github/workflows/pages.yml` publishes `web/` to GitHub Pages on every
push to `main`. To enable it once: in the repo, go to **Settings → Pages → Build and
deployment → Source** and select **GitHub Actions**. After the next push the app is
live at `https://<owner>.github.io/<repo>/`.

## Running tests

```bash
python -m pytest tests/ -v
```

## License

See [LICENSE](LICENSE).

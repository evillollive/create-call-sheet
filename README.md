# create-call-sheet

A Copilot agent skill that interactively builds professional video-production call sheets. It walks the user through a section-by-section interview — project info, locations, schedule, crew, meals, wardrobe, notes, invoicing — then renders a polished `.xlsx` workbook (and optionally `.pdf`).

## Quick start

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
├── tests/                # Unit tests
├── requirements.txt      # Python dependencies
└── README.md             # This file
```

## Running tests

```bash
python -m pytest tests/ -v
```

## License

See [LICENSE](LICENSE).

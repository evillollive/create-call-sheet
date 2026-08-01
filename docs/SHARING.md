# Sharing create-call-sheet

Use this checklist and copy when introducing `create-call-sheet` to producers, videographers, filmmakers, production managers, and people looking for a practical call sheet generator.

## Positioning

`create-call-sheet` builds polished video and film production call sheets without starting from a blank spreadsheet. It has two entry points: a Copilot agent skill that interviews the producer section by section, and a no-AI browser app that runs locally and exports the same styled `.xlsx` workbook.

Best short description:

> A local-first call sheet generator for small production teams: guided form or Copilot skill in, polished `.xlsx` call sheet out.

## Launch checklist

- [ ] Confirm the README badges are green.
- [ ] Confirm the hosted web app opens at `https://evillollive.github.io/create-call-sheet/`.
- [ ] Click **Load sample** in the web app and generate a sample `.xlsx`.
- [ ] Run `python3 -m pytest tests/ -v`.
- [ ] Verify repository description and topics are set.
- [ ] Pin or feature the generated preview image in posts.
- [ ] Share both the web app and GitHub repo link.
- [ ] Ask early users whether they want PDF-first export, editable templates, or integrations.

## Suggested repo description and topics

Description:

> Local-first call sheet generator for video and film shoots: guided browser app plus Copilot skill, exports polished .xlsx workbooks.

Topics:

```text
call-sheet
film-production
video-production
production-management
xlsx
spreadsheet
github-copilot
copilot-skill
static-web-app
local-first
```

## Demo script

1. Open the browser app.
2. Say: "This runs entirely in your browser. No account, no backend, and the profile stays in local storage."
3. Click **Load sample**.
4. Point out the flow: project, shoot days, contacts, wardrobe, meals, notes, invoicing.
5. Add one schedule row or contact to show the form is editable.
6. Use the address or sunrise/sunset lookup only if you want to show optional external lookups.
7. Click **Generate .xlsx**.
8. Open the workbook and show the day tab, at-a-glance cards, schedule, department contacts, notes, and production report block.
9. Close with: "The same workbook can be generated through the Copilot skill if you prefer an interview-style assistant."

## Where to share

- Production communities: filmmaker Slack or Discord groups, local production Facebook groups, producer forums, and indie filmmaker communities.
- Technical communities: GitHub, Hacker News, Lobsters, dev.to, personal blog, LinkedIn, and X.
- Practical search channels: posts titled around "call sheet generator", "production call sheet template", "video shoot call sheet", and "film call sheet spreadsheet".
- Direct outreach: producers, DPs, production coordinators, small agencies, documentary teams, and creator teams that repeatedly make one-day or multi-day shoot sheets.

## Short social post

```text
I made create-call-sheet: a local-first call sheet generator for video and film shoots.

Use the browser app with no account or backend, or use it as a Copilot skill for an interview-style workflow. It exports a polished .xlsx with shoot days, contacts, schedule, maps links, notes, meals, and invoicing.

https://github.com/evillollive/create-call-sheet
```

## Technical post

```text
create-call-sheet is a small local-first production tool with two front doors:

1. A Copilot agent skill that interviews the producer section by section.
2. A static browser app that runs with no backend, no build step, and no account.

Both routes produce a styled .xlsx call sheet with one tab per shoot day, an at-a-glance block, schedule, department contacts, location and hospital maps links, meals, notes, invoicing, and a production report section.

The Python builder is covered by pytest, the browser app uses a JavaScript port with vendored ExcelJS, profile data stays local, and optional lookups use Photon/OpenStreetMap plus Open-Meteo.

Repo: https://github.com/evillollive/create-call-sheet
App: https://evillollive.github.io/create-call-sheet/
```

## Show HN draft

```text
Show HN: Local-first call sheet generator for video and film shoots

I built create-call-sheet to remove the recurring spreadsheet work behind small production call sheets.

It has a no-AI browser app that runs locally and exports a polished .xlsx, plus a Copilot skill for people who prefer an interview-style assistant. It handles multi-day shoots, crew and department contacts, schedules, location and nearest hospital blocks with maps links, wardrobe, meals, notes, invoicing, and optional PDF export through LibreOffice.

There is no backend, no account, and no analytics. Browser profile data stays in localStorage. Optional address and daylight lookups call free public APIs only when requested.

Repo: https://github.com/evillollive/create-call-sheet
App: https://evillollive.github.io/create-call-sheet/
```

## Trust and safety language

Use this when people ask where production data goes:

> The browser app is static and local-first. Profile data stays in browser localStorage. There is no backend account, analytics pipeline, or uploaded call sheet. Address autocomplete and sunrise/sunset are optional lookups, and manual entry works for every field.

For sensitive shoots, recommend running the app locally and skipping optional external lookups.

## Follow-up backlog

- Record a short GIF or 60-second video that starts with **Load sample** and ends with the generated workbook.
- Add screenshots of the actual generated workbook once sanitized sample contact data is available.
- Add a hosted "download sample workbook" link from the Pages app.
- Add a short producer-facing FAQ about offline use, sensitive shoots, and PDF export.
- Add template customization options for teams with house styles.
- Add a printable one-page quick start for non-technical production teams.

"""Extract crew/client/talent contact entries from a past call sheet.

Accepts .xlsx (the format we produce) or .pdf (from other producers' sheets).
Returns a JSON blob the agent can review with the user before merging into the
local profile via profile.py.

Heuristic, not magic. The PDF parser scans for common patterns (Position/Name/
Phone/Email columns or labeled rows) and surfaces what it finds. The agent
should always show the results to the user and ask which to keep.

Usage:
    python import_contacts.py path/to/past_call_sheet.pdf
    python import_contacts.py path/to/past_call_sheet.xlsx

Output is a JSON object:
    {
      "source": "...",
      "candidates": [
        {"role": "DP", "name": "...", "phone": "...", "email": "..."}
      ]
    }
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path


PHONE_RE = re.compile(
    r"(\+?\d[\d\-.\s()]{7,}\d)"
)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# Role keywords we'll watch for at the start of a line/cell
ROLE_HINTS = [
    "director", "producer", "ep ", "executive producer", "line producer",
    "production manager", "field producer", "dp", "director of photography",
    "1st ac", "2nd ac", "ac ", "focus puller", "gaffer", "key grip",
    "swing", "best boy", "electrician", "sound", "boom",
    "hmu", "hair", "makeup", "wardrobe", "stylist",
    "art director", "production designer", "set dresser",
    "pa", "production assistant", "driver", "teleprompter",
    "fixer", "local producer", "casting",
    "talent", "interviewee", "host", "presenter",
    "client", "agency", "creative director", "account",
]


def _scan_text(text: str, source: str) -> list[dict]:
    """Walk lines and try to pair role + name + phone + email."""
    out = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        low = line.lower()
        hit_role = next((kw for kw in ROLE_HINTS if low.startswith(kw) or f" {kw} " in low[:40]), None)
        if not hit_role:
            continue
        phones = PHONE_RE.findall(line)
        emails = EMAIL_RE.findall(line)
        # Try to peel out a name: take text between role and phone/email
        name = None
        # Strip role + colon/dash
        role_label = hit_role.strip()
        try:
            after_role = line.lower().split(role_label, 1)[1]
            # original case version
            after_role_orig = line[len(line) - len(after_role):]
            # Remove leading punctuation
            after_role_orig = after_role_orig.lstrip(" :|-—\t")
            # Cut off at first phone/email
            cutoff = len(after_role_orig)
            for p in phones:
                idx = after_role_orig.find(p)
                if idx >= 0:
                    cutoff = min(cutoff, idx)
            for e in emails:
                idx = after_role_orig.find(e)
                if idx >= 0:
                    cutoff = min(cutoff, idx)
            name = after_role_orig[:cutoff].strip(" |\t-—")
            # Strip parenthetical pronouns
            name = re.sub(r"\([^)]*\)", "", name).strip()
        except Exception:
            pass
        entry = {
            "role": role_label.title(),
            "name": name or "",
            "phone": phones[0] if phones else "",
            "email": emails[0] if emails else "",
            "source_line": line[:200],
        }
        if entry["name"] or entry["phone"] or entry["email"]:
            out.append(entry)
    return out


def _from_pdf(path: Path) -> list[dict]:
    try:
        import pdfplumber  # type: ignore
    except ImportError:
        sys.stderr.write("pdfplumber required. Install with: pip install pdfplumber\n")
        sys.exit(2)
    text_parts = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            text_parts.append(t)
    return _scan_text("\n".join(text_parts), str(path))


def _from_xlsx(path: Path) -> list[dict]:
    try:
        from openpyxl import load_workbook  # type: ignore
    except ImportError:
        sys.stderr.write("openpyxl required.\n")
        sys.exit(2)
    wb = load_workbook(str(path), data_only=True)
    lines = []
    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            cells = [str(c) for c in row if c is not None and str(c).strip()]
            if cells:
                lines.append(" | ".join(cells))
    return _scan_text("\n".join(lines), str(path))


def extract(path: str | Path) -> dict:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(p)
    if p.suffix.lower() == ".pdf":
        cands = _from_pdf(p)
    elif p.suffix.lower() in (".xlsx", ".xlsm"):
        cands = _from_xlsx(p)
    else:
        raise ValueError(f"Unsupported file type: {p.suffix}")

    # De-dupe by (role, name) pair
    seen = set()
    deduped = []
    for c in cands:
        key = (c.get("role", "").lower(), c.get("name", "").lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)

    return {"source": str(p), "candidates": deduped}


def main(argv: list[str]) -> int:
    if not argv:
        sys.stderr.write("Usage: import_contacts.py <file.pdf|.xlsx>\n")
        return 2
    print(json.dumps(extract(argv[0]), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

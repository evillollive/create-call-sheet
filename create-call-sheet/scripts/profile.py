"""Local profile manager for the Create Call Sheet skill.

The profile holds the user's personal/recurring data: crew roster, client
defaults, and the standard notes/rules block. It lives outside the repo, in a
location the user chose on first run. Never committed, never uploaded.

Config file:
  ~/.callsheet-config.json  ->  {"profile_path": "<absolute path>"}

Profile file (YAML, at profile_path):
  crew:
    - { role: "DP", name: "...", phone: "...", email: "...", pronouns: "..." }
  clients:
    - { name: "GitHub", contacts: [{name, role, phone, email}, ...] }
  notes_block:
    - "Confidentiality: ..."
    - "Social media: ..."

Usage from agent (via Bash):
    python scripts/profile.py status
    python scripts/profile.py set-path "/Users/alex/.callsheet/profile.yaml"
    python scripts/profile.py read
    python scripts/profile.py add-crew '{"role":"DP","name":"Brett",...}'
    python scripts/profile.py add-client '{"name":"GitHub","contacts":[...]}'
    python scripts/profile.py add-preference "Crew dinners are unusual — verify before adding."
    python scripts/profile.py remove-preference "<exact string>"
"""
from __future__ import annotations
import json
import os
import sys
from pathlib import Path

try:
    import yaml  # type: ignore
except ImportError:
    yaml = None  # The agent should `pip install pyyaml` on first use


CONFIG_PATH = Path.home() / ".callsheet-config.json"
DEFAULT_PROFILE_SUGGESTION = Path.home() / ".callsheet" / "profile.yaml"


def _empty_profile() -> dict:
    return {
        "crew": [],
        "clients": [],
        "notes_block": [
            "Confidentiality: this call sheet and all on-set content are confidential. Do not share externally.",
            "Social media: NO posts, photos, or video from set without Producer approval.",
            "Closed set: no visitors without prior approval from Producer.",
            "Health & safety: dial 911 in any emergency. Nearest hospital listed above.",
            "Respect the location: no smoking/vaping inside, follow all venue rules, leave it cleaner than we found it.",
            "Sustainability: bring a reusable water bottle. Follow local laws for sorting refuse.",
        ],
        # Personal verification rules the skill should consult before each section.
        # Free-form strings — the agent reads these and treats each as guidance for the walkthrough.
        # Examples:
        #   "Crew dinners are unusual for me — verify before adding one to the schedule or meals."
        #   "I almost never have an Agency, skip that block unless I bring it up."
        "preferences": [],
    }


def load_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def save_config(cfg: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))


def get_profile_path() -> Path | None:
    cfg = load_config()
    p = cfg.get("profile_path")
    return Path(p) if p else None


def set_profile_path(path: str) -> Path:
    """Set the user-chosen profile path and seed an empty profile if missing."""
    p = Path(path).expanduser().resolve()
    p.parent.mkdir(parents=True, exist_ok=True)
    if not p.exists():
        _write_profile(p, _empty_profile())
    save_config({"profile_path": str(p)})
    return p


def _require_yaml():
    if yaml is None:
        sys.stderr.write(
            "PyYAML is required. Install with: pip install pyyaml\n"
        )
        sys.exit(2)


def _read_profile(path: Path) -> dict:
    _require_yaml()
    if not path.exists():
        return _empty_profile()
    with path.open() as f:
        data = yaml.safe_load(f) or {}
    base = _empty_profile()
    base.update({k: data.get(k, v) for k, v in base.items()})
    return base


def _write_profile(path: Path, data: dict) -> None:
    _require_yaml()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True)


def read_profile() -> dict:
    p = get_profile_path()
    if not p:
        return _empty_profile()
    return _read_profile(p)


def write_profile(data: dict) -> None:
    p = get_profile_path()
    if not p:
        raise RuntimeError("Profile path not configured. Run: profile.py set-path <path>")
    _write_profile(p, data)


def add_crew(entry: dict) -> None:
    """Add or update a crew member, keyed by (role, name)."""
    data = read_profile()
    crew = data.setdefault("crew", [])
    key = (entry.get("role", "").lower(), entry.get("name", "").lower())
    for i, c in enumerate(crew):
        if (c.get("role", "").lower(), c.get("name", "").lower()) == key:
            crew[i] = {**c, **entry}
            write_profile(data)
            return
    crew.append(entry)
    write_profile(data)


def add_client(entry: dict) -> None:
    """Add or update a client, keyed by name."""
    data = read_profile()
    clients = data.setdefault("clients", [])
    name = entry.get("name", "").lower()
    for i, c in enumerate(clients):
        if c.get("name", "").lower() == name:
            existing_contacts = c.get("contacts", [])
            new_contacts = entry.get("contacts", [])
            seen = {(x.get("name", "").lower(), x.get("role", "").lower()) for x in existing_contacts}
            for x in new_contacts:
                k = (x.get("name", "").lower(), x.get("role", "").lower())
                if k not in seen:
                    existing_contacts.append(x)
            c["contacts"] = existing_contacts
            write_profile(data)
            return
    clients.append(entry)
    write_profile(data)


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return 0

    cmd, *rest = argv

    if cmd == "status":
        cfg = load_config()
        p = get_profile_path()
        print(json.dumps({
            "config_path": str(CONFIG_PATH),
            "config_exists": CONFIG_PATH.exists(),
            "profile_path": str(p) if p else None,
            "profile_exists": p.exists() if p else False,
            "suggested_default": str(DEFAULT_PROFILE_SUGGESTION),
        }, indent=2))
        return 0

    if cmd == "set-path":
        if not rest:
            sys.stderr.write("Usage: profile.py set-path <path>\n")
            return 2
        p = set_profile_path(rest[0])
        print(json.dumps({"profile_path": str(p), "created": True}))
        return 0

    if cmd == "read":
        print(json.dumps(read_profile(), indent=2, ensure_ascii=False))
        return 0

    if cmd == "add-crew":
        if not rest:
            sys.stderr.write('Usage: profile.py add-crew \'{"role":"...","name":"...",...}\'\n')
            return 2
        entry = json.loads(rest[0])
        add_crew(entry)
        print(json.dumps({"added": entry}))
        return 0

    if cmd == "add-client":
        if not rest:
            sys.stderr.write('Usage: profile.py add-client \'{"name":"...","contacts":[...]}\'\n')
            return 2
        entry = json.loads(rest[0])
        add_client(entry)
        print(json.dumps({"added": entry}))
        return 0

    if cmd == "add-preference":
        if not rest:
            sys.stderr.write('Usage: profile.py add-preference "<text>"\n')
            return 2
        text = rest[0].strip()
        data = read_profile()
        prefs = data.setdefault("preferences", [])
        if text not in prefs:
            prefs.append(text)
            write_profile(data)
        print(json.dumps({"added": text, "preferences": prefs}))
        return 0

    if cmd == "remove-preference":
        if not rest:
            sys.stderr.write('Usage: profile.py remove-preference "<exact text>"\n')
            return 2
        text = rest[0].strip()
        data = read_profile()
        prefs = data.get("preferences", [])
        prefs = [p for p in prefs if p != text]
        data["preferences"] = prefs
        write_profile(data)
        print(json.dumps({"removed": text, "preferences": prefs}))
        return 0

    sys.stderr.write(f"Unknown command: {cmd}\n")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

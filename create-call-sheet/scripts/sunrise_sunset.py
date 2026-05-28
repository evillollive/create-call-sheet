"""Sunrise / sunset lookup for a given city and date.

Uses the `astral` library, which works offline (no API, no key) for any city
in its built-in database. For cities not in the database, it accepts explicit
lat/long coordinates.

Usage:
    python sunrise_sunset.py "London" 2026-05-27
    python sunrise_sunset.py --lat 47.6062 --lon -122.3321 --tz "America/Los_Angeles" 2026-05-27

Output (JSON):
    {"sunrise": "05:37 AM", "sunset": "08:18 PM", "city": "...", "date": "..."}
"""
from __future__ import annotations
import argparse
import json
import sys
from datetime import date, datetime

try:
    from astral import LocationInfo
    from astral.geocoder import lookup, database
    from astral.sun import sun
except ImportError:
    sys.stderr.write(
        "astral is required. Install with: pip install astral\n"
    )
    sys.exit(2)

try:
    import zoneinfo
except ImportError:
    sys.stderr.write("Python 3.9+ required (zoneinfo)\n")
    sys.exit(2)


def _fmt(dt: datetime) -> str:
    s = dt.strftime("%I:%M %p")
    return s.lstrip("0")


def lookup_by_city(city: str, when: date) -> dict:
    try:
        loc = lookup(city, database())
    except KeyError:
        raise ValueError(
            f"City '{city}' not in astral's built-in database. "
            f"Pass --lat/--lon/--tz instead, or pick a nearby major city."
        )
    s = sun(loc.observer, date=when, tzinfo=loc.tzinfo)
    return {
        "city": loc.name,
        "region": loc.region,
        "timezone": str(loc.tzinfo),
        "date": when.isoformat(),
        "sunrise": _fmt(s["sunrise"]),
        "sunset": _fmt(s["sunset"]),
    }


def lookup_by_coords(lat: float, lon: float, tz: str, when: date, label: str | None = None) -> dict:
    loc = LocationInfo(name=label or "Custom", region="", timezone=tz, latitude=lat, longitude=lon)
    s = sun(loc.observer, date=when, tzinfo=zoneinfo.ZoneInfo(tz))
    return {
        "city": loc.name,
        "region": loc.region,
        "timezone": tz,
        "date": when.isoformat(),
        "sunrise": _fmt(s["sunrise"]),
        "sunset": _fmt(s["sunset"]),
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Sunrise/sunset lookup.")
    p.add_argument("city_or_date", nargs="?", help="City name (when not using coords) or the date if coords given")
    p.add_argument("date", nargs="?", help="Date YYYY-MM-DD (if city was first arg)")
    p.add_argument("--lat", type=float)
    p.add_argument("--lon", type=float)
    p.add_argument("--tz", help="e.g. America/Los_Angeles")
    p.add_argument("--label", help="Optional label when using coords")
    args = p.parse_args()

    # Parse date
    if args.lat is not None or args.lon is not None:
        if args.lat is None or args.lon is None or not args.tz:
            sys.stderr.write("--lat, --lon, and --tz are required together\n")
            return 2
        if not args.city_or_date:
            sys.stderr.write("Date is required\n")
            return 2
        when = datetime.fromisoformat(args.city_or_date).date()
        result = lookup_by_coords(args.lat, args.lon, args.tz, when, args.label)
    else:
        if not args.city_or_date or not args.date:
            sys.stderr.write("Usage: sunrise_sunset.py <city> <YYYY-MM-DD>\n")
            return 2
        when = datetime.fromisoformat(args.date).date()
        try:
            result = lookup_by_city(args.city_or_date, when)
        except ValueError as e:
            sys.stderr.write(str(e) + "\n")
            return 1

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

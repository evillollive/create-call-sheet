"""Look up addresses using the Photon geocoding API (OpenStreetMap data).

Free, no API key required. The agent can call this when the user enters a
location or hospital address to suggest the full, validated address.

Usage:
    python address_lookup.py "123 Main St, Portland"
    python address_lookup.py "hospital near 235 Euston Rd London"

Output is a JSON object:
    {
      "query": "...",
      "results": [
        {
          "name": "...",
          "address_line_1": "...",
          "address_line_2": "",
          "city_state_zip": "...",
          "full_address": "...",
          "lat": 51.52,
          "lon": -0.13,
          "maps_url": "https://www.google.com/maps/search/..."
        }
      ]
    }

All processing is local except the single HTTPS request to photon.komoot.io.
No data is stored remotely; Photon does not require authentication or track users.
"""
from __future__ import annotations
import json
import sys
import urllib.request
import urllib.parse


PHOTON_API = "https://photon.komoot.io/api/"


def lookup(query: str, limit: int = 5) -> dict:
    """Query the Photon API and return structured address results."""
    params = urllib.parse.urlencode({"q": query, "limit": limit})
    url = f"{PHOTON_API}?{params}"

    req = urllib.request.Request(url, headers={"User-Agent": "create-call-sheet/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    results = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        coords = feature.get("geometry", {}).get("coordinates", [None, None])

        # Build address components
        name = props.get("name", "")
        house_number = props.get("housenumber", "")
        street = props.get("street", "")
        city = props.get("city", "") or props.get("locality", "")
        state = props.get("state", "")
        postcode = props.get("postcode", "")
        country = props.get("country", "")

        # Compose address line 1
        if house_number and street:
            address_line_1 = f"{house_number} {street}"
        elif street:
            address_line_1 = street
        elif name:
            address_line_1 = name
        else:
            address_line_1 = ""

        # City, State ZIP
        parts = [p for p in [city, state] if p]
        city_state = ", ".join(parts)
        city_state_zip = f"{city_state} {postcode}".strip() if postcode else city_state

        # Full address for display
        full_parts = [p for p in [address_line_1, city_state_zip, country] if p]
        full_address = ", ".join(full_parts)

        # Google Maps URL
        maps_query = full_address or query
        maps_url = f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(maps_query)}"

        results.append({
            "name": name,
            "address_line_1": address_line_1,
            "address_line_2": "",
            "city_state_zip": city_state_zip,
            "full_address": full_address,
            "lat": coords[1] if len(coords) > 1 else None,
            "lon": coords[0] if len(coords) > 0 else None,
            "maps_url": maps_url,
        })

    return {"query": query, "results": results}


def main(argv: list[str]) -> int:
    if not argv:
        sys.stderr.write("Usage: address_lookup.py <query>\n")
        return 2
    query = " ".join(argv)
    result = lookup(query)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

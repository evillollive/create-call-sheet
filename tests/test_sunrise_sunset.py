"""Tests for sunrise_sunset.py — offline daylight lookup."""
import json
import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "create-call-sheet" / "scripts"))

import sunrise_sunset


class TestLookupByCity:
    def test_known_city(self):
        result = sunrise_sunset.lookup_by_city("London", date(2026, 6, 21))
        assert result["city"] == "London"
        assert "AM" in result["sunrise"]
        assert "PM" in result["sunset"]
        assert result["date"] == "2026-06-21"

    def test_unknown_city(self):
        with pytest.raises(ValueError, match="not in astral"):
            sunrise_sunset.lookup_by_city("Nowheresville", date(2026, 1, 1))


class TestLookupByCoords:
    def test_seattle_coords(self):
        result = sunrise_sunset.lookup_by_coords(
            47.6062, -122.3321, "America/Los_Angeles", date(2026, 3, 15), "Seattle"
        )
        assert result["city"] == "Seattle"
        assert result["timezone"] == "America/Los_Angeles"
        assert "AM" in result["sunrise"]
        assert "PM" in result["sunset"]


class TestCLI:
    def test_city_date_args(self, capsys):
        rc = sunrise_sunset.main.__wrapped__() if hasattr(sunrise_sunset.main, "__wrapped__") else None
        # Use sys.argv simulation
        with pytest.MonkeyPatch.context() as m:
            m.setattr(sys, "argv", ["sunrise_sunset.py", "London", "2026-06-21"])
            rc = sunrise_sunset.main()
        assert rc == 0
        out = json.loads(capsys.readouterr().out)
        assert out["city"] == "London"

    def test_missing_args(self, capsys):
        with pytest.MonkeyPatch.context() as m:
            m.setattr(sys, "argv", ["sunrise_sunset.py"])
            rc = sunrise_sunset.main()
        assert rc == 2

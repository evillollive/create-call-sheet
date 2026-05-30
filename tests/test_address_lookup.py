"""Tests for address_lookup.py — Photon/OpenStreetMap geocoding."""
import json
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "create-call-sheet" / "scripts"))

import address_lookup


SAMPLE_PHOTON_RESPONSE = json.dumps({
    "features": [
        {
            "geometry": {"coordinates": [-0.1340, 51.5246], "type": "Point"},
            "properties": {
                "name": "Greater London House",
                "housenumber": "",
                "street": "Hampstead Rd",
                "city": "London",
                "state": "England",
                "postcode": "NW1 7FB",
                "country": "United Kingdom",
            },
        },
        {
            "geometry": {"coordinates": [-122.6784, 45.5152], "type": "Point"},
            "properties": {
                "name": "",
                "housenumber": "123",
                "street": "Main St",
                "city": "Portland",
                "state": "Oregon",
                "postcode": "97201",
                "country": "United States",
            },
        },
    ]
}).encode("utf-8")


class TestLookup:
    @patch("address_lookup.urllib.request.urlopen")
    def test_returns_structured_results(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = SAMPLE_PHOTON_RESPONSE
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        result = address_lookup.lookup("Greater London House London")
        assert result["query"] == "Greater London House London"
        assert len(result["results"]) == 2

        first = result["results"][0]
        assert first["name"] == "Greater London House"
        assert "London" in first["city_state_zip"]
        assert "google.com/maps" in first["maps_url"]
        assert first["lat"] == pytest.approx(51.5246)
        assert first["lon"] == pytest.approx(-0.1340)

    @patch("address_lookup.urllib.request.urlopen")
    def test_address_line_from_house_number_and_street(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = SAMPLE_PHOTON_RESPONSE
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        result = address_lookup.lookup("123 Main St Portland")
        second = result["results"][1]
        assert second["address_line_1"] == "123 Main St"
        assert "Portland" in second["city_state_zip"]
        assert "97201" in second["city_state_zip"]

    @patch("address_lookup.urllib.request.urlopen")
    def test_empty_response(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({"features": []}).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        result = address_lookup.lookup("nonexistent place")
        assert result["results"] == []

    def test_cli_no_args(self):
        assert address_lookup.main([]) == 2

"""Tests for import_contacts.py — contact extraction from past sheets."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "create-call-sheet" / "scripts"))

import import_contacts


SAMPLE_XLSX = Path(__file__).resolve().parent.parent / "create-call-sheet" / "examples" / "sample_output.xlsx"


class TestScanText:
    """Test the core heuristic parser."""

    def test_extracts_contact_with_phone(self):
        text = "DP | Brett Bollier | +1 503-866-5518 | brett@example.com"
        results = import_contacts._scan_text(text, "test")
        assert len(results) >= 1
        dp = next(r for r in results if r["role"] == "Dp")
        assert dp["name"] == "Brett Bollier"
        assert "503" in dp["phone"]
        assert dp["email"] == "brett@example.com"

    def test_rejects_header_lines(self):
        headers = [
            "CALL SHEET",
            "AT A GLANCE",
            "PARKING | BUILDING ACCESS / LOAD IN",
            "WARDROBE & STYLING GUIDANCE (FOR TALENT)",
            "TALENT / INTERVIEWEES",
            "MEALS  •  CRAFTY  •  ALLERGIES",
        ]
        for h in headers:
            results = import_contacts._scan_text(h, "test")
            assert results == [], f"Should reject header: {h!r}"

    def test_rejects_lines_without_contact_info(self):
        text = "Producer — needs to confirm by Friday"
        results = import_contacts._scan_text(text, "test")
        assert results == []

    def test_multiple_contacts(self):
        text = (
            "Director | Alex | +1 206-555-0001 | alex@example.com\n"
            "Gaffer | Al Rice | +44 7917 606621 | al@example.com\n"
            "Some random line about parking\n"
            "Swing | Declan | +44 7470 366961\n"
        )
        results = import_contacts._scan_text(text, "test")
        roles = [r["role"] for r in results]
        assert "Director" in roles
        assert "Gaffer" in roles
        assert "Swing" in roles
        assert len(results) == 3

    def test_pa_does_not_match_parking(self):
        text = "PARKING | Street parking available"
        results = import_contacts._scan_text(text, "test")
        assert results == []

    def test_pa_matches_production_assistant(self):
        text = "Production Assistant | Jamie | +1 555-123-4567"
        results = import_contacts._scan_text(text, "test")
        assert len(results) == 1
        assert results[0]["role"] == "Production Assistant"


class TestFromXlsx:
    @pytest.mark.skipif(not SAMPLE_XLSX.exists(), reason="sample_output.xlsx not found")
    def test_extracts_from_sample(self):
        result = import_contacts.extract(str(SAMPLE_XLSX))
        assert "candidates" in result
        candidates = result["candidates"]
        # Should find real contacts, not header noise
        names = [c["name"] for c in candidates if c["name"]]
        assert any("Brett" in n for n in names), f"Should find Brett Bollier, got: {names}"
        assert any("Al Rice" in n for n in names), f"Should find Al Rice, got: {names}"
        # Should NOT have header junk
        for c in candidates:
            assert "PARKING" not in c.get("name", "").upper()
            assert "WARDROBE" not in c.get("name", "").upper()
            assert "STYLING" not in c.get("name", "").upper()


class TestDedupe:
    @pytest.mark.skipif(not SAMPLE_XLSX.exists(), reason="sample_output.xlsx not found")
    def test_no_duplicate_role_name_pairs(self):
        result = import_contacts.extract(str(SAMPLE_XLSX))
        seen = set()
        for c in result["candidates"]:
            key = (c["role"].lower(), c["name"].lower())
            assert key not in seen, f"Duplicate: {key}"
            seen.add(key)

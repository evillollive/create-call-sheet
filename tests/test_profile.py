"""Tests for profile.py — local profile manager."""
import json
import os
import tempfile
from pathlib import Path
from unittest import mock

import pytest
import yaml

# Add scripts to path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "create-call-sheet" / "scripts"))

import profile


@pytest.fixture(autouse=True)
def isolated_config(tmp_path):
    """Redirect config and profile to temp dirs for every test."""
    config_path = tmp_path / ".callsheet-config.json"
    with mock.patch.object(profile, "CONFIG_PATH", config_path):
        yield tmp_path


class TestStatus:
    def test_status_no_config(self, capsys):
        assert profile.main(["status"]) == 0
        out = json.loads(capsys.readouterr().out)
        assert out["config_exists"] is False
        assert out["profile_path"] is None
        assert out["profile_exists"] is False

    def test_status_with_config(self, capsys, isolated_config):
        profile_path = isolated_config / "profile.yaml"
        profile.main(["set-path", str(profile_path)])
        capsys.readouterr()  # clear
        assert profile.main(["status"]) == 0
        out = json.loads(capsys.readouterr().out)
        assert out["profile_exists"] is True


class TestSetPath:
    def test_creates_empty_profile(self, capsys, isolated_config):
        p = isolated_config / "sub" / "profile.yaml"
        assert profile.main(["set-path", str(p)]) == 0
        assert p.exists()
        data = yaml.safe_load(p.read_text())
        assert "crew" in data
        assert "notes_block" in data
        assert isinstance(data["crew"], list)

    def test_does_not_overwrite_existing(self, isolated_config):
        p = isolated_config / "profile.yaml"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(yaml.safe_dump({"crew": [{"name": "Existing"}]}))
        profile.main(["set-path", str(p)])
        data = yaml.safe_load(p.read_text())
        assert data["crew"] == [{"name": "Existing"}]


class TestReadProfile:
    def test_read_empty(self, capsys, isolated_config):
        profile.main(["set-path", str(isolated_config / "profile.yaml")])
        capsys.readouterr()
        assert profile.main(["read"]) == 0
        data = json.loads(capsys.readouterr().out)
        assert data["crew"] == []
        assert len(data["notes_block"]) > 0


class TestAddCrew:
    def test_add_new_crew(self, capsys, isolated_config):
        profile.main(["set-path", str(isolated_config / "profile.yaml")])
        capsys.readouterr()
        entry = json.dumps({"role": "DP", "name": "Brett", "phone": "555-1234"})
        assert profile.main(["add-crew", entry]) == 0
        capsys.readouterr()
        profile.main(["read"])
        data = json.loads(capsys.readouterr().out)
        assert len(data["crew"]) == 1
        assert data["crew"][0]["name"] == "Brett"

    def test_update_existing_crew(self, capsys, isolated_config):
        profile.main(["set-path", str(isolated_config / "profile.yaml")])
        capsys.readouterr()
        profile.main(["add-crew", json.dumps({"role": "DP", "name": "Brett", "phone": "old"})])
        capsys.readouterr()
        profile.main(["add-crew", json.dumps({"role": "DP", "name": "Brett", "phone": "new"})])
        capsys.readouterr()
        profile.main(["read"])
        data = json.loads(capsys.readouterr().out)
        assert len(data["crew"]) == 1
        assert data["crew"][0]["phone"] == "new"


class TestAddClient:
    def test_add_new_client(self, capsys, isolated_config):
        profile.main(["set-path", str(isolated_config / "profile.yaml")])
        capsys.readouterr()
        entry = json.dumps({"name": "GitHub", "contacts": [{"name": "Grace", "role": "PM"}]})
        assert profile.main(["add-client", entry]) == 0
        capsys.readouterr()
        profile.main(["read"])
        data = json.loads(capsys.readouterr().out)
        assert len(data["clients"]) == 1
        assert data["clients"][0]["name"] == "GitHub"

    def test_merge_contacts_on_existing_client(self, capsys, isolated_config):
        profile.main(["set-path", str(isolated_config / "profile.yaml")])
        capsys.readouterr()
        profile.main(["add-client", json.dumps({"name": "GitHub", "contacts": [{"name": "Grace", "role": "PM"}]})])
        capsys.readouterr()
        profile.main(["add-client", json.dumps({"name": "GitHub", "contacts": [{"name": "Alex", "role": "Dir"}]})])
        capsys.readouterr()
        profile.main(["read"])
        data = json.loads(capsys.readouterr().out)
        assert len(data["clients"]) == 1
        assert len(data["clients"][0]["contacts"]) == 2


class TestPreferences:
    def test_add_preference(self, capsys, isolated_config):
        profile.main(["set-path", str(isolated_config / "profile.yaml")])
        capsys.readouterr()
        assert profile.main(["add-preference", "No crew dinners"]) == 0
        out = json.loads(capsys.readouterr().out)
        assert "No crew dinners" in out["preferences"]

    def test_add_duplicate_preference(self, capsys, isolated_config):
        profile.main(["set-path", str(isolated_config / "profile.yaml")])
        capsys.readouterr()
        profile.main(["add-preference", "No crew dinners"])
        capsys.readouterr()
        profile.main(["add-preference", "No crew dinners"])
        out = json.loads(capsys.readouterr().out)
        assert out["preferences"].count("No crew dinners") == 1

    def test_remove_preference(self, capsys, isolated_config):
        profile.main(["set-path", str(isolated_config / "profile.yaml")])
        capsys.readouterr()
        profile.main(["add-preference", "No crew dinners"])
        capsys.readouterr()
        assert profile.main(["remove-preference", "No crew dinners"]) == 0
        out = json.loads(capsys.readouterr().out)
        assert "No crew dinners" not in out["preferences"]

"""Convert a call-sheet .xlsx to .pdf using LibreOffice in headless mode.

Why LibreOffice: it's the most reliable open-source way to render xlsx with
formatting intact. The skill's README notes it as an optional dependency.

Usage:
    python export_pdf.py path/to/callsheet.xlsx [output_dir]

If output_dir is omitted, the PDF lands next to the .xlsx.
"""
from __future__ import annotations
import json
import shutil
import subprocess
import sys
from pathlib import Path


def find_soffice() -> str | None:
    for cand in ("soffice", "libreoffice"):
        p = shutil.which(cand)
        if p:
            return p
    # macOS default install path
    mac_path = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    if Path(mac_path).exists():
        return mac_path
    return None


def convert(xlsx_path: str | Path, output_dir: str | Path | None = None) -> Path:
    xlsx = Path(xlsx_path).resolve()
    if not xlsx.exists():
        raise FileNotFoundError(xlsx)
    out_dir = Path(output_dir).resolve() if output_dir else xlsx.parent

    soffice = find_soffice()
    if not soffice:
        raise RuntimeError(
            "LibreOffice not found. Install it (e.g., `brew install --cask libreoffice`) or skip PDF export."
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [soffice, "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(xlsx)],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"LibreOffice conversion failed (rc={result.returncode}):\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    pdf = out_dir / (xlsx.stem + ".pdf")
    if not pdf.exists():
        raise RuntimeError(f"Expected PDF not produced at {pdf}")
    return pdf


def main(argv: list[str]) -> int:
    if not argv:
        sys.stderr.write("Usage: export_pdf.py <xlsx> [output_dir]\n")
        return 2
    xlsx = argv[0]
    out_dir = argv[1] if len(argv) > 1 else None
    pdf = convert(xlsx, out_dir)
    print(json.dumps({"pdf": str(pdf)}))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

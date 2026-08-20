#!/usr/bin/env python3
"""Best-effort PDF spec ingestion helper.

This script intentionally writes to an explicit output directory and degrades
when optional tools are missing. It does not update product docs directly.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path


def tool(name: str) -> str | None:
    return shutil.which(name)


def run(cmd: list[str], output: Path | None = None) -> tuple[int, str, str]:
    result = subprocess.run(cmd, text=True, capture_output=True)
    if output is not None:
        output.write_text(result.stdout, encoding="utf-8", errors="replace")
    return result.returncode, result.stdout, result.stderr


def try_pdfplumber(pdf: Path, out: Path) -> str:
    try:
        import pdfplumber  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local env
        return f"pdfplumber unavailable: {exc}"

    pages: list[str] = []
    with pdfplumber.open(str(pdf)) as doc:
        for index, page in enumerate(doc.pages, start=1):
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            pages.append(f"--- PAGE {index} ---\n{text}".rstrip())
    out.write_text("\n\n".join(pages) + "\n", encoding="utf-8")
    return f"pdfplumber extracted {len(pages)} pages"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out", type=Path, default=Path("/tmp/pdf-spec-ingest"))
    args = parser.parse_args()

    pdf = args.pdf.expanduser().resolve()
    out = args.out.expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)

    report: list[str] = ["# PDF Ingestion Report", "", f"- Source: `{pdf}`", f"- Output: `{out}`", ""]

    if not pdf.exists():
        report.append("- Error: source PDF does not exist")
        (out / "pdf-ingestion-report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
        return 1

    copied = out / "source.pdf"
    shutil.copyfile(pdf, copied)
    report.append(f"- Copied bytes: {copied.stat().st_size}")

    pdfinfo = tool("pdfinfo")
    if pdfinfo:
        code, _stdout, stderr = run([pdfinfo, str(copied)], out / "pdfinfo.txt")
        report.append(f"- pdfinfo: exit {code}")
        if stderr:
            report.append(f"  - stderr: `{stderr.strip()}`")
    else:
        report.append("- pdfinfo: unavailable")

    pdftotext = tool("pdftotext")
    if pdftotext:
        code, _stdout, stderr = run([pdftotext, "-layout", str(copied), str(out / "pdftotext-layout.txt")])
        report.append(f"- pdftotext: exit {code}")
        if stderr:
            report.append(f"  - stderr: `{stderr.strip()}`")
    else:
        report.append("- pdftotext: unavailable")

    report.append(f"- {try_pdfplumber(copied, out / 'pdfplumber-text.txt')}")

    pdftoppm = tool("pdftoppm")
    rendered_dir = out / "rendered-pages"
    rendered_dir.mkdir(exist_ok=True)
    if pdftoppm:
        prefix = rendered_dir / "page"
        code, _stdout, stderr = run([pdftoppm, "-png", str(copied), str(prefix)])
        count = len(list(rendered_dir.glob("page-*.png")))
        report.append(f"- pdftoppm: exit {code}, rendered pages: {count}")
        if stderr:
            report.append(f"  - stderr: `{stderr.strip()}`")
    else:
        report.append("- pdftoppm: unavailable")

    tesseract = tool("tesseract")
    ocrmypdf = tool("ocrmypdf")
    report.append(f"- tesseract: {'available' if tesseract else 'unavailable'}")
    report.append(f"- ocrmypdf: {'available' if ocrmypdf else 'unavailable'}")
    report.append("")
    report.append("## Manual Review Required")
    report.append("")
    report.append("- Compare extracted text with rendered page images.")
    report.append("- Run OCR on pages with missing text or image-only text.")
    report.append("- Move unresolved product decisions to `docs/product/open-questions.md`.")

    (out / "pdf-ingestion-report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


#!/usr/bin/env python3
"""Aplica reemplazos literales -> t('clave') y fusiona claves en es.json / en.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "src" / "i18n" / "locales"
ES_PATH = LOCALES / "es.json"
EN_PATH = LOCALES / "en.json"

# (es_text, key, en_text) — ordenar de más largo a más corto al aplicar
PAIRS: list[tuple[str, str, str]] = []


def load_json(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def set_nested(d: dict, key: str, value: str) -> None:
    parts = key.split(".")
    cur = d
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


def merge_pairs(es: dict, en: dict) -> None:
    for es_text, key, en_text in PAIRS:
        set_nested(es, key, es_text)
        set_nested(en, key, en_text)


def apply_files(files: list[Path]) -> int:
    count = 0
    sorted_pairs = sorted(PAIRS, key=lambda x: -len(x[0]))
    for fp in files:
        text = fp.read_text(encoding="utf-8")
        orig = text
        for es_text, key, _en in sorted_pairs:
            esc = re.escape(es_text)
            # simple quotes
            for q in ("'", '"', "`"):
                pat = f"{q}{esc}{q}"
                rep = f"{{t('{key}')}}" if "{" in es_text else f"t('{key}')"
                # template literals with ${} skip
                if "${" in es_text:
                    continue
                if pat in text:
                    text = text.replace(pat, rep)
                    count += 1
        if text != orig:
            fp.write_text(text, encoding="utf-8")
    return count


def main() -> None:
    es = load_json(ES_PATH)
    en = load_json(EN_PATH)
    merge_pairs(es, en)
    ES_PATH.write_text(json.dumps(es, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    EN_PATH.write_text(json.dumps(en, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    files = [
        ROOT / "src/pages/AdminDashboard.jsx",
        ROOT / "src/pages/MiPerfil.jsx",
        ROOT / "src/pages/ReservaForm.jsx",
        ROOT / "src/components/ChatbotIA.jsx",
    ]
    for g in ROOT.glob("src/components/Admin*.jsx"):
        files.append(g)
    n = apply_files(files)
    print(f"Applied ~{n} replacements across {len(files)} files")


if __name__ == "__main__":
    main()

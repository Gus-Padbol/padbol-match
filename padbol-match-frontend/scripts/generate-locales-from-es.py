#!/usr/bin/env python3
"""
Genera it.json, ro.json, de.json, fr.json, pt.json desde es.json (traducción por lotes).
Uso: python3 scripts/generate-locales-from-es.py [--lang it|ro|de|fr|pt] [--all]
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "src" / "i18n" / "locales"
SOURCE = LOCALES / "es.json"

LANGS = {"it": "it", "ro": "ro", "de": "de", "fr": "fr", "pt": "pt"}

PLACEHOLDER_RE = re.compile(r"(\{\{[^}]+\}\})")

POST_REPLACE = {
    "it": [
        (r"\bfútbol\b", "calcio"),
        (r"\bFútbol\b", "Calcio"),
        (r"\bfutbol\b", "calcio"),
        (r"\bFutbol\b", "Futbol"),
        (r"\bfootball\b", "calcio"),
        (r"\bFootball\b", "Calcio"),
        (r"\bsoccer\b", "calcio"),
        (r"\bSoccer\b", "Calcio"),
        (r"5v5 Soccer", "Calcio 5"),
        (r"7v7 Soccer", "Calcio 7"),
        (r"Fútbol 5", "Calcio 5"),
        (r"Fútbol 7", "Calcio 7"),
    ],
    "pt": [
        (r"\bfútbol\b", "futebol"),
        (r"\bFútbol\b", "Futebol"),
        (r"\bfutbol\b", "futebol"),
        (r"\bFutbol\b", "Futebol"),
        (r"\bfootball\b", "futebol"),
        (r"\bFootball\b", "Futebol"),
        (r"\bsoccer\b", "futebol"),
        (r"\bSoccer\b", "Futebol"),
        (r"5v5 Soccer", "Futebol 5"),
        (r"7v7 Soccer", "Futebol 7"),
        (r"Fútbol 5", "Futebol 5"),
        (r"Fútbol 7", "Futebol 7"),
    ],
}

SKIP_TRANSLATE = re.compile(
    r"^(https?://|/[\w/-]+|@[\w.]+|\d+px|[\d\s%]+$|Padbol Match|PADBOL|Stripe|Mercado Pago|Round Robin|Knockout|APP_USR|acct_|WhatsApp|Instagram|Facebook|TikTok|YouTube|Google Maps)$",
    re.I,
)


def protect_placeholders(s: str) -> tuple[str, list[str]]:
    tokens: list[str] = []

    def repl(m):
        tokens.append(m.group(1))
        return f"__PH{len(tokens) - 1}__"

    return PLACEHOLDER_RE.sub(repl, s), tokens


def restore_placeholders(s: str, tokens: list[str]) -> str:
    for i, t in enumerate(tokens):
        s = s.replace(f"__PH{i}__", t)
    return s


def apply_post(lang: str, s: str) -> str:
    for pat, rep in POST_REPLACE.get(lang, []):
        s = re.sub(pat, rep, s)
    return s


def collect_strings(obj, out: list[str]) -> None:
    if isinstance(obj, dict):
        for v in obj.values():
            collect_strings(v, out)
    elif isinstance(obj, list):
        for v in obj:
            collect_strings(v, out)
    elif isinstance(obj, str):
        out.append(obj)


def rebuild(obj, cache: dict[str, str]):
    if isinstance(obj, dict):
        return {k: rebuild(v, cache) for k, v in obj.items()}
    if isinstance(obj, list):
        return [rebuild(v, cache) for v in obj]
    if isinstance(obj, str):
        return cache.get(obj, obj)
    return obj


def translate_batch_unique(strings: list[str], translator: GoogleTranslator, lang: str) -> dict[str, str]:
    cache: dict[str, str] = {}
    unique = []
    seen = set()
    for s in strings:
        if s in seen:
            continue
        seen.add(s)
        if not s or SKIP_TRANSLATE.match(s.strip()):
            cache[s] = s
            continue
        unique.append(s)

    prot_to_orig: dict[str, str] = {}
    to_translate: list[str] = []
    for s in unique:
        protected, tokens = protect_placeholders(s)
        prot_to_orig[protected] = s
        to_translate.append(protected)

    chunk_size = 50
    for i in range(0, len(to_translate), chunk_size):
        chunk = to_translate[i : i + chunk_size]
        try:
            translated = translator.translate_batch(chunk)
        except Exception as e:
            print(f"  batch warn @ {i}: {e}, falling back to single")
            translated = []
            for item in chunk:
                try:
                    translated.append(translator.translate(item))
                except Exception as e2:
                    print(f"    single fail: {item[:40]!r} {e2}")
                    translated.append(item)
                time.sleep(0.02)
        for orig_protected, tr in zip(chunk, translated):
            s = prot_to_orig[orig_protected]
            _, tokens = protect_placeholders(s)
            out = restore_placeholders(tr or orig_protected, tokens)
            cache[s] = apply_post(lang, out)
        print(f"  … {min(i + chunk_size, len(to_translate))}/{len(to_translate)}", flush=True)
        time.sleep(0.1)

    return cache


def generate_lang(code: str) -> None:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    all_strings: list[str] = []
    collect_strings(data, all_strings)
    target = LANGS[code]
    print(f"Translating es -> {code} ({target}), {len(all_strings)} leaves…")
    translator = GoogleTranslator(source="es", target=target)
    cache = translate_batch_unique(all_strings, translator, code)
    out = rebuild(data, cache)
    dest = LOCALES / f"{code}.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {dest}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=list(LANGS.keys()))
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    if args.all:
        for code in LANGS:
            generate_lang(code)
    elif args.lang:
        generate_lang(args.lang)
    else:
        ap.error("Use --all or --lang CODE")


if __name__ == "__main__":
    main()

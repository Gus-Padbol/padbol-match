#!/usr/bin/env python3
"""Generate locales/ar.json from es.json (MSA, formal). Preserves i18n placeholders."""
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ES_PATH = ROOT / "src/i18n/locales/es.json"
AR_PATH = ROOT / "src/i18n/locales/ar.json"

PLACEHOLDER = re.compile(
    r"(\{\{[^}]+\}\}|\{[a-zA-Z_][a-zA-Z0-9_]*\}|<\d+>|<[^>]+>|%[sd]|\$\{[^}]+\})"
)

try:
    from deep_translator import GoogleTranslator
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "deep-translator", "-q"])
    from deep_translator import GoogleTranslator


def protect(text: str):
    tokens = {}

    def repl(m):
        key = f"__PH{len(tokens)}__"
        tokens[key] = m.group(0)
        return key

    return PLACEHOLDER.sub(repl, text), tokens


def unprotect(text: str, tokens: dict):
    for key, val in tokens.items():
        text = text.replace(key, val)
    return text


def flatten(obj, prefix=""):
    out = []
    for k, v in obj.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.extend(flatten(v, key))
        else:
            out.append((key, v if v is not None else ""))
    return out


def unflatten(pairs):
    root = {}
    for path, value in pairs:
        parts = path.split(".")
        cur = root
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = value
    return root


def translate_batch(texts, translator, batch_size=40):
    results = []
    for i in range(0, len(texts), batch_size):
        chunk = texts[i : i + batch_size]
        protected_chunk = []
        token_maps = []
        for t in chunk:
            s = str(t)
            if not s.strip():
                protected_chunk.append(s)
                token_maps.append({})
                continue
            p, tok = protect(s)
            protected_chunk.append(p)
            token_maps.append(tok)
        for attempt in range(4):
            try:
                translated = translator.translate_batch(protected_chunk)
                break
            except Exception:
                time.sleep(2 ** attempt)
        else:
            translated = protected_chunk
        for orig, tr, tok in zip(chunk, translated, token_maps):
            if tr is None:
                results.append(orig)
            elif tok:
                results.append(unprotect(str(tr), tok))
            else:
                results.append(str(tr) if tr else orig)
        time.sleep(0.15)
        if (i // batch_size) % 10 == 0:
            print(f"  {min(i + batch_size, len(texts))}/{len(texts)}", flush=True)
    return results


def main():
    es = json.loads(ES_PATH.read_text(encoding="utf-8"))
    pairs = flatten(es)
    paths = [p for p, _ in pairs]
    values = [v for _, v in pairs]
    print(f"Translating {len(values)} strings es → ar …")
    translator = GoogleTranslator(source="es", target="ar")
    ar_values = translate_batch(values, translator)
    ar = unflatten(list(zip(paths, ar_values)))
    AR_PATH.write_text(json.dumps(ar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {AR_PATH}")


if __name__ == "__main__":
    main()

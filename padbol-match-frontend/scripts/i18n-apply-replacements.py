#!/usr/bin/env python3
"""Apply common i18n t() replacements to JSX files. Run from padbol-match-frontend/."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
SKIP = {
    "i18n",
    "reportWebVitals.js",
    "setupTests.js",
    "App.test.js",
    "pwaBuildId.js",
}

# (exact string in quotes) -> i18n key
REPLACEMENTS = [
    ('"Cargando…"', "{t('general.loading')}"),
    ("'Cargando…'", "{t('general.loading')}"),
    ('"Cargando..."', "{t('general.loadingEllipsis')}"),
    ("'Cargando...'", "{t('general.loadingEllipsis')}"),
    ('"Confirmar"', "{t('general.confirm')}"),
    ("'Confirmar'", "{t('general.confirm')}"),
    ('"Cancelar"', "{t('general.cancel')}"),
    ("'Cancelar'", "{t('general.cancel')}"),
    ('"Cerrar"', "{t('general.close')}"),
    ("'Cerrar'", "{t('general.close')}"),
    ('"Guardar"', "{t('general.save')}"),
    ("'Guardar'", "{t('general.save')}"),
    ('"Volver"', "{t('general.back')}"),
    ("'Volver'", "{t('general.back')}"),
    ('"Buscar"', "{t('general.search')}"),
    ("'Buscar'", "{t('general.search')}"),
    ('"Perfil"', "{t('nav.perfil')}"),
    ("'Perfil'", "{t('nav.perfil')}"),
    ('"Jugar"', "{t('nav.jugar')}"),
    ("'Jugar'", "{t('nav.jugar')}"),
    ('"Competir"', "{t('nav.competir')}"),
    ("'Competir'", "{t('nav.competir')}"),
    ('"Notificaciones"', "{t('nav.notificaciones')}"),
    ("'Notificaciones'", "{t('nav.notificaciones')}"),
    ('"Torneos"', "{t('torneos.titulo')}"),
    ("'Torneos'", "{t('torneos.titulo')}"),
    ('"Reservas"', "{t('nav.admin.reservas')}"),
    ("'Reservas'", "{t('nav.admin.reservas')}"),
    ('"Resumen"', "{t('nav.admin.resumen')}"),
    ("'Resumen'", "{t('nav.admin.resumen')}"),
    ('"Validaciones"', "{t('nav.admin.validaciones')}"),
    ("'Validaciones'", "{t('nav.admin.validaciones')}"),
    ('"Mi Sede"', "{t('nav.admin.mi_sede')}"),
    ("'Mi Sede'", "{t('nav.admin.mi_sede')}"),
    ('"Solicitudes"', "{t('nav.admin.solicitudes')}"),
    ("'Solicitudes'", "{t('nav.admin.solicitudes')}"),
    ('"Config"', "{t('nav.admin.config')}"),
    ("'Config'", "{t('nav.admin.config')}"),
    ('"Clases"', "{t('clases.titulo')}"),
    ("'Clases'", "{t('clases.titulo')}"),
    ('"Ranking"', "{t('ranking.titulo')}"),
    ("'Ranking'", "{t('ranking.titulo')}"),
    ('"Reservar"', "{t('reservas.header')}"),
    ("'Reservar'", "{t('reservas.header')}"),
    ('"Pago"', "{t('pago.titulo')}"),
    ("'Pago'", "{t('pago.titulo')}"),
    ('"Mi Perfil"', "{t('perfil.titulo')}"),
    ("'Mi Perfil'", "{t('perfil.titulo')}"),
    ('"Cerrar sesión"', "{t('auth.cerrar_sesion')}"),
    ("'Cerrar sesión'", "{t('auth.cerrar_sesion')}"),
    ('"Continuar con Google"', "{t('auth.google')}"),
    ("'Continuar con Google'", "{t('auth.google')}"),
    ('"Continuar con Facebook"', "{t('auth.facebook')}"),
    ("'Continuar con Facebook'", "{t('auth.facebook')}"),
    ('"Iniciar sesión"', "{t('auth.login')}"),
    ("'Iniciar sesión'", "{t('auth.login')}"),
    ('"Crear cuenta"', "{t('auth.registerTitle')}"),
    ("'Crear cuenta'", "{t('auth.registerTitle')}"),
    ('"Contraseña"', "{t('auth.password')}"),
    ("'Contraseña'", "{t('auth.password')}"),
    ('"¡Vamos a jugar!"', "{t('jugar.titulo')}"),
    ("'¡Vamos a jugar!'", "{t('jugar.titulo')}"),
    ('"Tomar una clase"', "{t('clases.pageTitle')}"),
    ("'Tomar una clase'", "{t('clases.pageTitle')}"),
    ('"Elegí un profesor y reservá tu horario."', "{t('clases.pageSubtitle')}"),
    ("'Elegí un profesor y reservá tu horario.'", "{t('clases.pageSubtitle')}"),
    ('"Elegí un profesor y reservá tu horario."', "{t('clases.pageSubtitle')}"),
    ('"Elegí un profesor y reservá tu horario."', "{t('clases.pageSubtitle')}"),
    ('"Elegí un profesor y reservá tu horario."', "{t('clases.pageSubtitle')}"),
    ('"Elegí un profesor y reservá tu horario."', "{t('clases.pageSubtitle')}"),
    ('"Elegué un profesor"', 'SKIP'),
]

# fix clases subtitle - neutral spanish
REPLACEMENTS = [r for r in REPLACEMENTS if r[1] != 'SKIP']
REPLACEMENTS.append(('"Elegí un profesor y reservá tu horario."', "{t('clases.pageSubtitle')}"))
REPLACEMENTS.append(("'Elegí un profesor y reservá tu horario.'", "{t('clases.pageSubtitle')}"))
REPLACEMENTS.append(('"Elige un profesor y reserva tu horario."', "{t('clases.pageSubtitle')}"))
REPLACEMENTS.append(("'Elige un profesor y reserva tu horario.'", "{t('clases.pageSubtitle')}"))

IMPORT_LINE = "import { useTranslation } from 'react-i18next';\n"
HOOK_LINE = "  const { t } = useTranslation();\n"


def needs_hook(content: str) -> bool:
    return "useTranslation" not in content and "{t(" in content


def add_import_and_hook(content: str, filepath: Path) -> str:
    if "useTranslation" in content:
        return content
    if "{t(" not in content:
        return content

    lines = content.splitlines(keepends=True)
    import_idx = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            import_idx = i + 1
    lines.insert(import_idx, IMPORT_LINE)

    content = "".join(lines)

    # Insert hook after first function component opening
    patterns = [
        r"(export default function \w+\([^)]*\) \{\n)",
        r"(export function \w+\([^)]*\) \{\n)",
        r"(const \w+ = \([^)]*\) => \{\n)",
        r"(function \w+\([^)]*\) \{\n)",
    ]
    for pat in patterns:
        m = re.search(pat, content)
        if m:
            insert_at = m.end()
            return content[:insert_at] + HOOK_LINE + content[insert_at:]
    return content


def process_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    orig = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    if text == orig:
        return False
    text = add_import_and_hook(text, path)
    path.write_text(text, encoding="utf-8")
    return True


def main():
    changed = []
    for path in sorted(ROOT.rglob("*.jsx")):
        if any(p in path.parts for p in SKIP):
            continue
        if process_file(path):
            changed.append(path.relative_to(ROOT.parent))
    print(f"Updated {len(changed)} files")
    for p in changed[:40]:
        print(" ", p)
    if len(changed) > 40:
        print(f"  ... and {len(changed) - 40} more")


if __name__ == "__main__":
    main()

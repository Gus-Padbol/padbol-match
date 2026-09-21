# PADBOL MATCH — WORKSPACE CANÓNICO

Este directorio es la **ÚNICA fuente de verdad** para el desarrollo de Padbol Match.

- **Base:** deployment de producción Vercel `dpl_HoqbW899NQodCnWWws8c6tVtKdJY` (proyecto `padbol-match-9abn`, 15-sep-2026), recuperado y decodificado.
- **Repo Git:** `Gus-Padbol/padbol-match` (rama de integración: `consolidacion`).

## Reglas permanentes

1. **Todos los cambios se hacen AQUÍ**, sobre `consolidacion` (o ramas derivadas). Nunca en snapshots.
2. Los directorios `*-TEST-DEEPSEEK` bajo `/Users/padbol2022/PADBOL-LAB-DEEPSEEK/` son **snapshots de referencia / solo lectura**. No editar, no deployar ni compilar desde ellos.
3. **No versionar secretos**: `.env`, `.env.production`, credenciales, tokens.
4. El `build/` recuperado está **desactualizado**: recompilar siempre desde `src/` (Vercel lo hace automáticamente).
5. **Deploy / build / migraciones / push**: solo con autorización explícita.

## Estado

- Etapa 1 (workspace canónico local) — completada.
- Pendiente de autorización: Etapa 2+ (merge dirigido, verificación, deploys, limpieza). Ver `PLAN-CONSOLIDACION-PADBOL-MATCH.md`.

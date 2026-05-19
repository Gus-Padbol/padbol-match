# Configuración pendiente (fuera del repo)

| ID | Tema | Acción | Documentación |
|----|------|--------|----------------|
| BUG-01 | Google OAuth muestra URL/nombre de Supabase | Configurar OAuth consent screen en Google Cloud | [docs/GOOGLE_OAUTH_CONFIG.md](docs/GOOGLE_OAUTH_CONFIG.md) |
| — | Supabase custom domain | `SUPABASE_URL` / `REACT_APP_SUPABASE_URL` = `https://auth.padbolmatch.com` en Render, Vercel y `.env` local | [padbol-match-frontend/README.md](padbol-match-frontend/README.md) |
| — | RLS tablas core | Ejecutar `supabase/migrations/20260519120000_rls_policies_core_tables.sql` en SQL Editor; backend (service_role) no se afecta | — |

## SQL en Supabase (ejecutar en SQL Editor si no usás migraciones automáticas)

- `supabase/migrations/20260518120000_torneos_formato_equipo_reload.sql` — BUG-05
- `supabase/scripts/manual_cleanup_jugadores_perfil_whatsapp.sql` — BUG-02 limpieza prod (huérfanos + duplicados; **antes** del índice)
- `supabase/migrations/20260518120100_jugadores_perfil_whatsapp_unique.sql` — BUG-02 índice único en `whatsapp`
- `supabase/migrations/20260518120200_sede_extras_stock.sql` — MEJ-04

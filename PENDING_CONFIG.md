# Configuración pendiente (fuera del repo)

| ID | Tema | Acción | Documentación |
|----|------|--------|----------------|
| BUG-01 | Google OAuth muestra URL/nombre de Supabase | Configurar OAuth consent screen en Google Cloud | [docs/GOOGLE_OAUTH_CONFIG.md](docs/GOOGLE_OAUTH_CONFIG.md) |

## SQL en Supabase (ejecutar en SQL Editor si no usás migraciones automáticas)

- `supabase/migrations/20260518120000_torneos_formato_equipo_reload.sql` — BUG-05
- `supabase/migrations/20260518120100_jugadores_perfil_whatsapp_unique.sql` — BUG-02 (revisar duplicados antes)
- `supabase/migrations/20260518120200_sede_extras_stock.sql` — MEJ-04

# Accesos para Juan Pablo

Marcar cada acceso cuando funcione desde su propia cuenta. No compartir la contraseña personal de Gustavo.

## Imprescindibles

- [ ] GitHub: escritura en `Gus-Padbol/padbol-match`, `Gus-Padbol/padbol-backend` y `Gus-Padbol/padbol-match-native`.
- [ ] GitHub: puede clonar, crear rama, subirla y abrir Pull Request; la protección de `main` sigue activa.
- [ ] Render: desarrollador en `padbol-backend-qa` y visibilidad de logs/variables; producción con el nivel acordado.
- [ ] Supabase: proyecto QA con Auth, logs, Storage y migraciones. Producción preferentemente solo lectura al comienzo.
- [ ] Expo/EAS: miembro del proyecto `955c4a6f-572a-464f-a5e6-c536d42c0170`, capaz de ver builds y crear un `preview`.
- [ ] Vercel/hosting web: acceso al proyecto de Padbol Match, previews y logs, sin permiso para modificar DNS inicialmente.

## Según la tarea

- [ ] App Store Connect/TestFlight: Developer o App Manager si participará de iOS.
- [ ] Google Play Console: prueba interna; producción solo si publicará Android.
- [ ] Stripe: Developer para logs y webhooks; nunca compartir claves por chat.
- [ ] Mercado Pago: acceso técnico si investigará pagos procesados allí.
- [ ] Meta Business/WhatsApp o Twilio: rol técnico si trabajará en mensajería.
- [ ] Dominio/DNS: reservado a Gustavo hasta la migración aprobada.

## Secretos y seguridad

- Cargar valores en Render, Supabase, hosting/EAS o un gestor seguro.
- No subir `.env`, claves privadas, tokens de servicio ni credenciales Apple/Google.
- `SUPABASE_SERVICE_ROLE_KEY` pertenece solo al backend; jamás al frontend o app.
- Dar el mínimo permiso y activar 2FA.
- Rotar cualquier clave compartida por un canal inseguro.

## Prueba de autonomía

El traspaso queda validado cuando Juan Pablo, desde Windows y con su propia cuenta:

1. clona los tres repositorios;
2. ejecuta sus pruebas;
3. crea una rama de corrección;
4. publica un preview o despliegue QA;
5. verifica el cambio;
6. abre un Pull Request;
7. revierte la corrección de prueba sin intervención técnica desde la Mac.

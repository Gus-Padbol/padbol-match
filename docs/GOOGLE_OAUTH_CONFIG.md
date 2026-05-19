# Google OAuth — nombre «Padbol Match» (BUG-01)

El texto que aparece al iniciar sesión con Google («Sign in with …» / pantalla de consentimiento) **no se configura en el código** del frontend ni del backend. Lo define el proyecto en **Google Cloud Console** y la app OAuth vinculada en Supabase.

## Pasos para Gus (administrador del proyecto)

1. Abrir [Google Cloud Console](https://console.cloud.google.com).
2. Seleccionar el proyecto de **Padbol Match** (el mismo que usa Supabase → Authentication → Google).
3. Ir a **APIs & Services** → **OAuth consent screen**.
4. Configurar:
   - **App name:** `Padbol Match`
   - **User support email:** correo de soporte del producto
   - **App logo:** logo cuadrado (recomendado 120×120 px mínimo)
   - **Application home page:** `https://padbolmatch.com`
   - **Authorized domains:** `padbolmatch.com` (y el dominio de preview/staging si aplica)
5. En **Scopes**, mantener solo los necesarios (perfil básico y email suelen bastar con Supabase).
6. Si la app está en modo **Testing**, agregar usuarios de prueba o pasar a **Production** cuando corresponda.
7. **Guardar** y, si Google lo solicita, **re-publicar** / enviar a verificación.

## Supabase (recordatorio)

API y Auth del proyecto usan el custom domain **`https://auth.padbolmatch.com`** (`SUPABASE_URL` / `REACT_APP_SUPABASE_URL` en despliegue).

En **Supabase Dashboard** → **Authentication** → **Providers** → **Google**:

- Client ID y Client Secret deben coincidir con el mismo proyecto de Google Cloud.
- En **Redirect URLs** debe estar la URL de callback del frontend (`https://padbolmatch.com/auth/callback` y variantes de staging).

## Verificación

Tras guardar en Google, cerrar sesión en el navegador y volver a probar «Continuar con Google». La pantalla de Google debería mostrar **Padbol Match** como nombre de la aplicación.

No hay cambios de código requeridos en este repositorio para este ítem.

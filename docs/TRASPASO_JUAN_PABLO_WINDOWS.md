# Traspaso operativo de Padbol Match a Windows

Fecha de corte: 6 de octubre de 2026.

Este documento permite que Juan Pablo instale, pruebe y corrija Padbol Match desde Windows sin depender de la Mac de Gustavo. No contiene contraseñas ni secretos.

## 1. Fuentes oficiales y estado respaldado

Hay tres repositorios separados. No trabajar desde copias de Escritorio, carpetas `TEST`, ZIP ni directorios temporales.

| Componente | Repositorio | Rama de continuidad | Uso |
|---|---|---|---|
| Web y panel administrador | `Gus-Padbol/padbol-match` | `handoff/juan-pablo-2026-10-06` | Web, paneles y PWA |
| Backend oficial | `Gus-Padbol/padbol-backend` | `handoff/juan-pablo-2026-10-06` | API de producción y QA |
| App móvil oficial | `Gus-Padbol/padbol-match-native` | `consolidacion` | Expo, Android e iOS |

El backend y la app móvil deben salir únicamente de los repositorios oficiales indicados. La rama de traspaso de web conserva el trabajo que estaba pendiente de guardar en la Mac.

## 2. Preparar Windows

Instalar Git for Windows, Visual Studio Code, Node.js 18 LTS y PowerShell 7. Agregar Android Studio y JDK 17 solamente si se probará Android localmente. En un teléfono, instalar Expo Go o el cliente interno de Padbol Match según la prueba.

Configurar Git una sola vez:

```powershell
git config --global user.name "Juan Pablo"
git config --global user.email "SU_CORREO_DE_GITHUB"
git config --global core.autocrlf true
New-Item -ItemType Directory -Force C:\Padbol | Out-Null
Set-Location C:\Padbol
```

## 3. Instalar cada proyecto

### Web y administrador

```powershell
git clone https://github.com/Gus-Padbol/padbol-match.git
Set-Location .\padbol-match
git switch handoff/juan-pablo-2026-10-06
Set-Location .\padbol-match-frontend
Copy-Item .env.example .env.local
npm ci
npm start
```

Completar `.env.local` con valores de desarrollo o QA entregados por un administrador. Nunca pegar secretos en GitHub, documentación, WhatsApp ni capturas.

Controles:

```powershell
npm test -- --watchAll=false
npm run build
```

### Backend

```powershell
Set-Location C:\Padbol
git clone https://github.com/Gus-Padbol/padbol-backend.git
Set-Location .\padbol-backend
git switch handoff/juan-pablo-2026-10-06
Copy-Item .env.example .env
npm ci
npm test
npm run dev
```

Comprobar `GET /health` antes de probar funciones. `npm run release:preflight` bloquea intencionalmente la publicación desde una rama distinta de `main`. No se debe eliminar esa protección: para publicar, primero se revisa y fusiona la corrección a `main`.

### App móvil

```powershell
Set-Location C:\Padbol
git clone https://github.com/Gus-Padbol/padbol-match-native.git
Set-Location .\padbol-match-native
git switch consolidacion
npm ci
npx expo-doctor
npm run release:preflight
npm test
npx tsc --noEmit
npx expo start --tunnel --clear
```

En Windows usar `npx expo start --tunnel --clear`; el comando corto histórico `npm start` intenta detectar una interfaz con una utilidad de macOS.

Para Android local: `npx expo run:android`.

Para iOS no hace falta una Mac si se usa el build en la nube de EAS. Una Mac con Xcode solo es necesaria para simulador iOS local, diagnóstico nativo local o casos excepcionales de certificados.

## 4. Regla para una corrección

Nunca corregir directamente sobre `main`, producción o `consolidacion`.

```powershell
git pull --ff-only
git switch -c fix/descripcion-corta
# realizar el cambio
git status
git diff --check
git add RUTA_DE_LOS_ARCHIVOS
git commit -m "fix: descripción clara"
git push -u origin HEAD
```

Abrir un Pull Request, esperar controles y revisión, probar en QA o preview y recién después fusionar.

## 5. Cómo probar

- Web: prueba específica, suite de Jest y `npm run build`.
- Backend: `npm test`; al corte la suite completa tiene 1.482 pruebas aprobadas.
- App: `npm run release:preflight`, `npm test` y `npx tsc --noEmit`.
- Verificación humana: iniciar sesión con un usuario QA del rol afectado y repetir el recorrido completo.
- Revisar consola y logs sin copiar datos personales.

Entornos principales:

- Backend QA: `https://padbol-backend-qa.onrender.com`
- Backend producción: `https://padbol-backend.onrender.com`
- Next Generation QA: `https://dev.padbol.com`
- La migración de `padbol.com` está pausada. No cambiar DNS ni dominios hasta autorización expresa de Gustavo.

La app `preview` y `store-qa` apuntan al backend QA. La app `production` debe apuntar al backend productivo; el control previo verifica este contrato.

## 6. Cómo publicar

### Backend en Render

1. Fusionar el Pull Request aprobado a `main`.
2. En `main`, ejecutar `npm run release:preflight` y `npm test`.
3. Desplegar primero `padbol-backend-qa`; verificar `/health` y el recorrido afectado.
4. Desplegar `padbol-backend` desde el commit exacto aprobado.
5. Confirmar logs, salud y una prueba funcional breve.

### Web

1. Generar un preview desde el Pull Request.
2. Verificar escritorio y móvil.
3. Fusionar cuando el preview esté aprobado.
4. Confirmar el proyecto y dominio que se promoverán; no reasignar `padbol.com` durante este traspaso.

### App móvil con EAS

Proyecto oficial: `955c4a6f-572a-464f-a5e6-c536d42c0170`.

```powershell
npx eas-cli login
npx eas-cli whoami
npx eas-cli build --profile preview --platform android
```

Para tienda, usar exclusivamente los perfiles de `eas.json` y el procedimiento de release del repositorio. Producción requiere aprobación de Gustavo antes de enviar a App Store Connect o Google Play.

## 7. Cómo revertir sin perder trabajo

No usar `git reset --hard` sobre una rama compartida. Crear una reversión trazable:

```powershell
git switch main
git pull --ff-only
git switch -c revert/incidente-descripcion
git revert SHA_DEL_COMMIT
git push -u origin HEAD
```

- Render: volver al commit anterior aprobado o desplegar el commit de reversión; verificar `/health`.
- Web/Vercel: promover el deployment anterior aprobado o desplegar el `git revert`. No cambiar DNS como rollback.
- Supabase: migraciones hacia adelante, primero QA, con respaldo y reversión probada. Nunca ejecutar en producción un script `QA ONLY`.
- App stores: una versión publicada requiere una nueva versión corregida. Una OTA solo corresponde si el runtime es compatible y el cambio no es nativo.

## 8. Estado funcional al entregar

- App móvil oficial en `consolidacion`: control previo, 58 grupos de pruebas y TypeScript aprobados.
- Backend oficial: 1.482 pruebas aprobadas. La rama de continuidad incluye la API segura de estado de inscripción de Next Generation y scripts QA documentados.
- Web/admin: compila y la prueba específica de resultado manual de Torneo Express aprueba 8 casos. El snapshot queda en una rama de traspaso para revisión y Pull Request; no se considera producción automática.
- CRM: recibe formularios. WhatsApp saliente sigue pendiente de habilitación/aprobación de Meta y el email saliente permanece desactivado.
- La migración del dominio público `padbol.com` sigue pausada por decisión de Gustavo.

## 9. Pendientes priorizados

1. Revisar el snapshot web y abrir Pull Request hacia la rama de integración elegida.
2. Probar de punta a punta formulario → CRM → asignación territorial → respuesta.
3. Finalizar aprobación/configuración de WhatsApp Business/Meta antes de habilitar mensajes salientes.
4. Definir si se activa email saliente y con qué proveedor.
5. Ejecutar QA humano en Android e iOS antes del próximo release.
6. Resolver migraciones Supabase primero en QA y con respaldo.
7. Mantener pausados DNS y migración de `padbol.com` hasta aprobación final.

## 10. Qué todavía necesita a Gustavo

- Invitar a Juan Pablo a GitHub, Render, Supabase, Vercel y Expo/EAS.
- Aprobar accesos a producción, facturación y cambios de dominio/DNS.
- Autorizar cambios destructivos de base de datos o rotación de secretos.
- Autorizar publicación en App Store, Google Play y distribución externa de TestFlight.
- Aprobar configuración comercial de Stripe, Mercado Pago, Meta/WhatsApp o Twilio.
- Resolver verificaciones de identidad, contratos o 2FA a nombre del titular.

La Mac de Gustavo no es necesaria para programar, probar web/backend, generar previews ni crear builds EAS. Solo puede ser necesaria para simulador iOS/Xcode local o material que no esté en repositorios; después de este respaldo, el código vigente no depende de ella.

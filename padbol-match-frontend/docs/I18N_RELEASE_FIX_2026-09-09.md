# Match web — cierre local de traducciones y etiquetas territoriales, 2026-09-09

## Resultado

La suite pasó de **918/925** a **926/926**, con **115/115 suites** aprobadas y cero pruebas omitidas. Se añadió una prueba de contrato comercial para las 20 ediciones; no se eliminó ninguna. La compilación local terminó correctamente y produjo `/static/js/main.5586cbd3.js`. No hubo push, despliegue ni llamadas reales a backend.

La carpeta frontend y su raíz `.web-commercial-live` no tienen `.openai/hosting.json`. En este lote no se modificaron Sites, backend ni nativa.

## Cambios de traducción

- `romanianPolishOverrides.json` y `czechPolishOverrides.json`: 155 claves FIPA por idioma, 310 textos. Conservan `{{status}}`/`{{id}}`, los nueve documentos, siete documentos reservados a miembros, aprobación/revocación, edad y WhatsApp opcional. No cambian permisos de servidor.
- `generatedStaticCopyLocales.json`: siete campos comerciales, incluidos los tres beneficios, actualizados en las 16 ediciones generadas. Se actualizan también los tres textos del banner de planes en las 11 ediciones generadas que lo usan: árabe, persa, neerlandés de Países Bajos/Bélgica, sueco, griego, húngaro, hebreo, polaco, ucraniano y afrikáans. Las traducciones existentes directas se conservan.
- `commercialFlowCopy.js` y `venuePlansCopy.js`: se eliminan los reemplazos forzados por inglés de estos campos; la edición elegida usa su propia traducción vigente.
- Oferta conservada: primeros **3 meses gratis**, base **USD 68**, **USD 34 desde el cuarto mes**, referencia **USD 17 sólo si las seis metas mensuales están configuradas y cumplidas**, facturación apagada. El banner reutiliza el mismo texto condicionado ya verificado del circuito comercial.
- `spanishIdenticalAllowlist.json`: única excepción nueva `fipaLibrary.answer.no`, porque «No» es correcto en español e inglés, igual que `general.no` ya permitido. No se modifica la auditoría para omitir faltantes.
- `SedeWhatsappPhoneField.test.jsx`: expectativa «Ingresa», conforme al español neutro vigente; conserva accesibilidad.
- `venuePlansI18n.test.js` y `commercialFlowCopy.test.js`: expectativa de tres meses, oferta y condiciones en las 20 ediciones, textos directos y conservación de variables. La nueva aserción checa respeta el orden gramatical de sus condiciones.

## Roles territoriales

Contrato acordado con el responsable backend: país requiere `pais`; provincia requiere `pais + provincia`; ciudad requiere `pais + provincia + ciudad`. La invitación `ciudad_region` representa provincia cuando la ciudad está vacía y ciudad cuando está presente.

El formulario actual `enviarInvitacionClub` ya envía esos padres correctamente a `/api/admin/invitaciones-admin`, recorta espacios y exige país/provincia para el alcance regional. La creación por `/api/admin/roles` es exclusiva de editor; aquí no existe una edición territorial por ese endpoint. **No se cambiaron solicitudes ni se añadió una edición de roles**.

`AdminDashboard.jsx` cambia sólo las etiquetas de roles: `ciudad · provincia · país` y `provincia · país`, en las vistas existentes. Los padres ausentes se muestran con «—»; no se deducen por nombre ni se otorga acceso. Las etiquetas de sede/editor/global/país conservan su comportamiento. La protección de los registros territoriales incompletos y la validación de valores sin texto corresponden al lote backend separado.

## Verificación

1. Línea base: siete fallos reproducidos, 918 aprobados de 925.
2. Focal comercial final: **61/61**, cinco suites; idioma directo y oferta en las 20 ediciones. Los 33 textos nuevos del banner conservaron el inventario de variables (no contenían variables).
3. Suite completa final: **926/926**, **115/115 suites**, cero omitidas.
4. QA territorial independiente: **13/13**. Ejecuta callbacks reales extraídos por AST, con sesión/fetch simulados: tuplas completas, provincia sin ciudad, país, rechazo previo por padres vacíos, autorización, rechazo de servidor que conserva datos, etiquetas completas y controles negativos que detectan pérdida de país y etiquetas antiguas. No usa red.
5. Compilación local: exit 0, «Compiled successfully»; conserva el aviso general del bundle grande (~1,54 MB comprimido). No se desactivaron validaciones del build.
6. Inventario FIPA: 155/155 claves por idioma, sin faltantes/sobrantes, variables idénticas al inglés. Los únicos cambios de JSON generado pertenecen a los campos comerciales descritos; metas y otros bloques permanecen intactos.
7. `git diff --check` en los diez archivos fuente/pruebas y este informe: exit 0.

Comandos equivalentes desde frontend:

```
CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand
BUILD_PATH=/private/tmp/padbol-match-i18n-20260909/build node node_modules/react-scripts/bin/react-scripts.js build
node --test /private/tmp/padbol-match-i18n-20260909/qa-role-scope.cjs
```

Se invocaron herramientas ya instaladas directamente para evitar regenerar el identificador PWA por pretest/prebuild. El build está fuera del árbol y no constituye un candidato publicable.

Evidencias en `/private/tmp/padbol-match-i18n-20260909/`: `focal-final.json`, `suite-final.json`, `suite-final.log`, `build-final.log`, `build/`, `qa-role-scope.cjs` y `qa-role-scope.tap`. Línea base: `/private/tmp/padbol-match-suite-before-20260909.json`. `final-changes.patch` compara con el estado recibido, no con un HEAD que podría omitir avances previos; `final-source-sha256.json` enumera los once archivos de este lote.

## Pendientes conservados

- No publicar el árbol completo: siguen las dependencias de backend/migraciones, staging, legal, privacidad y recorrido integrado del traspaso.
- Las cantidades existentes **1/8/3/10/10/5** siguen siendo una decisión comercial pendiente. No se aprobaron ni modificaron en este lote.
- No se editaron el motor de precios, el anual USD 690, checkout, cobros ni otras funciones.
- Las traducciones de consentimiento/edad conservan la política de origen y su QA técnico; no sustituyen revisión humana o jurídica antes de publicar.
- No se verificaron envíos, cobros, aceptación legal ni recorridos remotos reales.

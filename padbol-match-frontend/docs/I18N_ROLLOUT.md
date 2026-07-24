# Internacionalización de Padbol Match

## Idiomas habilitados

La aplicación reconoce 18 opciones:

- alemán (`de`)
- español (`es`)
- inglés (`en`)
- árabe (`ar`, RTL)
- neerlandés de Bélgica / flamenco (`nl-BE`)
- francés (`fr`)
- italiano (`it`)
- rumano (`ro`)
- neerlandés de Países Bajos (`nl-NL`)
- sueco (`sv`)
- portugués de Brasil (`pt-BR`)
- portugués de Portugal (`pt-PT`)
- griego (`el`)
- húngaro (`hu`)
- hebreo (`he`, RTL)
- polaco (`pl`)
- ucraniano (`uk`)
- afrikáans (`af`)

“Flamenco” no se trata como un idioma técnico separado: se representa con el
locale estándar `nl-BE`, diferenciado de `nl-NL`.

## Garantías técnicas

- Cada idioma resuelve todas las claves inglesas mediante fallback seguro.
- Nunca se debe mostrar una clave interna como `publicSite.hero.claim`.
- Los códigos antiguos `pt`, `nl` e `iw` se migran a `pt-BR`, `nl-NL` y `he`.
- Fechas y calendarios usan un locale BCP 47 específico para cada mercado.
- Árabe y hebreo activan dirección RTL en toda la interfaz.
- El selector soporta desplazamiento y las 18 opciones en móvil y escritorio.
- Los tests recorren todos los idiomas y todas las claves del catálogo inglés.

## Cobertura editorial

Español e inglés son los catálogos fuente completos. Alemán, árabe, francés,
italiano, rumano y portugués de Brasil ya tienen una traducción amplia y
completan sus faltantes en inglés. Los nuevos mercados comienzan con navegación,
acciones esenciales y la portada pública traducidas; el resto se muestra en
inglés hasta completar la revisión editorial.

Esto evita bloquear el producto o mostrar claves rotas, pero no debe confundirse
con una traducción nativa completa. La expansión editorial se realiza por
recorridos: portada, acceso y perfil; reservas y juego; torneos; administración;
legal y notificaciones.

## Control de calidad

Ejecutar:

```bash
npm run audit:i18n
npm test -- --watchAll=false --runInBand
npm run build
```

El primer comando detecta posibles textos españoles hardcodeados. Los tests
comprueban códigos regionales, migraciones, cobertura efectiva, locales de
fechas y RTL. La revisión humana final se limita a tono comercial, terminología
deportiva local y textos legales; no requiere recorrer manualmente toda la app
para encontrar faltantes.

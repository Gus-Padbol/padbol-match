# Primera corrección guiada con Juan Pablo

Objetivo: demostrar el circuito completo desde Windows sin tocar producción.

## Corrección recomendada

Elegir un texto visible de QA que no afecte datos, pagos, autenticación ni permisos. Cambiarlo en una rama, comprobarlo en preview y revertirlo después.

## Secuencia

1. Confirmar cuenta propia y rama de continuidad correcta.
2. Crear `test/juan-pablo-handoff`.
3. Modificar un texto inocuo y ajustar su prueba.
4. Ejecutar pruebas y build local.
5. Subir la rama y abrir Pull Request.
6. Ver el preview y capturar el resultado.
7. No fusionar a producción: revertir el cambio o cerrar el Pull Request.
8. Confirmar que puede leer logs QA y que no ve secretos innecesarios.

## Éxito

Juan Pablo completa el recorrido sin conectarse a la Mac, sin usar la cuenta personal de Gustavo y sin modificar producción, DNS ni datos reales.

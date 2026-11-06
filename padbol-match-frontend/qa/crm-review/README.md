# Revisión visual local del CRM

Solo fixtures ficticios. Se renderizan CommercialCrmPage, WhatsappCrmDemo, CommercialSpaceRequest y cabeceras reales; AuthContext, fetchMiRol y APIs se sustituyen por mocks. Las mutaciones del fixture fallan deliberadamente; CSP y window.fetch impiden conexiones externas. No ofrece autenticación ni prueba de autorización del backend. No desplegar esta carpeta.

La aplicación CRA no importa esta carpeta. El fixture requiere Vite ya instalado: ejecutar su binario con `--config qa/crm-review/vite.config.mjs`, desde padbol-match-frontend. Si Vite está en otro workspace, definir CRM_QA_VITE_MODULE con la ruta absoluta a vite/dist/node/index.js. No se agregó dependencia ni se modificaron lockfiles.

Puerto local 127.0.0.1:4392; raíz muestra CRM. `/space?width=420`, 520 y 760 muestran el componente a ancho real de panel; `&pending=1` muestra preparación sin render. El selector Rol comprueba visibilidad del regreso únicamente, no modifica los permisos ficticios del CRM.

Pruebas Jest focalizadas usan setupTests.js y scripts/crm-review-network-guard.cjs como setupFilesAfterEnv, evitando tráfico externo. Ver informe en outputs del chat para resultados y alcance.

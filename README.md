# Tab Twins

Extensión para Brave, Chrome y Firefox que encuentra pestañas duplicadas, pensada para quien deja muchas pestañas abiertas (por ejemplo, novelas web) y acaba abriendo la misma obra dos veces. Nada se cierra solo: compara y decides tú.

## Instalar (modo desarrollador)

1. Abre `brave://extensions` (o `chrome://extensions`).
2. Activa **Modo de desarrollador**.
3. **Cargar descomprimida** → elige esta carpeta (la que contiene `manifest.json`).
4. Fija el icono en la barra. Tras cambiar el código, pulsa ↻ en la tarjeta de la extensión.

### Firefox (140 o superior)

1. Abre `about:debugging#/runtime/this-firefox`.
2. **Cargar complemento temporal…** → elige `manifest.json` de esta carpeta.
3. Si el gestor muestra «Dar acceso», púlsalo: Firefox permite no conceder el acceso a las webs, y sin él no hay capturas ni scroll.

Los complementos temporales se quitan al cerrar Firefox. Para tenerlo fijo hay que firmarlo en addons.mozilla.org (se puede firmar sin publicarlo).

## Qué hace

- **Popup**: buscador de todas las pestañas abiertas (↑ ↓ Intro para ir), aviso si la pestaña actual tiene gemelas y resumen de grupos.
- **Gestor** (página completa):
  - Grupos de **idénticas** (misma URL sin `#`, `utm_*`, `www.`…) y de **misma obra** (misma web y la misma novela en la URL o en el título aunque cambie el capítulo).
  - Filtros por ventana, grupo de pestañas de Chrome, tipo y texto.
  - Cerrar una, las seleccionadas, las duplicadas de un grupo o todas las duplicadas de lo filtrado. Siempre con confirmación (salvo el botón «Cerrar» de una sola) y con **Deshacer**.
  - Regla para elegir cuál se conserva: capítulo más avanzado, visitada más recientemente o abierta primero. Las fijadas nunca se cierran en bloque.
  - **Comparar**: captura, título, URL, capítulo, última visita, cuánto se ha leído (scroll) y ubicación, lado a lado.
- Contador de pestañas sobrantes en el icono.

## Permisos y privacidad

- `tabs`, `tabGroups`: leer títulos, URLs y grupos de pestañas.
- `<all_urls>` y `scripting`: capturar la pestaña visible y leer la posición de scroll.
- `storage`, `unlimitedStorage`: guardar capturas (JPEG pequeños) y scroll.

Todo se guarda **solo en local** y se borra cuando ya no queda ninguna pestaña abierta con esa URL. Las capturas automáticas (al visitar una pestaña) se pueden desactivar en el gestor.

## Limitaciones conocidas

- Chrome solo puede capturar la pestaña **visible** de cada ventana: las pestañas que no has visitado desde que instalaste la extensión no tienen captura hasta que pulsas «Capturar» o «Actualizar capturas» (las activa un momento).
- El scroll de pestañas abiertas antes de instalar la extensión y que estén dormidas aparece «Sin datos» hasta que las recargas.
- La detección de «misma obra» es heurística: webs con URLs poco habituales pueden no agruparse.
- En Firefox, pestañas con la misma URL en contenedores distintos se tratan como duplicadas.

## Desarrollo

Sin dependencias ni build. Tests de la lógica de detección:

```sh
npm test
```

El mismo `manifest.json` sirve para los dos navegadores: Chrome usa `background.service_worker` y Firefox `background.scripts` (con el mismo archivo). El ID de Firefox (`tab-twins@local`) es provisional: cámbialo antes de publicar, porque en addons.mozilla.org es permanente.

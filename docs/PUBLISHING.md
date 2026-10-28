# Publicar Tab Twins

Guía para el mantenedor: qué hacer antes de abrir el repositorio al público y cómo llevar la extensión a las tiendas.

## 1. Antes de hacer público el repositorio

- [x] Licencia (`LICENSE`, MIT).
- [x] README en inglés y español con descargas por navegador.
- [x] Política de privacidad (`PRIVACY.md`). Las tiendas piden un enlace a ella.
- [x] CHANGELOG.
- [x] Tests en GitHub Actions y release automática al etiquetar.
- [x] Historial revisado: no hay secretos en los archivos.
- [ ] **Correo en los commits.** La mayoría de commits llevan tu nombre completo y tu correo personal, que se ven en un repositorio público. Opciones:
  - Dejarlo así.
  - Usar el correo `noreply` de GitHub en adelante: `git config user.email "80778930+Aigen1111@users.noreply.github.com"` dentro del repo, y activar en GitHub › Settings › Emails «Keep my email addresses private».
  - Reescribir el historial para cambiar los commits ya hechos (requiere un push forzado a `main`; decidirlo antes de hacerlo público).
- [ ] **ID de Firefox definitivo.** Ahora es `tab-twins@local` (en `manifest.json`, `browser_specific_settings.gecko.id`). En Firefox Add-ons el ID es permanente: cámbialo antes de la primera subida. Formato recomendado: `tab-twins@<algo-tuyo>` con forma de correo, aunque no tiene que existir.
- [ ] **Titular del copyright** en `LICENSE` (ahora `Aigen1111`). Puedes poner tu nombre o dejar el usuario de GitHub.
- [ ] Hacer público el repositorio: GitHub › Settings › General › Danger Zone › Change visibility.

## 2. Publicar una versión con descargas

1. Sube `version` en `manifest.json` y apunta los cambios en `CHANGELOG.md`.
2. Fusiona en `main`.
3. Crea y sube la etiqueta:

   ```sh
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. GitHub Actions pasa los tests, genera los dos zips y crea la release con ellos. Los enlaces del README a la «última versión» apuntan ahí.

Para probar el empaquetado en local: `npm run package` (deja los zips en `dist/`, que Git ignora).

## 3. Firefox Add-ons (escritorio y Android)

Es gratis y es la única forma de que Firefox la instale de forma permanente, también en Android.

1. Crea una cuenta en [addons.mozilla.org](https://addons.mozilla.org/developers/).
2. **Submit a New Add-on** › **On this site** (listada, aparece en la tienda) y sube `tab-twins-<versión>-firefox.zip`.
3. Marca la compatibilidad con **Firefox for Android** además de escritorio.
4. Rellena la ficha: descripción (puedes partir del README), capturas de `docs/screenshots/`, categoría «Tabs», enlace a `PRIVACY.md`.
5. Revisión: el linter dará 12 avisos por `innerHTML`. No son errores (todo el texto dinámico se escapa con `escapeHtml`), pero un revisor podría pedir explicaciones. Si lo piden, la respuesta es esa.

Alternativa sin ficha pública: **On your own** (no listada). Mozilla firma el archivo y te devuelve un `.xpi` que puedes adjuntar a la release. En escritorio se instala desde **Complementos › ⚙ › Instalar complemento desde archivo**; en Android, con el menú oculto (ver README).

## 4. Chrome Web Store (Chrome, Brave, Edge…)

Brave, Opera y Vivaldi usan la Chrome Web Store, así que basta con publicar ahí. Edge tiene su propia tienda (opcional).

1. Registra una cuenta de desarrollador en el [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Tiene una cuota única (5 USD según la última información encontrada; compruébalo al registrarte).
2. Sube `tab-twins-<versión>-chromium.zip`.
3. En **Privacy practices**:
   - Justifica cada permiso (puedes copiar la tabla del README).
   - Declara que no recoges datos de usuario.
   - Enlaza `PRIVACY.md`.
4. El permiso de acceso a todas las webs suele alargar la revisión. Es necesario para las capturas y el scroll.

## 5. Después de publicar

- Sustituye en ambos README las filas «cuando esté publicada» por los enlaces a las tiendas.
- Cada versión nueva: etiqueta en GitHub y sube el mismo zip a cada tienda.

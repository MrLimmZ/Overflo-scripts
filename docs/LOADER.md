# Chargeur Webflow (main.js / main.css)

Le site Webflow charge `main.css` et `main.js` depuis jsDelivr, à la version
exacte du dernier deploy :

1. Le chargeur lit `version.json` sur `raw.githubusercontent.com` (sans cache
   navigateur, 5 minutes de cache max côté GitHub).
2. Il charge `https://cdn.jsdelivr.net/gh/MrLimmZ/Overflo-scripts@<version>/main.css`
   puis `.../main.js`. Chaque deploy a sa propre adresse (tag `vX.Y.Z`), donc
   aucun navigateur ne garde un ancien fichier.
3. Si `version.json` ne répond pas (1,5 s max), repli sur `@main`.

En staging (`*.webflow.io`), avec `FORCE_PROD = false`, le chargeur essaie
d'abord le serveur local (`npm run dev`) puis le tunnel, avec rechargement
automatique.

`npm run deploy` (scripts/deploy.js) écrit `version.json`, crée le tag, pousse
`main` et le tag, puis vérifie que jsDelivr sert les bons fichiers.

## Code à coller dans Webflow

Réglages du site → Custom code. Remplace les deux anciens scripts du chargeur
(celui des CSS et celui du JS).

### Head code

```html
<script>
  (function () {
    const FORCE_PROD = true;

    const REPO = 'MrLimmZ/Overflo-scripts';
    const DEV_ORIGINS = ['http://localhost:3000', 'https://dev.michelaxel.fr'];
    const VERSION_URL = 'https://raw.githubusercontent.com/' + REPO + '/main/version.json';
    const CDN = 'https://cdn.jsdelivr.net/gh/' + REPO + '@';

    const host = window.location.hostname;
    const isStaging = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.webflow.io');

    function getProdVersion() {
      const ctrl = new AbortController();
      const timer = setTimeout(function () { ctrl.abort(); }, 1500);
      return fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store', signal: ctrl.signal })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return d && d.version ? d.version : 'main'; })
        .catch(function () { return 'main'; })
        .finally(function () { clearTimeout(timer); });
    }

    async function findDevOrigin() {
      if (FORCE_PROD || !isStaging) return null;
      for (const origin of DEV_ORIGINS) {
        try {
          await fetch(origin + '/main.css', { method: 'HEAD' });
          return origin;
        } catch (e) {}
      }
      return null;
    }

    window.__overflo = (async function () {
      const dev = await findDevOrigin();
      if (dev) return { base: dev, dev: true };
      const version = await getProdVersion();
      return { base: CDN + version, version: version };
    })();

    window.__overflo.then(function (o) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = o.base + '/main.css';
      document.head.appendChild(link);
      console.log('[Overflo] CSS :', link.href);
      if (o.dev) {
        try {
          new EventSource(o.base + '/esbuild').addEventListener('change', function () {
            location.reload();
          });
        } catch (e) {}
      }
    });
  })();
</script>
```

### Footer code (avant `</body>`)

```html
<script>
  (window.__overflo || Promise.resolve({ base: 'https://cdn.jsdelivr.net/gh/MrLimmZ/Overflo-scripts@main' }))
    .then(function (o) {
      const script = document.createElement('script');
      script.src = o.base + '/main.js';
      document.body.appendChild(script);
      console.log('[Overflo] JS :', script.src);
    });
</script>
```

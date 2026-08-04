# Overflo — dev environment (esbuild)

Base neutre inspirée du setup Marlone, mais sur **esbuild seul** (pas de vite,
pas de cat+chokidar+terser). Un seul outil pour : bundler les modules JS,
bundler/minifier le CSS, servir en local avec CORS, et builder pour la prod.

## Structure

```
Overflo/
├── src/
│   ├── index.js         → point d'entrée JS (importe les modules)
│   ├── core.js           → init globaux (Lenis, etc.)
│   ├── nav.js            → exemple de module (à dupliquer/adapter)
│   └── styles/
│       └── main.css      → point d'entrée CSS
├── build.js              → script esbuild (dev serve / watch / build prod)
├── purge.js               → purge du cache jsDelivr après déploiement
├── package.json
└── (générés) main.js, main.css
```

Chaque nouvelle fonctionnalité = un fichier dans `src/` (ex: `lightbox.js`,
`quickview.js`...), importé dans `src/index.js`. Contrairement au setup
Marlone (concaténation brute de globals), ici on utilise de vrais modules ES
(`import`/`export`) — esbuild se charge du bundling.

## Commandes

```bash
npm install       # installe esbuild
npm run dev        # serveur local avec live rebuild + CORS, sur :3000
npm run build       # build prod minifié → main.js + main.css
npm run deploy       # build + commit + push + purge jsDelivr
```

## 1. Dev local

```bash
npm run dev
```
→ sert `main.js` et `main.css` sur `http://localhost:3000` avec les headers
CORS déjà configurés (indispensable pour que Webflow puisse fetch depuis un
autre domaine). Rebuild automatique à chaque sauvegarde dans `src/`.

## 2. Staging (test sur `.webflow.io`)

```bash
npx cloudflared tunnel --url http://localhost:3000
```
→ donne une URL `https://xxx.trycloudflare.com` à coller dans `DEV_URLS`
(head/body code Webflow). Cette URL change à chaque lancement du tunnel
(sauf tunnel nommé avec compte Cloudflare).

## 3. Prod : GitHub + jsDelivr

```bash
npm run deploy
```
→ build, commit, push sur `MrLimmZ/Overflo-scripts`, puis purge le cache
jsDelivr pour forcer la mise à jour de :
- `https://cdn.jsdelivr.net/gh/MrLimmZ/Overflo-scripts@main/main.js`
- `https://cdn.jsdelivr.net/gh/MrLimmZ/Overflo-scripts@main/main.css`

## 4. Webflow

Colle `webflow-head-code.html` dans **Head Code** et `webflow-body-code.html`
dans **Footer Code** (Project Settings → Custom Code). Remplace
`TON-TUNNEL-CLOUDFLARE` par ton URL de tunnel à chaque session de dev.

# Overflo — Environnement de développement

Environnement de build pour le site Overflo (Webflow), basé sur **esbuild**.
Un seul outil gère l'ensemble du pipeline : bundling des modules JavaScript,
compilation et minification du CSS, serveur de développement local, et build
de production.

## Sommaire

- [Structure du projet](#structure-du-projet)
- [Prérequis](#prérequis)
- [Commandes](#commandes)
- [Développement local](#développement-local)
- [Test sur l'environnement de staging](#test-sur-lenvironnement-de-staging)
- [Déploiement en production](#déploiement-en-production)
- [Configuration Webflow](#configuration-webflow)

## Structure du projet

```
Overflo/
├── src/
│   ├── index.js                    Point d'entrée JavaScript
│   ├── core.js                     Initialisation globale (Lenis, ScrollTrigger…)
│   ├── barba.js                    Transitions de page et réinitialisation des modules
│   ├── nav.js                      Exemple de module fonctionnel
│   ├── utils/
│   │   └── motion-preference.js    Détection prefers-reduced-motion
│   └── styles/
│       └── main.css                Point d'entrée CSS
├── build.js                        Script esbuild (serveur dev / watch / build)
├── purge.js                        Purge du cache jsDelivr après déploiement
├── package.json
└── main.js, main.css               Fichiers générés (build)
```

Chaque nouvelle fonctionnalité correspond à un fichier dans `src/` (par
exemple `lightbox.js`, `quickview.js`), importé dans `src/index.js`. Si le
module doit être réinitialisé après une navigation via Barba.js, il doit
également être ajouté dans `reinitModules()` (`src/barba.js`).

Le projet utilise des modules ES standard (`import` / `export`) ; esbuild se
charge du bundling.

## Prérequis

- Node.js (version récente recommandée)
- Un compte GitHub avec accès en écriture au dépôt `MrLimmZ/Overflo-scripts`

## Commandes

| Commande            | Description                                              |
|----------------------|-----------------------------------------------------------|
| `npm install`         | Installe les dépendances                                  |
| `npm run dev`          | Lance le serveur local avec rebuild automatique et CORS   |
| `npm run build`         | Génère le build de production minifié (`main.js`, `main.css`) |
| `npm run deploy`         | Build + commit + push + purge du cache jsDelivr           |

## Développement local

```bash
npm run dev
```

Sert `main.js` et `main.css` sur `http://localhost:3000`, avec les en-têtes
CORS nécessaires pour que Webflow puisse charger ces fichiers depuis un
autre domaine.

Le rechargement automatique est activé : à chaque sauvegarde dans `src/`,
esbuild reconstruit le bundle et la page Webflow (dev ou staging) se
recharge automatiquement, sans intervention manuelle.

Ce mécanisme repose sur l'endpoint `/esbuild` d'esbuild (Server-Sent
Events). Le script inclus dans `webflow-head-code.html` s'y connecte
automatiquement lorsqu'il détecte un environnement de dev ou de staging, et
reste inactif en production (aucune requête vers jsDelivr dans ce cas).

## Test sur l'environnement de staging

Pour tester les changements directement sur le domaine `.webflow.io` :

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Cette commande génère une URL temporaire (`https://xxx.trycloudflare.com`),
à renseigner dans `DEV_URLS` (head et body code Webflow). Cette URL change à
chaque lancement du tunnel, sauf en cas d'utilisation d'un tunnel nommé
associé à un compte Cloudflare.

## Déploiement en production

```bash
npm run deploy
```

Cette commande effectue le build, commit et push les fichiers générés sur le
dépôt `MrLimmZ/Overflo-scripts`, puis purge le cache jsDelivr afin de forcer
la mise à jour des fichiers servis en production :

- `https://cdn.jsdelivr.net/gh/MrLimmZ/Overflo-scripts@main/main.js`
- `https://cdn.jsdelivr.net/gh/MrLimmZ/Overflo-scripts@main/main.css`

## Configuration Webflow

Dans **Project Settings → Custom Code** :

- Coller le contenu de `webflow-head-code.html` dans **Head Code**
- Coller le contenu de `webflow-body-code.html` dans **Footer Code**

Lors d'une session de développement local, remplacer `TON-TUNNEL-CLOUDFLARE`
par l'URL du tunnel Cloudflare actif.
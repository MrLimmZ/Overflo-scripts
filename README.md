# Overflo — scripts et styles du site Webflow

Le JavaScript et le CSS du site Overflo (Webflow), bundlés par **esbuild**.
Le build produit deux fichiers à la racine, `main.js` et `main.css`, servis
au site par jsDelivr depuis ce dépôt GitHub.

## Sommaire

- [Structure](#structure)
- [Commandes](#commandes)
- [Développement local](#développement-local)
- [Mise en production](#mise-en-production)
- [Configuration Webflow](#configuration-webflow)
- [Ajouter une fonctionnalité](#ajouter-une-fonctionnalité)

## Structure

```
Overflo/
├── src/
│   ├── index.js            Point d'entrée : Lenis, accordéons, Barba
│   ├── core/               Démarrage du site
│   │   ├── lenis.js            Smooth scroll (desktop) relié à ScrollTrigger
│   │   ├── page-transitions.js Barba + (ré)initialisation à chaque page
│   │   ├── modules.js          Liste ordonnée des modules lancés sur chaque page
│   │   └── webflow.js          File d'attente Webflow, relance des interactions
│   ├── components/         Éléments d'interface (nav, boutons, accordéons,
│   │                       select, carrousels, vidéos décoratives…)
│   ├── content/            Contenu CMS : blocs [table] [steps], titres,
│   │                       sommaire d'article, filtre du blog, aide
│   ├── animations/         Animations simples (fondus au scroll, parallaxes,
│   │                       en-tête produit, étoiles…)
│   ├── sections/           Grandes sections animées et épinglées au scroll
│   │                       (home header, explain, how, what, zoom, why, quote)
│   ├── embeds/             Blocs data-embed="…" (tilt-stack, carousel-loop)
│   ├── schema/             Données structurées schema.org (SEO)
│   ├── utils/              Fonctions partagées (breakpoints, motion, math…)
│   └── styles/             SCSS (main.scss importe les partiels)
├── scripts/
│   ├── build.js            Build / serveur de dev esbuild
│   ├── dev-proxy.js        Proxy pour le tunnel Cloudflare
│   └── purge.js            Purge du cache jsDelivr après déploiement
├── docs/
│   ├── CMS.md              Blocs personnalisés dans le rich text du CMS
│   └── VIDEO.md            Vidéos décoratives (attributs data-video-*)
└── main.js, main.css       Fichiers générés (ne pas modifier à la main)
```

Chaque module exporte une fonction `initXxx(root)` qui reçoit la page
courante et ne fait rien si sa section n'est pas présente. `core/modules.js`
les appelle toutes, dans l'ordre, au premier chargement puis après chaque
transition Barba.

## Commandes

| Commande         | Rôle                                                        |
|------------------|-------------------------------------------------------------|
| `npm install`    | Installe les dépendances                                    |
| `npm run dev`    | Serveur local + rebuild automatique + proxy + tunnel        |
| `npm run build`  | Build de production minifié (`main.js`, `main.css`)         |
| `npm run deploy` | Build + commit + push + purge du cache jsDelivr             |

## Développement local

```bash
npm run dev
```

Sert `main.js` et `main.css` sur `http://localhost:3000` (avec les en-têtes
CORS nécessaires à Webflow). Chaque sauvegarde dans `src/` relance le build
et recharge la page Webflow (dev ou staging) automatiquement, grâce à
l'endpoint `/esbuild` d'esbuild.

Pour tester sur le domaine `.webflow.io`, le tunnel Cloudflare expose le
serveur local (port 3001 via `scripts/dev-proxy.js`). Son URL doit figurer
dans `DEV_URLS` du code personnalisé Webflow, et `FORCE_PROD` doit valoir
`false`.

## Mise en production

```bash
npm run deploy
```

Build, commit et push des fichiers générés sur `MrLimmZ/Overflo-scripts`,
puis purge du cache jsDelivr pour que le site serve la nouvelle version :

- `https://cdn.jsdelivr.net/gh/MrLimmZ/Overflo-scripts@main/main.js`
- `https://cdn.jsdelivr.net/gh/MrLimmZ/Overflo-scripts@main/main.css`

La date de build s'affiche dans la console du navigateur
(`[Overflo] main.js — build …`), pratique pour vérifier la version servie.

## Configuration Webflow

Dans **Site Settings → Custom Code**, le Head Code charge `main.css` et le
Footer Code charge `main.js`. Les deux scripts choisissent entre la version
locale (`DEV_URLS`) et la version jsDelivr (`PROD_URL`) ; `FORCE_PROD = true`
force jsDelivr.

Le site doit aussi charger GSAP + ScrollTrigger, Lenis et Barba (déjà en
place dans Webflow).

## Ajouter une fonctionnalité

1. Créer le fichier dans le bon dossier (ex. `src/components/lightbox.js`)
   avec une fonction `export function initLightbox(root = document)`.
2. L'importer dans `src/core/modules.js` et l'ajouter à `PAGE_MODULES`
   (ou à `PINNED_SECTIONS` si la section est épinglée au scroll).
3. Si un listener global (`window`, `matchMedia`…) est nécessaire, utiliser
   les helpers de `src/utils/listeners.js` : ils se retirent tout seuls quand
   Barba change de page.

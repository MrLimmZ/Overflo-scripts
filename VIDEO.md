# Vidéos décoratives — référence

Système permettant de remplacer n'importe quelle image du site par une vidéo silencieuse (avec fond transparent supporté), sans lien avec le CMS, entièrement piloté par attributs `data-*` posés directement dans Webflow Designer.

Fichier source : `src/decorative-videos.js`

---

## Principe général

Toute `<img>` portant l'attribut `data-video-source` est automatiquement remplacée par une `<video>` au chargement de la page (module `initDecorativeVideos`). L'image d'origine sert de **poster** (affichée pendant le chargement) et de **fallback** (si la vidéo échoue à charger, l'image est restaurée à l'identique).

La vidéo remplace l'image **en place** : mêmes classes CSS, même style inline (y compris un éventuel `transform`), mêmes attributs `data-*` non liés à la vidéo. Tout code existant qui cible les classes de l'image (GSAP, ScrollTrigger…) continue de fonctionner sans modification, à condition que `initDecorativeVideos` s'exécute **avant** ces autres modules.

Respecte `prefers-reduced-motion` : si activé, aucune vidéo n'est créée, l'image reste affichée telle quelle.

---

## Attributs — posés sur l'`<img>`

| Attribut | Rôle | Valeurs | Défaut |
|---|---|---|---|
| `data-video-source` | URL de la vidéo (requis) | URL absolue ou relative | — |
| `data-video-id` | Identifiant pour piloter la vidéo depuis un autre module ou un bouton | texte libre | auto-généré (`video-1`, `video-2`…) |
| `data-video-trigger` | Mode de déclenchement | `visible` / `manual` | `visible` |
| `data-video-autoplay` | Lecture automatique (mode `visible` uniquement) | `true` / `false` | `true` |
| `data-video-loop` (alias `data-video-infinite`) | Boucle sur toute la vidéo | `true` / `false` | `true` |
| `data-video-lazy` | Coupe la lecture hors viewport (mode `visible`) | `true` / `false` | `true` |
| `data-video-delay` | Délai en ms avant lecture, après un `trigger()` | nombre (ms) | `0` |
| `data-video-loop-start` | Temps (secondes) où repart la boucle après l'intro | nombre (s) | — |
| `data-video-loop-end` | Temps (secondes) où la boucle revient à `loop-start` | nombre (s) | — |
| `data-video-replay` | Rejoue l'intro depuis 0 à chaque nouveau `trigger()` | `true` / `false` | `true` |

Si `data-video-loop-start`/`data-video-loop-end` ne sont pas définis, le comportement de bouclage reste simple (`video.loop` natif, piloté par `data-video-loop`).

---

## Attributs — posés sur un bouton de contrôle

N'importe quel élément cliquable peut devenir un contrôle play/pause/toggle pour une vidéo précise, sans JS à écrire :

| Attribut | Rôle | Valeurs | Défaut |
|---|---|---|---|
| `data-video-control` | ID de la vidéo à cibler (doit matcher `data-video-id`) | texte libre | — |
| `data-video-action` | Action déclenchée au clic | `play` / `pause` / `toggle` | `toggle` |

Le bouton reçoit automatiquement la classe `is-playing`, synchronisée en temps réel avec l'état réel de la vidéo (utile pour un swap d'icône play/pause en CSS) :

```scss
[data-video-control] .icon-play { display: block; }
[data-video-control] .icon-pause { display: none; }
[data-video-control].is-playing .icon-play { display: none; }
[data-video-control].is-playing .icon-pause { display: block; }
```

---

## Mode `visible` (défaut)

Comportement autonome, sans code additionnel : la vidéo joue/pause automatiquement selon sa présence dans le viewport (si `data-video-lazy` n'est pas à `false`), démarre en autoplay si `data-video-autoplay` n'est pas à `false`.

Cas d'usage : décor purement visuel, sans lien avec une logique de section ou de scroll précis (ex: petite animation en fond d'une carte).

---

## Mode `manual`

La vidéo ne joue jamais toute seule. Un autre module doit récupérer son contrôleur et l'orchestrer explicitement :

```javascript
import { getVideoController } from "./decorative-videos.js";

const controller = getVideoController("mon-id-video");
```

### API du contrôleur

| Méthode | Effet |
|---|---|
| `trigger()` | Lance la lecture (après le délai configuré). Repart de 0 si `replay=true` ou si l'intro n'a jamais joué. |
| `reset()` | Remet tout à zéro sans jouer. Un futur `trigger()` rejouera l'intro depuis le début. |
| `close()` | Met en pause immédiatement, sans réinitialiser l'état intro/boucle. |
| `play()` | Lecture directe, sans logique de délai/replay. |
| `pause()` | Pause directe. |
| `toggle()` | Bascule play/pause selon l'état actuel. |
| `isPlaying()` | Retourne `true`/`false`. |

### Exemple — section pilotée par le scroll

```javascript
import { getVideoController } from "./decorative-videos.js";

export function initProductSection(root = document) {
  const section = root.querySelector(".product-section");
  if (!section) return;

  const controller = getVideoController("product-hero-video");
  if (!controller) return;

  ScrollTrigger.create({
    trigger: section,
    start: "top center",
    end: "bottom center",
    onEnter: () => controller.trigger(),      // entre dans la section en scrollant vers le bas
    onEnterBack: () => controller.trigger(),  // revient dans la section en remontant
    onLeaveBack: () => controller.reset(),    // quitte par le haut : prêt à rejouer au retour
    onLeave: () => controller.close(),        // quitte par le bas : ferme proprement
  });
}
```

Correspondance avec le scénario "section produit" :

1. **Animation de section → vidéo après délai** : `onEnter` appelle `trigger()`, qui attend `data-video-delay` ms.
2. **Intro jouée une fois puis boucle sur une plage** : dès la première fin de lecture (`ended`), si `loop-start`/`loop-end` sont définis, la vidéo revient à `loop-start` et boucle indéfiniment entre les deux bornes.
3. **Remonter puis revenir sur la section** : `onLeaveBack` appelle `reset()` (état remis à zéro) ; `onEnterBack` rappelle `trigger()`, qui rejoue donc l'intro depuis le début.
4. **Animation de fermeture** : `onLeave` appelle `close()`, qui coupe la lecture proprement.

---

## Ordre d'exécution requis dans `barba.js`

```javascript
import { initDecorativeVideos, initVideoControls } from "./decorative-videos.js";

function reinitModules(root) {
  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.getAll().forEach((st) => st.kill());
  }

  initDecorativeVideos(root); // 1. tout en premier : remplace les <img> par des <video>
  initVideoControls(root);    // 2. juste après : câble les boutons play/pause/toggle

  // 3. tous les autres modules ensuite (ils doivent trouver les
  //    <video> déjà en place s'ils ciblent les mêmes classes CSS)
  initCollapseEnhance(root);
  // ...
  initZoomReveal(root);
  initDuoSlider(root);
  // ...
}
```

`initDecorativeVideos` vide ses maps internes (`controllers`, `videosById`) à chaque appel — sûr à rappeler à chaque transition Barba sans accumuler de références mortes vers des éléments retirés du DOM.

---

## Format vidéo et transparence

- **MP4/H.264** : jamais de transparence possible, quel que soit l'hébergeur.
- **WebM (VP9) avec alpha** : supporté par Chrome/Firefox/Edge. Support historiquement fragile sur Safari.
- **Webflow retranscode systématiquement en MP4** dès qu'une vidéo passe par l'élément natif "Background Video" ou l'upload standard — la transparence WebM y est généralement perdue.

### Recommandation

Pour toute vidéo avec transparence, héberger en externe (Cloudinary, Bunny.net, Cloudflare Stream, ou GitHub+jsdelivr pour un usage léger) et référencer l'URL directe dans `data-video-source` — jamais passer par l'upload natif Webflow pour ces fichiers.

### Conversion MOV alpha → WebM alpha (ffmpeg)

```bash
ffmpeg -i source.mov -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -an -crf 30 -b:v 0 -vf scale=800:-1 sortie.webm
```

- `-pix_fmt yuva420p` : préserve le canal alpha (obligatoire).
- `-auto-alt-ref 0` : requis par VP9 quand l'alpha est activé.
- `-an` : retire l'audio (vidéo décorative silencieuse).
- `-crf 30 -b:v 0` : qualité constante, ajuster entre 26 (meilleure qualité) et 35+ (plus léger).

### Test local avant déploiement

Le serveur dev esbuild (`npm run dev`, `servedir: "."`) sert n'importe quel fichier statique du projet. Déposer un fichier de test hors de `/src` (ex: `test-assets/`, à ajouter au `.gitignore`) et pointer `data-video-source` vers `http://localhost:3000/test-assets/fichier.webm` pour valider le pipeline avant tout hébergement définitif.

---

## Exemple complet — section produit avec intro + boucle + contrôle manuel

**Sur l'image, dans Webflow (Custom Attributes) :**

```
data-video-source     = https://cdn.exemple.com/produit.webm
data-video-trigger     = manual
data-video-id           = product-hero-video
data-video-delay        = 600
data-video-loop-start   = 2.5
data-video-loop-end     = 6
data-video-replay       = true
```

**Sur un bouton pause/lecture à côté :**

```
data-video-control = product-hero-video
data-video-action  = toggle
```

**JS de la section (nouveau fichier, ex. `product-section.js`) :**

```javascript
import { getVideoController } from "./decorative-videos.js";

export function initProductSection(root = document) {
  const section = root.querySelector(".product-section");
  const controller = getVideoController("product-hero-video");
  if (!section || !controller) return;

  ScrollTrigger.create({
    trigger: section,
    start: "top center",
    end: "bottom center",
    onEnter: () => controller.trigger(),
    onEnterBack: () => controller.trigger(),
    onLeaveBack: () => controller.reset(),
    onLeave: () => controller.close(),
  });
}
```
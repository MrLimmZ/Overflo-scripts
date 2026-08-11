# Blocs de contenu custom dans le CMS

Webflow ne permet pas de créer nativement des tableaux, accordéons ou
listes d'étapes dans un champ Rich Text. Pour le tableau, l'accordéon et
les steps, il n'y a **rien à coller en HTML** : tu tapes directement le
texte avec des crochets `[...]` dans le rich text, comme n'importe quel
paragraphe. Un script transforme automatiquement ce texte en bloc stylé
et accessible au chargement de la page.

Seule la citation personnalisée (section 4) nécessite un bloc **Embed**
avec du HTML, car il n'y a pas de script qui la génère automatiquement.

---

## 1. Tableau

Tape directement dans le rich text (aucun Embed nécessaire) :

```
[table caption="Savings account comparison"]
Account type, Interest rate, Accessibility
High-yield savings, 4.75% APY, 1-2 days
Money market fund, 4.50% APY, 1-3 days
Checking account, 0.10% APY, Instant
Short-term CD, 5.25% APY, Locked
[/table]
```

- **La première ligne est toujours l'en-tête** (noms de colonnes), les
  lignes suivantes sont les données.
- **Une valeur par cellule, séparée par une virgule** — pas de virgule à
  l'intérieur d'une valeur (ex: écris `4750 EUR` plutôt que `4,750 EUR`).
- **Une ligne = une ligne du tableau** : appuie sur Entrée entre chaque
  ligne (peu importe que ça crée un nouveau paragraphe ou un simple
  retour à la ligne, les deux fonctionnent).

`caption="..."` est **obligatoire** — c'est le titre du tableau, annoncé
par les lecteurs d'écran avant le contenu (ex: "Tableau : Savings account
comparison"). Sans lui, le tableau reste utilisable visuellement mais
n'a aucun nom pour les technologies d'assistance. Mets une phrase courte
qui décrit ce que montre le tableau.

**Variante `split`** — utilise-la si la première colonne sert
d'étiquette à chaque ligne plutôt que d'être une donnée comme les
autres (ex: le nom du type de compte dans l'exemple ci-dessus est le
sujet de la ligne, pas juste une valeur parmi d'autres) :

```
[table split caption="Savings account comparison"]
Account type, Interest rate, Accessibility
High-yield savings, 4.75% APY, 1-2 days
...
[/table]
```

⚠️ **L'ordre compte** : `split` doit toujours venir avant `caption="..."`.
`[table caption="..." split]` ne fonctionnera pas — le script ne le
reconnaîtra pas comme un tableau.

`[table]` tout court (sans `split` ni `caption`) fonctionne aussi, mais
évite de t'en servir : le tableau sera généré sans nom accessible.

---

## 2. Liste de collapse (accordéon)

Tape directement dans le rich text :

```
[collapse]
[q]How long do withdrawals take?[/q]
Withdrawals typically take 1 to 3 business days, depending on your bank.

[q]Can I withdraw anytime?[/q]
Yes, there's no lock-in period. Funds are simply subject to the
processing time above.
[/collapse]
```

- **`[q]...[/q]`** contient la question — reste en texte simple, c'est
  ce qui devient le texte cliquable de l'accordéon.
- **Le texte après `[/q]`** jusqu'à la prochaine `[q]` ou jusqu'à
  `[/collapse]` devient la réponse. Tu peux y mettre du texte avec mise
  en forme normale (gras, liens, listes) — ça reste dans la réponse tel
  quel.
- Duplique le bloc `[q]...[/q]` + réponse pour chaque question, autant
  de fois que nécessaire, toujours à l'intérieur du même
  `[collapse]...[/collapse]`.

Tu n'as **aucun attribut d'accessibilité à gérer** : le script détecte
tout accordéon généré (ou même collé en HTML brut si jamais tu en as
besoin un jour) et ajoute lui-même la navigation clavier et les
attributs nécessaires pour les lecteurs d'écran.

---

## 3. Liste de steps

Tape directement dans le rich text :

```
[steps]
[step]Calculate your target[/step]
Add up your essential monthly costs: rent, utilities, groceries,
minimum debt payments, and insurance. Multiply by 3-6 months.

[step]Choose a home for it[/step]
Pick a high-yield savings account that's separate from your everyday
spending money and offers easy transfers.
[/steps]
```

- **`[step]...[/step]`** contient le titre de l'étape.
- **Le texte après `[/step]`** jusqu'au prochain `[step]` ou jusqu'à
  `[/steps]` devient la description de l'étape — mise en forme normale
  autorisée, comme pour les réponses de l'accordéon.
- **Le numéro de chaque étape est automatique** (1, 2, 3...) — pas
  besoin de l'écrire toi-même, contrairement à l'ancienne méthode en
  HTML brut.
- Duplique le bloc `[step]...[/step]` + description pour chaque étape,
  toujours à l'intérieur du même `[steps]...[/steps]`.

---

## 4. Citation personnalisée

Celle-ci n'a pas de shortcode : clique **`+` → "Embed"** dans le rich
text, colle ce HTML, remplace le contenu d'exemple.

```html
<blockquote class="rt-quote">
  <p class="rt-quote-text">"Le texte de la citation ici."</p>
  <footer>
    <img class="rt-quote-avatar" src="URL_DE_LA_PHOTO" alt="">
    <cite class="rt-quote-author">Nom de la personne, Poste</cite>
  </footer>
</blockquote>
```

Remplace `URL_DE_LA_PHOTO` par le lien de l'image (héberge-la dans
Webflow Assets et copie l'URL). Si tu n'as pas de photo, supprime la
balise `<img>` entièrement — le CSS s'adapte (pas de gap fantôme).

`<blockquote>`, `<footer>` et `<cite>` sont les balises HTML natives
prévues pour une citation avec attribution — un lecteur d'écran peut
identifier "ceci est une citation" et "ceci est son auteur" au lieu de
blocs `<div>` génériques.

Pour une citation simple sans structure spéciale, tu peux aussi juste
utiliser le bouton **Quote** natif de l'éditeur Rich Text
(`<blockquote>`) — plus rapide si tu n'as pas besoin de l'avatar/nom, et
ça reste cohérent avec la même balise utilisée ici.
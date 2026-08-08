# Blocs de contenu custom dans le CMS

Webflow ne permet pas de créer nativement des tableaux, accordéons ou
listes d'étapes dans un champ Rich Text. Pour chacun des 4 cas ci-dessous,
dans l'éditeur Rich Text du CMS : clique sur **`+` → "Embed"** entre deux
blocs, colle le snippet correspondant, remplace le contenu d'exemple.

Le tableau, les steps et la citation sont purement du CSS (déjà dans
`main.css`). Le collapse n'a besoin d'aucun JS custom : `collapse.js`
fonctionne par délégation d'événement sur `document`, donc tant que les
classes matchent exactement, ça fonctionne directement.

---

## 1. Tableau

```html
<div class="rt-table-wrap">
  <table class="rt-table">
    <thead>
      <tr>
        <th>Colonne 1</th>
        <th>Colonne 2</th>
        <th>Colonne 3</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Ligne 1</td>
        <td>Valeur</td>
        <td>Valeur</td>
      </tr>
      <tr>
        <td>Ligne 2</td>
        <td>Valeur</td>
        <td>Valeur</td>
      </tr>
    </tbody>
  </table>
</div>
```

Ajoute/retire des `<tr>` et `<td>` selon le nombre de lignes/colonnes
nécessaires.

---

## 2. Liste de collapse (accordéon)

```html
<div class="rt-collapse-list">
  <div class="collapse-item">
    <div class="collapse-item-top">
      <div>Question ou titre 1</div>
      <div class="collapse-item-open">+</div>
      <div class="collapse-item-close" style="display: none;">−</div>
    </div>
    <div class="collapse-item-content">
      <p>Réponse ou contenu détaillé 1.</p>
    </div>
  </div>

  <div class="collapse-item">
    <div class="collapse-item-top">
      <div>Question ou titre 2</div>
      <div class="collapse-item-open">+</div>
      <div class="collapse-item-close" style="display: none;">−</div>
    </div>
    <div class="collapse-item-content">
      <p>Réponse ou contenu détaillé 2.</p>
    </div>
  </div>
</div>
```

Duplique le bloc `.collapse-item` pour chaque item. Ne touche pas aux
noms de classes (`collapse-item`, `collapse-item-top`,
`collapse-item-content`, `collapse-item-open`, `collapse-item-close`) —
c'est exactement ce que `collapse.js` écoute.

---

## 3. Liste de steps

```html
<div class="rt-steps-list">
  <div class="rt-step">
    <div class="rt-step-number">1</div>
    <div class="rt-step-content">
      <h5>Titre de l'étape 1</h5>
      <p>Description de l'étape 1.</p>
    </div>
  </div>

  <div class="rt-step">
    <div class="rt-step-number">2</div>
    <div class="rt-step-content">
      <h5>Titre de l'étape 2</h5>
      <p>Description de l'étape 2.</p>
    </div>
  </div>
</div>
```

Duplique le bloc `.rt-step` pour chaque étape, incrémente le numéro
dans `.rt-step-number` à la main (pas de génération automatique).

---

## 4. Citation personnalisée

```html
<div class="rt-quote">
  <img class="rt-quote-avatar" src="URL_DE_LA_PHOTO" alt="">
  <div>
    <p class="rt-quote-text">"Le texte de la citation ici."</p>
    <div class="rt-quote-author">Nom de la personne, Poste</div>
  </div>
</div>
```

Remplace `URL_DE_LA_PHOTO` par le lien de l'image (héberge-la dans
Webflow Assets et copie l'URL). Si tu n'as pas de photo, supprime la
balise `<img>` entièrement — le CSS s'adapte (pas de gap fantôme).

Pour une citation simple sans structure spéciale, tu peux aussi juste
utiliser le bouton **Quote** natif de l'éditeur Rich Text
(`<blockquote>`) — plus rapide si tu n'as pas besoin de l'avatar/nom.
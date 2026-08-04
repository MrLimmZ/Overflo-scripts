const files = ["main.js", "main.css"];
const repo = "MrLimmZ/Overflo-scripts";

Promise.all(
  files.map((file) =>
    fetch(`https://purge.jsdelivr.net/gh/${repo}@main/${file}`)
      .then(() => console.log(`✓ Purgé : ${file}`))
      .catch(() => console.log(`✗ Erreur : ${file}`)),
  ),
);

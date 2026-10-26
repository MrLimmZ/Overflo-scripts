// scripts/deploy.js — build + mise en ligne (npm run deploy).
//
// 1. Refuse de partir hors de la branche main (jsDelivr et le chargeur
//    Webflow ne lisent que main).
// 2. Build, puis écrit version.json avec le numéro de version suivant
//    (dernier tag vX.Y.Z + 1 au dernier chiffre).
// 3. Commit "update", tag de la version, push de main et du tag.
// 4. Purge le cache jsDelivr de @main (vérifiée) et contrôle que
//    jsDelivr sert bien les fichiers de cette version.
//
// Le chargeur Webflow lit version.json (raw.githubusercontent.com, sans
// cache navigateur) et charge main.js / main.css depuis @<version> : une
// adresse différente à chaque deploy, donc jamais d'ancien fichier en cache.

const { execSync } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const crypto = require("node:crypto");

const REPO = "MrLimmZ/Overflo-scripts";
const FILES = ["main.js", "main.css"];

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const out = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const sha1 = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function nextVersion() {
  const tags = out("git tag --list 'v*' --sort=-v:refname").split("\n").filter(Boolean);
  const latest = tags.find((t) => /^v\d+\.\d+\.\d+$/.test(t)) || "v0.0.0";
  const [major, minor, patch] = latest.slice(1).split(".").map(Number);
  return `v${major}.${minor}.${patch + 1}`;
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function purge() {
  const targets = [...FILES, "version.json"];
  const results = await Promise.all(
    targets.map(async (file) => {
      try {
        const res = await fetch(`https://purge.jsdelivr.net/gh/${REPO}@main/${file}`);
        const body = await res.json().catch(() => ({}));
        const ok = res.ok && body.status !== "failed";
        console.log(`${ok ? "✓" : "✗"} Purge @main/${file}${ok ? "" : ` (${res.status})`}`);
        return ok;
      } catch (err) {
        console.log(`✗ Purge @main/${file} (${err.message})`);
        return false;
      }
    }),
  );
  return results.every(Boolean);
}

async function verify(version) {
  // jsDelivr peut mettre quelques secondes à connaître un nouveau tag.
  for (let attempt = 1; attempt <= 6; attempt++) {
    const checks = await Promise.all(
      FILES.map(async (file) => {
        try {
          const served = await fetchText(`https://cdn.jsdelivr.net/gh/${REPO}@${version}/${file}`);
          return sha1(served) === sha1(readFileSync(file));
        } catch {
          return false;
        }
      }),
    );
    if (checks.every(Boolean)) return true;
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

async function main() {
  const branch = out("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") {
    fail(`Deploy depuis "${branch}" refusé : passe sur main (git checkout main && git merge ${branch}).`);
  }

  run("git fetch --tags --quiet origin");
  run("node scripts/build.js");

  const version = nextVersion();
  writeFileSync(
    "version.json",
    JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2) + "\n",
  );

  run("git add .");
  run(`git commit -m "update ${version}"`);
  run(`git tag ${version}`);
  run("git push origin main");
  run(`git push origin ${version}`);

  console.log("");
  const purged = await purge();
  const served = await verify(version);

  console.log("");
  console.log(served ? `✓ jsDelivr sert bien ${version}` : `✗ jsDelivr ne sert pas encore ${version} (réessaie dans une minute)`);
  if (!purged) console.log("⚠ Purge @main incomplète : seul l'ancien chargeur (adresse @main) est concerné.");
  console.log(`\nVersion en ligne : ${version}\n`);
}

main().catch((err) => fail(err.message));

const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");
const isServe = process.argv.includes("--serve");
const isDev = isWatch || isServe;

async function run() {
  const jsCtx = await esbuild.context({
    entryPoints: ["src/index.js"],
    bundle: true,
    outfile: "main.js",
    minify: !isDev,
    sourcemap: isDev,
    target: ["es2018"],
    legalComments: "none",
    logLevel: "info",
  });

  const cssCtx = await esbuild.context({
    entryPoints: ["src/styles/main.css"],
    bundle: true,
    outfile: "main.css",
    minify: !isDev,
    sourcemap: isDev,
    legalComments: "none",
    logLevel: "info",
  });

  if (isServe) {
    // Un seul des deux contexts sert de serveur HTTP, l'autre reste en watch
    const { host, port } = await jsCtx.serve({
      servedir: ".",
      port: 3000,
      cors: { origin: "*" }, // indispensable : Webflow fetch ce serveur depuis un autre domaine
    });
    await cssCtx.watch();

    const displayHost = host && host !== "0.0.0.0" ? host : "localhost";
    console.log(`\n✅ Dev server sur http://${displayHost}:${port}`);
    console.log(`   → http://${displayHost}:${port}/main.css`);
    console.log(`   → http://${displayHost}:${port}/main.js\n`);
    console.log('Astuce : lance ensuite "npx cloudflared tunnel --url http://localhost:3000"');
    console.log("pour tester depuis ton site .webflow.io (staging).\n");
  } else if (isWatch) {
    await jsCtx.watch();
    await cssCtx.watch();
    console.log("Watching...");
  } else {
    await Promise.all([jsCtx.rebuild(), cssCtx.rebuild()]);
    await Promise.all([jsCtx.dispose(), cssCtx.dispose()]);
    console.log("✅ Build terminé : main.js + main.css");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

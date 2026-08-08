const esbuild = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");

const isWatch = process.argv.includes("--watch");
const isServe = process.argv.includes("--serve");
const isDev = isWatch || isServe;

async function run() {
  const ctx = await esbuild.context({
    entryPoints: [
      { in: "src/index.js", out: "main" },
      { in: "src/styles/main.scss", out: "main" },
    ],
    bundle: true,
    outdir: ".",
    minify: !isDev,
    sourcemap: isDev,
    target: ["es2018"],
    legalComments: "none",
    logLevel: "info",
    plugins: [sassPlugin()],
  });

  if (isServe) {
    await ctx.watch();
    const { host, port } = await ctx.serve({
      servedir: ".",
      port: 3000,
      cors: { origin: "*" },
    });

    const displayHost = host && host !== "0.0.0.0" ? host : "localhost";
    console.log(`\n✅ Dev server sur http://${displayHost}:${port}`);
    console.log(`   → http://${displayHost}:${port}/main.css`);
    console.log(`   → http://${displayHost}:${port}/main.js`);
    console.log(`   → Live reload actif sur http://${displayHost}:${port}/esbuild\n`);
    console.log('Astuce : lance ensuite "npx cloudflared tunnel --url http://localhost:3000"');
    console.log("pour tester depuis ton site .webflow.io (staging).\n");
  } else if (isWatch) {
    await ctx.watch();
    console.log("Watching...");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log("✅ Build terminé : main.js + main.css");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
// dev-proxy.js

const http = require("http");

const TARGET_PORT = 3000;
const PROXY_PORT = 3001;

http
  .createServer((req, res) => {
    const proxyReq = http.request(
      {
        hostname: "localhost",
        port: TARGET_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: "localhost" },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      },
    );

    proxyReq.on("error", (err) => {
      console.error("[dev-proxy] Erreur en contactant esbuild :", err.message);
      res.writeHead(502);
      res.end("Bad Gateway — esbuild est-il bien lancé sur le port " + TARGET_PORT + " ?");
    });

    req.pipe(proxyReq, { end: true });
  })
  .listen(PROXY_PORT, () => {
    console.log(
      `[dev-proxy] http://localhost:${PROXY_PORT} -> esbuild sur le port ${TARGET_PORT}`,
    );
    console.log(`[dev-proxy] Pointe ton tunnel Cloudflare vers le port ${PROXY_PORT}, pas ${TARGET_PORT}.`);
  });
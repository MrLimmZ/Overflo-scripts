# Overflo — Development Environment

Build environment for the Overflo website (Webflow), powered by **esbuild**.
A single tool handles the entire pipeline: JavaScript module bundling,
CSS compilation and minification, local development server, and production
builds.

## Table of Contents

- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Commands](#commands)
- [Local Development](#local-development)
- [Testing on Staging](#testing-on-staging)
- [Production Deployment](#production-deployment)
- [Webflow Configuration](#webflow-configuration)

## Project Structure

```
Overflo/
├── src/
│   ├── index.js                    JavaScript entry point
│   ├── core.js                     Global initialization (Lenis, ScrollTrigger…)
│   ├── barba.js                    Page transitions and module re-initialization
│   ├── nav.js                      Example functional module
│   ├── utils/
│   │   └── motion-preference.js    prefers-reduced-motion detection
│   └── styles/
│       └── main.css                CSS entry point
├── build.js                        esbuild script (dev server / watch / build)
├── purge.js                        jsDelivr cache purge after deployment
├── package.json
└── main.js, main.css               Generated files (build output)
```

Each new feature corresponds to a file in `src/` (e.g. `lightbox.js`,
`quickview.js`), imported into `src/index.js`. If the module needs to be
re-initialized after a Barba.js page transition, it must also be added to
`reinitModules()` (`src/barba.js`).

The project uses standard ES modules (`import` / `export`); esbuild handles
the bundling.

## Requirements

- Node.js (recent version recommended)
- A GitHub account with write access to the `MrLimmZ/Overflo-scripts` repository

## Commands

| Command              | Description                                                |
|-----------------------|--------------------------------------------------------------|
| `npm install`          | Installs dependencies                                        |
| `npm run dev`           | Starts the local server with automatic rebuild and CORS      |
| `npm run build`          | Generates the minified production build (`main.js`, `main.css`) |
| `npm run deploy`          | Build + commit + push + jsDelivr cache purge                 |

## Local Development

```bash
npm run dev
```

Serves `main.js` and `main.css` on `http://localhost:3000`, with the CORS
headers required for Webflow to load these files from a different domain.

Automatic reload is enabled: every save in `src/` triggers an esbuild
rebuild, and the Webflow page (dev or staging) reloads automatically, with
no manual intervention required.

This mechanism relies on esbuild's `/esbuild` endpoint (Server-Sent Events).
The script included in `webflow-head-code.html` connects to it automatically
when it detects a dev or staging environment, and stays inactive in
production (no request to jsDelivr in that case).

## Testing on Staging

To test changes directly on the `.webflow.io` domain:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

This command generates a temporary URL (`https://xxx.trycloudflare.com`),
to be added to `DEV_URLS` (Webflow head and body code). This URL changes
every time the tunnel is restarted, unless a named tunnel linked to a
Cloudflare account is used.

## Production Deployment

```bash
npm run deploy
```

This command builds, commits, and pushes the generated files to the
`MrLimmZ/Overflo-scripts` repository, then purges the jsDelivr cache to
force an update of the files served in production:

- `https://cdn.jsdelivr.net/gh/MrLimmZ/Overflo-scripts@main/main.js`
- `https://cdn.jsdelivr.net/gh/MrLimmZ/Overflo-scripts@main/main.css`

## Webflow Configuration

In **Project Settings → Custom Code**:

- Paste the contents of `webflow-head-code.html` into **Head Code**
- Paste the contents of `webflow-body-code.html` into **Footer Code**

During a local development session, replace `TON-TUNNEL-CLOUDFLARE` with the
active Cloudflare tunnel URL.
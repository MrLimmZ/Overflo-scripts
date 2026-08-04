// ═══════════════════════════════════════════════════════════
// ENTRY POINT — importe et initialise tous les modules du site
// ═══════════════════════════════════════════════════════════
import "./core.js";
import "./nav.js";

const BUILD_VERSION = new Date().toISOString().slice(0, 10);
console.log(`%c[Overflo] main.js — build ${BUILD_VERSION}`, "color:#7dd3fc");

// src/index.js

import "./core.js";
import "./collapse.js";
import "./barba.js";

const BUILD_VERSION = new Date().toISOString().slice(0, 10);
console.log(`%c[Overflo3] main.js — build ${BUILD_VERSION}`, "color:#7dd3fc");
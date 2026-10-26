// src/components/app-modal.js
//
// Modale « Get the app » (retour client 091), ouverte par les boutons
// « Try Overflo ».
//
// Déclencheurs (délégués sur document, donc valables après chaque
// transition Barba) :
//   - tout lien ou bouton portant data-app-modal ;
//   - tout lien href="#get-app" ;
//   - tout lien href="#" dont le texte contient « Try Overflo ».
//
// Liens des stores : lus dans les badges .store-link de la page (collection
// CMS « Site Settings »). Pour les changer, modifier le CMS. STORE_FALLBACK
// ne sert que si la page n'affiche aucun badge.
//
// Sur téléphone (iOS / Android) : redirection directe vers le bon store,
// sauf tant que les liens sont provisoires (URL sans chemin, ex.
// https://apps.apple.com/) : on affiche alors la modale.
//
// QR code : pointe vers le site avec ?get-app. Ouvert sur téléphone, il
// redirige vers le bon store ; sur ordinateur, il ouvre la modale.

const QR_LIB_URL = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
const QUERY_PARAM = "get-app";

const STORE_FALLBACK = {
  ios: "https://apps.apple.com/",
  android: "https://play.google.com/",
};

const CONTENT = {
  title: "Overflo lives on your phone.",
  text: "Scan the code with your phone to download the app.",
  textMobile: "Download the app to get started.",
  reasons: [
    "Start with a few questions",
    "Get a plan that fits your direction",
    "Track your progress, anytime",
  ],
  close: "Close",
};

let modal = null;
let lastFocus = null;
let qrLibPromise = null;

function getPlatform() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || iPadOS) return "ios";
  return "desktop";
}

function findStoreLinks() {
  const links = Array.from(document.querySelectorAll("a.store-link[href]"));
  const ios = links.find((a) => /apple\.com/i.test(a.href));
  const android = links.find((a) => /play\.google\.com/i.test(a.href));
  return { ios, android };
}

function getStoreUrl(platform) {
  const link = findStoreLinks()[platform];
  return link ? link.href : STORE_FALLBACK[platform];
}

// Un lien de store « réel » pointe vers la fiche de l'app, pas vers la
// page d'accueil du store.
function isRealStoreUrl(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, "").length > 0;
  } catch {
    return false;
  }
}

function getQrTarget() {
  const url = new URL("/", window.location.origin);
  url.searchParams.set(QUERY_PARAM, "");
  return url.toString().replace(/=$/, "");
}

function loadQrLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!qrLibPromise) {
    qrLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = QR_LIB_URL;
      script.async = true;
      script.onload = () => resolve(window.qrcode);
      script.onerror = () => {
        qrLibPromise = null;
        reject(new Error("QR library failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return qrLibPromise;
}

async function renderQr(container) {
  if (container.dataset.rendered === "1") return;
  try {
    const qrcode = await loadQrLib();
    const qr = qrcode(0, "M");
    qr.addData(getQrTarget());
    qr.make();
    container.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    container.dataset.rendered = "1";
  } catch {
    // Sans QR code, les badges restent utilisables.
    container.hidden = true;
  }
}

function buildStoreBadges() {
  const wrap = document.createElement("div");
  wrap.className = "app-modal-stores";
  const { ios, android } = findStoreLinks();

  [ios, android].forEach((link, index) => {
    const platform = index === 0 ? "ios" : "android";
    let badge;
    if (link) {
      badge = link.cloneNode(true);
      badge.removeAttribute("id");
    } else {
      badge = document.createElement("a");
      badge.className = "store-link app-modal-store-fallback";
      badge.href = STORE_FALLBACK[platform];
      badge.textContent = platform === "ios" ? "App Store" : "Google Play";
    }
    badge.target = "_blank";
    badge.rel = "noopener";
    wrap.appendChild(badge);
  });

  return wrap;
}

function buildModal() {
  const root = document.createElement("div");
  root.className = "app-modal";
  root.hidden = true;
  root.innerHTML = `
    <div class="app-modal-overlay" data-app-modal-close></div>
    <div class="app-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
      <button type="button" class="app-modal-close" data-app-modal-close aria-label="${CONTENT.close}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <div class="app-modal-body">
        <div class="app-modal-text">
          <h2 id="app-modal-title" class="heading-5">${CONTENT.title}</h2>
          <p class="text-md app-modal-lead"></p>
          <ul class="app-modal-reasons">
            ${CONTENT.reasons.map((r) => `<li class="text-md">${r}</li>`).join("")}
          </ul>
        </div>
        <div class="app-modal-get">
          <div class="app-modal-qr" aria-label="QR code to download the app" role="img"></div>
        </div>
      </div>
    </div>
  `;
  root.querySelector(".app-modal-get").appendChild(buildStoreBadges());
  document.body.appendChild(root);
  return root;
}

function getFocusable(root) {
  return Array.from(
    root.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
  ).filter((el) => el.offsetParent !== null);
}

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

function isOpen() {
  return Boolean(modal && !modal.hidden);
}

// La fenêtre de la modale peut défiler si son contenu dépasse (petits
// écrans) : on laisse passer le scroll natif seulement là, et seulement
// s'il reste de la place dans ce sens (sinon le navigateur le transmettrait
// à la page).
function canScrollInside(target, deltaY) {
  const dialog = modal.querySelector(".app-modal-dialog");
  if (!dialog || !dialog.contains(target)) return false;
  if (dialog.scrollHeight <= dialog.clientHeight) return false;
  if (deltaY < 0) return dialog.scrollTop > 0;
  if (deltaY > 0) return dialog.scrollTop + dialog.clientHeight < dialog.scrollHeight - 1;
  return true;
}

// Écoutés sur window en capture et enregistrés avant les modules de page :
// passent avant les sections épinglées (Investing Simplified, etc.) qui
// pilotent elles aussi la molette.
function onWheelWhileOpen(e) {
  if (!isOpen()) return;
  e.stopImmediatePropagation();
  if (!canScrollInside(e.target, e.deltaY)) e.preventDefault();
}

let touchY = 0;
function onTouchStartWhileOpen(e) {
  if (!isOpen()) return;
  touchY = e.touches[0]?.clientY ?? 0;
}
function onTouchMoveWhileOpen(e) {
  if (!isOpen()) return;
  e.stopImmediatePropagation();
  const y = e.touches[0]?.clientY ?? touchY;
  const deltaY = touchY - y;
  touchY = y;
  if (!canScrollInside(e.target, deltaY)) e.preventDefault();
}

function onKeyDown(e) {
  if (!isOpen()) return;
  if (SCROLL_KEYS.has(e.key) && !e.target.closest("input, textarea, select")) {
    e.stopImmediatePropagation();
    // Espace sur un bouton ou un lien de la modale : on garde l'action.
    if (!(e.key === " " && e.target.closest(".app-modal button, .app-modal a"))) {
      e.preventDefault();
    }
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    closeAppModal();
    return;
  }
  if (e.key !== "Tab") return;
  const focusable = getFocusable(modal);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function openAppModal() {
  if (!modal) modal = buildModal();

  // Liens rafraîchis à chaque ouverture (le CMS peut changer entre deux pages).
  const oldStores = modal.querySelector(".app-modal-stores");
  oldStores.replaceWith(buildStoreBadges());

  const isDesktop = getPlatform() === "desktop";
  modal.classList.toggle("is-mobile", !isDesktop);
  modal.querySelector(".app-modal-lead").textContent = isDesktop ? CONTENT.text : CONTENT.textMobile;
  const qr = modal.querySelector(".app-modal-qr");
  qr.hidden = !isDesktop;
  if (isDesktop) renderQr(qr);

  lastFocus = document.activeElement;
  modal.hidden = false;
  window.lenis?.stop();
  document.documentElement.classList.add("app-modal-open");
  requestAnimationFrame(() => {
    modal.classList.add("is-open");
    modal.querySelector(".app-modal-close")?.focus();
  });
}

export function closeAppModal() {
  if (!modal || modal.hidden) return;
  modal.classList.remove("is-open");
  document.documentElement.classList.remove("app-modal-open");
  window.lenis?.start();
  const hide = () => {
    modal.hidden = true;
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) hide();
  else setTimeout(hide, 250);
  if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  lastFocus = null;
}

// Téléphone + vrais liens : direct vers le store. Sinon : modale.
function handleGetApp() {
  const platform = getPlatform();
  if (platform !== "desktop") {
    const url = getStoreUrl(platform);
    if (isRealStoreUrl(url)) {
      window.location.href = url;
      return;
    }
  }
  openAppModal();
}

function isTrigger(el) {
  if (el.matches("[data-app-modal]")) return true;
  if (el.tagName !== "A") return false;
  const href = el.getAttribute("href");
  if (href === "#get-app") return true;
  return href === "#" && /try overflo/i.test(el.textContent || "");
}

// Écouté en phase de capture : d'autres scripts (Barba, Webflow) annulent
// déjà les clics sur les liens « # » avant qu'ils n'arrivent ici.
function onDocumentClick(e) {
  if (e.button !== 0) return;
  const target = e.target.closest("a, button, [data-app-modal]");
  if (!target) return;

  if (modal && target.closest("[data-app-modal-close]")) {
    e.preventDefault();
    closeAppModal();
    return;
  }
  if (modal && modal.contains(target) && target.matches("a.store-link")) {
    // Le store s'ouvre dans un nouvel onglet : on referme la modale.
    closeAppModal();
    return;
  }
  if (!isTrigger(target)) return;
  e.preventDefault();
  e.stopPropagation();
  handleGetApp();
}

// Arrivée par le QR code (?get-app) : redirection ou ouverture de la modale.
function handleQueryParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(QUERY_PARAM)) return;
  url.searchParams.delete(QUERY_PARAM);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  handleGetApp();
}

export function initAppModal() {
  document.addEventListener("click", onDocumentClick, true);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("wheel", onWheelWhileOpen, { capture: true, passive: false });
  window.addEventListener("touchstart", onTouchStartWhileOpen, { capture: true, passive: true });
  window.addEventListener("touchmove", onTouchMoveWhileOpen, { capture: true, passive: false });
  window.addEventListener("popstate", closeAppModal);
  // Après l'init des modules de page (lancés juste après), qui peuvent
  // relancer Lenis.
  setTimeout(handleQueryParam, 0);
}

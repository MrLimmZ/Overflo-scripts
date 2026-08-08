// src/social-share.js

function openSharePopup(shareUrl) {
  window.open(shareUrl, "share", "width=600,height=500,noopener,noreferrer");
}

export function initSocialShare(root = document) {
  const row = root.querySelector(".social-row");
  if (!row) return;

  row.querySelectorAll("[data-share]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const url = window.location.href;
      const title = document.title;
      const type = btn.dataset.share;

      switch (type) {
        case "link":
          navigator.clipboard?.writeText(url).then(() => {
            btn.classList.add("is-copied");
            setTimeout(() => btn.classList.remove("is-copied"), 1500);
          });
          break;

        case "facebook":
          openSharePopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
          break;

        case "twitter":
          openSharePopup(
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
          );
          break;

        case "linkedin":
          openSharePopup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
          break;

        default:
          console.warn(`[SocialShare] data-share="${type}" inconnu`);
      }
    });
  });
}
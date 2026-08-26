// src/custom-select.js

const CHEVRON_SVG = `<svg class="custom-select-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function closeAllExcept(except) {
  document.querySelectorAll(".custom-select.is-open").forEach((el) => {
    if (el !== except) closeSelect(el);
  });
}

function closeSelect(wrapper) {
  const button = wrapper.querySelector(".custom-select-button");
  const listbox = wrapper.querySelector(".custom-select-listbox");
  wrapper.classList.remove("is-open");
  button.setAttribute("aria-expanded", "false");
  listbox.hidden = true;
}

function openSelect(wrapper) {
  closeAllExcept(wrapper);
  const button = wrapper.querySelector(".custom-select-button");
  const listbox = wrapper.querySelector(".custom-select-listbox");
  wrapper.classList.add("is-open");
  button.setAttribute("aria-expanded", "true");
  listbox.hidden = false;

  const active = listbox.querySelector('[aria-selected="true"]') || listbox.querySelector("li");
  active?.focus();
}

function setButtonText(button, text) {
  const span = button.querySelector(".custom-select-button-text");
  if (span) span.textContent = text;
}

function selectOption(wrapper, select, option) {
  const button = wrapper.querySelector(".custom-select-button");
  const listbox = wrapper.querySelector(".custom-select-listbox");

  listbox.querySelectorAll("li").forEach((li) => li.setAttribute("aria-selected", "false"));
  option.setAttribute("aria-selected", "true");

  setButtonText(button, option.textContent);

  if (select.value !== option.dataset.value) {
    select.value = option.dataset.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  closeSelect(wrapper);
  button.focus();
}

function syncFromSelect(wrapper, select) {
  const button = wrapper.querySelector(".custom-select-button");
  const listbox = wrapper.querySelector(".custom-select-listbox");
  const current = select.options[select.selectedIndex];

  setButtonText(button, current ? current.textContent : "");

  listbox.querySelectorAll("li").forEach((li) => {
    li.setAttribute("aria-selected", li.dataset.value === select.value ? "true" : "false");
  });
}

function buildListbox(select) {
  const listbox = document.createElement("ul");
  listbox.className = "custom-select-listbox";
  listbox.setAttribute("role", "listbox");
  listbox.hidden = true;

  Array.from(select.options).forEach((opt) => {
    const li = document.createElement("li");
    li.className = "text-sm";
    li.setAttribute("role", "option");
    li.setAttribute("tabindex", "-1");
    li.dataset.value = opt.value;
    li.setAttribute("aria-selected", opt.selected ? "true" : "false");
    li.textContent = opt.textContent;
    listbox.appendChild(li);
  });

  return listbox;
}

function enhanceSelect(select) {
  if (select.dataset.customSelectInit) return;
  select.dataset.customSelectInit = "1";
  if (!select.options.length) return;

  const wrapper = document.createElement("div");
  wrapper.className = "custom-select";

  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  select.classList.add("custom-select-native-hidden");
  select.setAttribute("tabindex", "-1");
  select.setAttribute("aria-hidden", "true");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-select-button text-sm";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  const current = select.options[select.selectedIndex];
  button.innerHTML = `<span class="custom-select-button-text">${current ? current.textContent : ""}</span>${CHEVRON_SVG}`;

  const listbox = buildListbox(select);

  wrapper.appendChild(button);
  wrapper.appendChild(listbox);

  button.addEventListener("click", () => {
    wrapper.classList.contains("is-open") ? closeSelect(wrapper) : openSelect(wrapper);
  });

  listbox.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (li) selectOption(wrapper, select, li);
  });

  listbox.addEventListener("keydown", (e) => {
    const items = Array.from(listbox.querySelectorAll("li"));
    const index = items.indexOf(document.activeElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[Math.min(index + 1, items.length - 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[Math.max(index - 1, 0)]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (document.activeElement.tagName === "LI") {
        selectOption(wrapper, select, document.activeElement);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSelect(wrapper);
      button.focus();
    } else if (e.key === "Tab") {
      closeSelect(wrapper);
    }
  });

  select.addEventListener("change", () => syncFromSelect(wrapper, select));
}

export function initCustomSelects(root = document) {
  const selects = root.querySelectorAll("select:not(.custom-select-native-hidden)");
  selects.forEach(enhanceSelect);
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".custom-select")) closeAllExcept(null);
});
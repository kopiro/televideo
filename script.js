"use strict";

const RAI_ORIGIN = "https://www.rainews.it";
const BASE_URL = `${RAI_ORIGIN}/atomatic/televideo-service/api/televideo/nazionale`;
const REQUEST_TIMEOUT = 15000;
const $ = (selector) => document.querySelector(selector);
const screen = $("#screen");
const image = $("#screen-img");
const feedback = $("#screen-feedback");
const status = $("#screen-status");
const retry = $("#retry");
const channelInput = $("#channel");
const pageInput = $("#page");
const formError = $("#form-error");
const state = { channel: 100, page: 1 };
let activeRequest = null;

function isValidNumber(value, min, max) {
  return /^\d+$/.test(String(value)) && Number.isInteger(Number(value)) &&
    Number(value) >= min && Number(value) <= max;
}

function clearValidation() {
  formError.hidden = true;
  channelInput.removeAttribute("aria-invalid");
  pageInput.removeAttribute("aria-invalid");
}

function renderSelection() {
  channelInput.value = String(state.channel);
  pageInput.value = String(state.page);
  $("#prevChannel").disabled = state.channel <= 100;
  $("#nextChannel").disabled = state.channel >= 899;
  $("#prevPage").disabled = state.page <= 1;
  $("#nextPage").disabled = state.page >= 99;

}

// Every request owns its fetch, image callbacks and timeout. Superseded work
// cannot change the screen, even if it completes after a newer page.
function finishRequest(request, errorMessage) {
  if (activeRequest !== request) return false;
  clearTimeout(request.timer);
  request.controller.abort();
  activeRequest = null;
  screen.setAttribute("aria-busy", "false");
  if (errorMessage) {
    status.textContent = errorMessage;
    retry.hidden = false;
  }
  return true;
}

async function setScreen(channel, page) {
  if (!isValidNumber(channel, 100, 899) || !isValidNumber(page, 1, 99)) return;
  if (activeRequest) {
    clearTimeout(activeRequest.timer);
    activeRequest.controller.abort();
  }
  state.channel = Number(channel);
  state.page = Number(page);
  clearValidation();
  renderSelection();
  image.hidden = true;
  feedback.hidden = false;
  retry.hidden = true;
  screen.setAttribute("aria-busy", "true");
  status.textContent = `Caricamento della pagina ${state.channel}…`;

  const request = { controller: new AbortController(), timer: null };
  activeRequest = request;
  request.timer = setTimeout(() => {
    finishRequest(request, "La pagina impiega troppo tempo a rispondere. Riprova.");
  }, REQUEST_TIMEOUT);

  try {
    // The reader displays subpages starting at 1; Rai's API starts at 0.
    const response = await fetch(`${BASE_URL}/${state.channel}/${state.page - 1}`, {
      signal: request.controller.signal,
      cache: "no-store",
    });
    if (activeRequest !== request) return;
    if (!response.ok) throw new Error("Page request failed");
    const data = await response.json();
    if (activeRequest !== request) return;
    if (data.status !== "OK" || !data.subPage?.imagePath) throw new Error("Page unavailable");
    const imageUrl = new URL(data.subPage.imagePath, RAI_ORIGIN);
    if (imageUrl.protocol !== "https:") throw new Error("Invalid image URL");
    // Refresh must reload the image too, not just the metadata response.
    imageUrl.searchParams.set("_tv", Date.now());
    const nextImage = new Image();
    nextImage.onload = () => {
      if (!finishRequest(request)) return;
      image.src = nextImage.src;
      image.alt = data.subPage.body?.trim() || data.subPage.title ||
        `Televideo, pagina ${state.channel}, sottopagina ${state.page}`;
      image.hidden = false;
      feedback.hidden = true;
    };
    nextImage.onerror = () => finishRequest(request,
      "Immagine non disponibile. Riprova o scegli un’altra sottopagina.");
    nextImage.src = imageUrl.href;
  } catch {
    finishRequest(request, "Pagina non disponibile. Controlla la connessione o prova un altro numero.");
  }
}

function moveSelection(channelDelta, pageDelta) {
  const channel = state.channel + channelDelta;
  const page = channelDelta ? 1 : state.page + pageDelta;
  setScreen(channel, page);
}

$("#page-form").addEventListener("submit", (event) => {
  event.preventDefault();
  clearValidation();
  const channel = channelInput.value.trim();
  const page = pageInput.value.trim();
  let invalidInput;
  if (!isValidNumber(channel, 100, 899)) {
    formError.textContent = "Inserisci una pagina da 100 a 899.";
    invalidInput = channelInput;
  } else if (!isValidNumber(page, 1, 99)) {
    formError.textContent = "Inserisci una sottopagina da 1 a 99.";
    invalidInput = pageInput;
  }
  if (invalidInput) {
    formError.hidden = false;
    invalidInput.setAttribute("aria-invalid", "true");
    invalidInput.focus();
    return;
  }
  setScreen(channel, page);
});

// Selecting text keeps the current value intact; blur never navigates.
for (const input of [channelInput, pageInput]) {
  input.addEventListener("focus", () => input.select());
  input.addEventListener("input", clearValidation);
}
$("#prevChannel").addEventListener("click", () => moveSelection(-1, 0));
$("#nextChannel").addEventListener("click", () => moveSelection(1, 0));
$("#prevPage").addEventListener("click", () => moveSelection(0, -1));
$("#nextPage").addEventListener("click", () => moveSelection(0, 1));
retry.addEventListener("click", () => setScreen(state.channel, state.page));

setScreen(100, 1);

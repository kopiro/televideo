const $screen = document.querySelector("#screen-img");
const $channel = document.querySelector("#channel");
const $page = document.querySelector("#page");
const $goButton = document.querySelector("#go");
const $prevChannel = document.querySelector("#prevChannel");
const $nextChannel = document.querySelector("#nextChannel");

const $prevPage = document.querySelector("#prevPage");
const $nextPage = document.querySelector("#nextPage");

const RAI_ORIGIN = "https://www.rainews.it";
const BASE_URL = `${RAI_ORIGIN}/atomatic/televideo-service/api/televideo/nazionale`;
const $status = document.querySelector("#screen-status");
let screenRequest = 0;

async function setScreen(channel, page) {
  const channelNumber = Number(channel);
  const pageNumber = Number(page);
  if (!Number.isInteger(channelNumber) || channelNumber < 100 ||
      channelNumber > 899 || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return;
  }

  const request = ++screenRequest;
  $screen.hidden = true;
  $status.textContent = "Caricamento…";

  try {
    const response = await fetch(`${BASE_URL}/${channelNumber}/${pageNumber - 1}`);
    if (request !== screenRequest) return;
    if (!response.ok) throw new Error("Page request failed");
    const data = await response.json();
    if (request !== screenRequest) return;
    if (data.status !== "OK" || !data.subPage?.imagePath) {
      throw new Error("Page unavailable");
    }

    // Rai supplies the image path; it may differ from the requested subpage.
    const image = new Image();
    image.onload = () => {
      if (request !== screenRequest) return;
      $screen.src = image.src;
      $screen.alt = data.subPage.title || `Televideo ${channelNumber}/${pageNumber}`;
      $screen.hidden = false;
      $status.textContent = "";
    };
    image.onerror = () => {
      if (request !== screenRequest) return;
      $status.textContent = "Pagina non disponibile. Riprova con vai.";
    };
    image.src = new URL(data.subPage.imagePath, RAI_ORIGIN).href;
  } catch {
    if (request !== screenRequest) return;
    $status.textContent = "Pagina non disponibile. Riprova con vai.";
  }
}

let tmpChannelValue = null;

// When selecting input $channel, remove value
$channel.addEventListener("focus", function () {
  tmpChannelValue = $channel.value;
  $channel.value = "";
});

$channel.addEventListener("blur", function () {
  if (!$channel.value && tmpChannelValue) {
    $channel.value = tmpChannelValue;
    tmpChannelValue = null;
  }
  $page.value = 1;

  setScreen($channel.value, $page.value);
});

let tmpPageValue = null;

// When selecting input $page, remove value
$page.addEventListener("focus", function () {
  tmpPageValue = $page.value;
  $page.value = "";
});

// On clicking Done on $page, set the screen
$page.addEventListener("blur", function () {
  if (!$page.value && tmpPageValue) {
    $page.value = tmpPageValue;
    tmpPageValue = null;
  }
  setScreen($channel.value, $page.value);
});

// When user clicks on the go button, we should change the screen
// to the channel and page that the user has entered
$goButton.addEventListener("click", function () {
  setScreen($channel.value, $page.value);
});

// When user clicks on the prev and next button, we should change the screen
// to the channel and page that the user has entered
$prevChannel.addEventListener("click", function () {
  const chValue = parseInt($channel.value, 10);
  if (chValue <= 100) return;
  $channel.value = chValue - 1;
  $page.value = 1;
  setScreen($channel.value, $page.value);
});

$nextChannel.addEventListener("click", function () {
  const chValue = parseInt($channel.value, 10);
  $channel.value = chValue + 1;
  $page.value = 1;
  setScreen($channel.value, $page.value);
});

// When user clicks on the prev and next button, we should change the screen
// to the channel and page that the user has entered
$prevPage.addEventListener("click", function () {
  const pageValue = parseInt($page.value, 10);
  if (pageValue <= 1) return;
  $page.value = pageValue - 1;
  setScreen($channel.value, $page.value);
});

$nextPage.addEventListener("click", function () {
  const pageValue = parseInt($page.value, 10);
  $page.value = pageValue + 1;
  setScreen($channel.value, $page.value);
});

// Initial page
setScreen(100, 1);

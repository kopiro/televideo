const $screen = document.querySelector("#screen");
const $channel = document.querySelector("#channel");
const $page = document.querySelector("#page");
const $goButton = document.querySelector("#go");
const $prevChannel = document.querySelector("#prevChannel");
const $nextChannel = document.querySelector("#nextChannel");

const $prevPage = document.querySelector("#prevPage");
const $nextPage = document.querySelector("#nextPage");

const BASE_URL =
  "https://www.televideo.rai.it/televideo/pub/tt4web/Nazionale/16_9_page-";

function buildImgUrl(channel, page) {
  if (page == 1) {
    return BASE_URL + channel + ".png";
  }
  return BASE_URL + channel + "." + page + ".png";
}

function setScreen(channel, page) {
  const channelNumber = parseInt(channel, 10);
  const pageNumber = parseInt(channel, 10);
  if (channelNumber && pageNumber) {
    $screen.src = buildImgUrl(channel, page);
  }
}

// When selecting input $channel, remove value
$channel.addEventListener("focus", function () {
  $channel.value = "";
});

$channel.addEventListener("blur", function () {
  setScreen($channel.value, $page.value);
});

// When selecting input $page, remove value
$page.addEventListener("focus", function () {
  $page.value = "";
});

// On clicking Done on $page, set the screen
$page.addEventListener("blur", function () {
  setScreen($channel.value, $page.value);
});

// When user clicks on the go button, we should change the screen
// to the channel and page that the user has entered
$goButton.addEventListener("click", function () {
  setScreen($channel.value, 1);
});

// When user clicks on the prev and next button, we should change the screen
// to the channel and page that the user has entered
$prevChannel.addEventListener("click", function () {
  $channel.value = parseInt($channel.value, 10) - 1;
  setScreen($channel.value, $page.value);
});

$nextChannel.addEventListener("click", function () {
  $channel.value = parseInt($channel.value, 10) + 1;
  setScreen($channel.value, $page.value);
});

// When user clicks on the prev and next button, we should change the screen
// to the channel and page that the user has entered
$prevPage.addEventListener("click", function () {
  $page.value = parseInt($page.value, 10) - 1;
  setScreen($channel.value, $page.value);
});

$nextPage.addEventListener("click", function () {
  $page.value = parseInt($page.value, 10) + 1;
  setScreen($channel.value, $page.value);
});

setScreen(100, 1);
